// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, apiBase, errorText } from "../lib/api";
import { holdLoader } from "../lib/loading";
import { confirmDialog } from "../lib/dialog";
import { getLanguage, tx } from "../lib/t";
import { makeTranslator } from "../lib/plugin-i18n";
import { useAuth } from "./AuthContext";
import { useSession } from "./Session";
import MediaPicker from "./MediaPicker";
import RichEditor from "./RichEditor";
import AiCreditPopup from "./AiCreditPopup";

const ROOT = ".pl-inline-root";
const VARS = ["--bg", "--card", "--text", "--muted", "--line", "--blue", "--orange", "--ok", "--danger", "--radius", "--btn-radius", "--shadow", "--font-body", "--font-heading", "--fw-heading"];
const siteVars = () => { const cs = getComputedStyle(document.documentElement); return Object.fromEntries(VARS.map((v) => [v, cs.getPropertyValue(v).trim()]).filter(([, x]) => x)); };

// Page-level CSS that belongs to the container and its overlay layer (not to the plugin): the layer itself takes no room.
const BASE_CSS = `${ROOT}{--vh:100vh;--vw:100vw;box-sizing:border-box;min-width:0;max-width:100%}
${ROOT}.pl-inline-portal{position:relative;z-index:45;width:0;height:0;min-height:0;margin:0;padding:0;border:0;background:none;overflow:visible}
${ROOT}[data-plugin-state]{display:block}`;

// ── Scoped css: every selector of the plugin gets the prefix .pl-inline-root, :root / html / body become the container itself.
function splitSelectors(s) {
  const out = []; let depth = 0, cur = "", q = "";
  for (const ch of s) {
    if (q) { cur += ch; if (ch === q) q = ""; continue; }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
function scopeSelector(sel) {
  let s = sel.replace(/:root(?![\w-])/g, ROOT);
  s = s.replace(/^(?:html|body)(?![\w-])/, ROOT);
  s = s.replace(/^(\.pl-inline-root(?:\[[^\]]*\]|\.[\w-]+|:[\w-]+(?:\([^)]*\))?)*)\s+body(?![\w-])/, "$1");  // html body .x -> container .x
  if (s.startsWith(ROOT) || /^:(where|is)\(\s*\.pl-inline-root/.test(s)) return s;
  return `${ROOT} ${s}`;
}
export function scopeCss(text) {
  let sheet;
  try { sheet = new CSSStyleSheet(); sheet.replaceSync(text); } catch { return ""; }
  const rules = (list) => Array.from(list).map((r) => {
    if (r.selectorText !== undefined && r.style) return splitSelectors(r.selectorText).map(scopeSelector).join(",") + r.cssText.slice(r.cssText.indexOf("{"));
    if (r.cssRules && !r.name) return `${r.cssText.slice(0, r.cssText.indexOf("{")).trim()}{${rules(r.cssRules)}}`;  // @media, @supports, @container, @layer
    return r.cssText;  // @keyframes, @font-face and the like stay as they are
  }).join("\n");
  return rules(sheet.cssRules);
}
const absUrls = (css, base) => css.replace(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/g, (m, q, u) => (/^(data:|https?:|\/\/|#|blob:)/i.test(u.trim()) ? m : `url("${new URL(u.trim(), base).href}")`));

// ── The page of a plugin inside the dashboard itself (no frame): opt-in with "inline": true in plugin.json, only for first-party, signed plugins.
// The markup goes into one container, the css is limited to it, the scripts run as normal global scripts with window.system as the host's own SDK.
export default function PluginInline({ name, file = "", title, route = null, bare = false, onWrite = null, keep = false }) {
  const dash = useAuth(), site = useSession();
  const user = dash?.user ?? site?.user ?? null;
  const router = useRouter();
  const hostRef = useRef(null);
  const live = useRef({});
  live.current = { route, onWrite, user, router };
  const [state, setState] = useState({ status: "loading", error: "" });
  const [ask, setAsk] = useState(null);
  const resolvers = useRef({});
  const [bust, setBust] = useState(0);
  const routeKey = JSON.stringify(route || {});
  useEffect(() => { if (keep) return undefined; const f = () => setBust((n) => n + 1); window.addEventListener("soft-refresh", f); return () => window.removeEventListener("soft-refresh", f); }, [keep]);

  useEffect(() => {
    let dead = false;
    const ac = new AbortController();
    const undo = [];
    const release = holdLoader();
    setState({ status: "loading", error: "" });
    const wait = (p) => new Promise((res, rej) => p.then((v) => { if (!dead) res(v); }, (e) => { if (!dead) rej(e); }));  // after the page is gone nothing is answered: late callbacks never run
    const askHost = (a) => new Promise((res) => { const id = Math.random().toString(36).slice(2); resolvers.current[id] = res; if (!dead) setAsk({ ...a, id }); });

    (async () => {
      const pageUrl = `${apiBase()}/api/plugins/web/${name}/${file}${bust ? `${file.includes("?") ? "&" : "?"}r=${bust}` : ""}`;
      const get = async (url) => { const r = await fetch(url, { signal: ac.signal, cache: "no-cache" }); if (!r.ok) throw new Error(`${tx("Laden mislukt")} (${r.status})`); return r.text(); };
      const lang = getLanguage();
      let dict = { keys: [], dict: {} };
      const langP = fetch(`${apiBase()}/api/plugins/lang/${name}/?lang=${lang}`, { signal: ac.signal }).then((r) => (r.ok ? r.json() : dict)).catch(() => dict);
      const html = await get(pageUrl);
      const doc = new DOMParser().parseFromString(html, "text/html");
      const base = new URL(doc.querySelector("base")?.getAttribute("href") || pageUrl, pageUrl).href;
      // the parts in document order: stylesheets and scripts, fetched at once
      const parts = [];
      doc.querySelectorAll('link[rel~="stylesheet"], style, script').forEach((el) => {
        if (el.tagName === "LINK") parts.push({ kind: "css", url: new URL(el.getAttribute("href"), base).href });
        else if (el.tagName === "STYLE") parts.push({ kind: "css", text: el.textContent, url: base });
        else if (el.hasAttribute("src")) parts.push({ kind: "js", url: new URL(el.getAttribute("src"), base).href });
        else if (!/Plugin SDK: put into every page/.test(el.textContent)) parts.push({ kind: "js", text: el.textContent });  // the SDK of the iframe is replaced by the one below
      });
      await Promise.all(parts.map(async (p) => { if (p.text === undefined) p.text = await get(p.url); }));
      dict = await langP;
      if (dead) return;

      // ── from here on everything is synchronous: nothing can unmount in between
      const text = makeTranslator(dict.dict, tx);
      const strings = Object.fromEntries(dict.keys.map((k) => [k, makeTranslator(dict.dict, tx)(k)]));
      const lr = live.current;
      const info = () => ({ user: { id: lr.user?.id, name: lr.user?.first_name || lr.user?.email, email: lr.user?.email, is_staff: !!lr.user?.is_staff }, name, lang, route: { path: "/", params: {}, query: {}, ...(live.current.route || {}) }, apiBase: apiBase(), siteOrigin: window.location.origin });
      const storeKey = (k) => `plg:${name}:${String(k || "").slice(0, 60)}`;
      let portal = null;
      const system = {
        ready: Promise.resolve(info()),
        api: (path, opts = {}) => {
          if (typeof path !== "string" || !path.startsWith("/")) return Promise.reject(new Error("Ongeldig pad"));
          const method = String(opts.method || "GET").toUpperCase();
          if (live.current.onWrite && method !== "GET") live.current.onWrite();
          return wait(api(path, { method, body: opts.body }).catch((err) => { throw new Error(text(errorText(err))); }));
        },
        upload: (path, f, fields = {}) => {
          if (typeof path !== "string" || !path.startsWith("/") || !(f instanceof Blob)) return Promise.reject(new Error("Ongeldig pad"));
          const fd = new FormData(); fd.append("file", f, f.name || "bestand"); Object.entries(fields).forEach(([k, v]) => fd.append(k, String(v)));
          return wait(api(path, { method: "POST", body: fd }).catch((err) => { throw new Error(text(errorText(err))); }));
        },
        confirm: (message, opts = {}) => wait(confirmDialog(String(message || ""), { title: opts.title, okLabel: opts.okLabel, danger: !!opts.danger })),
        t: (s, ...a) => { const str = Object.prototype.hasOwnProperty.call(strings, s) ? strings[s] : s; return String(str).replace(/\{(\d+)\}/g, (m, i) => (a[i] !== undefined ? String(a[i]) : m)); },
        store: {
          get: async (k) => { try { return JSON.parse(localStorage.getItem(storeKey(k))); } catch { return null; } },
          set: async (k, v) => { try { localStorage.setItem(storeKey(k), JSON.stringify(v)); window.dispatchEvent(new Event("plugin-store")); } catch {} return true; },
          remove: async (k) => { try { localStorage.removeItem(storeKey(k)); window.dispatchEvent(new Event("plugin-store")); } catch {} return true; },
        },
        pickMedia: () => wait(askHost({ type: "media" })),
        editHtml: (h, opts = {}) => wait(askHost({ type: "html", html: String(h || ""), title: opts.title })),
        aiCredit: () => wait(api("/ai/me/").then((i) => (i?.proposal ? askHost({ type: "aicredit", info: i }) : false)).catch(() => false)),
        consent: async () => { try { const c = JSON.parse(localStorage.getItem("cookie-consent") || "null"); return c && c.choices ? { choices: c.choices } : null; } catch { return null; } },
        go: (path) => { if (typeof path !== "string") return; if (path.startsWith("/") && !path.startsWith("//")) { window.dispatchEvent(new Event("nav-start")); live.current.router.push(path); } else if (/^https?:\/\//.test(path)) window.location.href = path; },
        resize() {}, bleed() {}, loaded() {}, openAdmin() {},
        portal: () => {  // the layer for dialogs, toasts and lightboxes: on top of the whole page, with the css of the plugin
          if (!portal || !portal.isConnected) {
            portal = document.createElement("div"); portal.className = "pl-inline-root pl-inline-portal"; portal.dataset.plugin = name; applyVars(portal);
            document.body.appendChild(portal);
          }
          return portal;
        },
      };

      // the DOM: one container with the body of the plugin page
      const box = document.createElement("div");
      box.className = `pl-inline-root ${doc.body.className || ""}`.trim();
      box.dataset.plugin = name; box.dataset.pluginState = "on";
      const applyVars = (el) => { const v = siteVars(); Object.entries(v).forEach(([k, x]) => el.style.setProperty(k, x)); };  // the colours of the site win over the fall-back colours in the css of the plugin
      const applyAll = () => { applyVars(box); if (portal) applyVars(portal); };
      const vh = () => { const hd = document.querySelector(".site-header, .topbar"); const top = hd ? Math.max(0, Math.round(hd.getBoundingClientRect().bottom)) : 0; box.style.setProperty("--vh", `${Math.max(300, window.innerHeight - top)}px`); box.style.setProperty("--vw", `${window.innerWidth}px`); };
      applyAll(); vh();
      doc.querySelectorAll("script, style, link, base, meta, title").forEach((el) => el.remove());
      doc.body.querySelectorAll("img[src], video[src], audio[src], source[src], iframe[src]").forEach((el) => { const s = el.getAttribute("src"); if (s && !/^(data:|https?:|\/\/|blob:)/i.test(s)) el.setAttribute("src", new URL(s, base).href); });
      box.innerHTML = doc.body.innerHTML;
      const style = document.createElement("style"); style.dataset.pluginInline = name;
      style.textContent = BASE_CSS + "\n" + parts.filter((p) => p.kind === "css").map((p) => scopeCss(absUrls(p.text, p.url))).join("\n");
      document.head.appendChild(style);
      hostRef.current.appendChild(box);
      const onTheme = () => { applyAll(); vh(); };
      window.addEventListener("themechange", onTheme); window.addEventListener("resize", vh);
      const themeWatch = new MutationObserver(() => requestAnimationFrame(onTheme));  // the theme switch only changes data-theme (and the style of the root): follow that too
      themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "style", "class"] });

      // the scripts as normal global scripts, window.system is ours
      const prevSystem = window.system;
      window.system = system;
      const val = (k) => { try { const d = Object.getOwnPropertyDescriptor(window, k); return d && "value" in d ? d.value : undefined; } catch { return undefined; } };
      const before = new Map(Object.getOwnPropertyNames(window).map((k) => [k, val(k)]));
      let failed = null;
      for (const p of parts) {
        if (p.kind !== "js") continue;
        const s = document.createElement("script");
        s.textContent = p.text + (p.url ? `\n//# sourceURL=${p.url}` : "");
        try { document.head.appendChild(s); } catch (e) { failed = e; }
        s.remove();
      }
      const added = Object.getOwnPropertyNames(window).filter((k) => !before.has(k) || before.get(k) !== val(k));  // new globals, and ones the page replaced

      undo.push(() => {
        window.removeEventListener("themechange", onTheme); window.removeEventListener("resize", vh); themeWatch.disconnect();
        box.remove(); style.remove(); portal?.remove(); portal = null;
        added.forEach((k) => {  // a var of a classic script cannot be deleted: it is emptied (or put back to what it was)
          try { if (before.has(k)) window[k] = before.get(k); else if (!delete window[k]) window[k] = undefined; } catch { try { window[k] = undefined; } catch {} }
        });
        if (window.system === system) { if (prevSystem === undefined) delete window.system; else window.system = prevSystem; }
      });
      if (failed) console.error(failed);
      release();
      setState({ status: "ready", error: "" });
    })().catch((e) => { release(); if (!dead && e?.name !== "AbortError") setState({ status: "error", error: e?.message || String(e) }); });

    return () => {
      dead = true; ac.abort(); release();
      undo.reverse().forEach((f) => { try { f(); } catch {} });
      Object.values(resolvers.current).forEach((r) => r(null)); resolvers.current = {};
      setAsk(null);
    };
  }, [name, file, routeKey, bust]);

  const answer = (id, data) => { const r = resolvers.current[id]; delete resolvers.current[id]; r?.(data); setAsk(null); };
  return (
    <>
      <div ref={hostRef} className="pl-inline-host" data-plugin-host={name} style={{ minWidth: 0, maxWidth: "100%" }} />
      {state.status === "loading" && <p className="muted" role="status" aria-label={title || name}>{tx("Laden…")}</p>}
      {state.status === "error" && <div className="alert" role="alert">{state.error}</div>}
      {ask?.type === "aicredit" && <AiCreditPopup info={ask.info} onClose={() => answer(ask.id, false)} beforePay={async () => { answer(ask.id, true); }} />}
      {ask?.type === "media" && <MediaPicker onClose={() => answer(ask.id, null)} onPick={(item) => answer(ask.id, { id: item.id, url: item.url })} />}
      {ask?.type === "html" && <RichEditor title={ask.title || tx("Tekst bewerken")} initialHtml={ask.html} onSave={async (html) => answer(ask.id, html)} onPlain={async (t) => answer(ask.id, `<p>${t.replace(/</g, "&lt;")}</p>`)} onClose={() => answer(ask.id, null)} />}
    </>
  );
}
