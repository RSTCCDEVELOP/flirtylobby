// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, apiBase, errorText } from "../lib/api";
import { anchorStyle } from "../lib/anchor";
import { holdLoader } from "../lib/loading";
import { confirmDialog } from "../lib/dialog";
import { getLanguage, tx } from "../lib/t";
import { makeTranslator } from "../lib/plugin-i18n";
import { useAuth } from "./AuthContext";
import { useSession } from "./Session";
import MediaPicker from "./MediaPicker";
import RichEditor from "./RichEditor";

const VARS = ["--bg", "--card", "--text", "--muted", "--line", "--blue", "--orange", "--ok", "--danger", "--radius", "--btn-radius", "--shadow", "--font-body", "--font-heading", "--fw-heading"];
const scheme = () => { const m = (getComputedStyle(document.documentElement).getPropertyValue("--bg").trim().match(/^#([0-9a-f]{6})$/i) || [])[1]; if (!m) return document.documentElement.dataset.theme === "light" ? "light" : "dark"; const n = parseInt(m, 16); return ((n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) < 140 ? "dark" : "light"; };
const siteVars = () => { const cs = getComputedStyle(document.documentElement); return Object.fromEntries(VARS.map((v) => [v, cs.getPropertyValue(v).trim()]).filter(([, x]) => x)); };

// A page of a plugin (file: "" = its own page, or e.g. "web/admin.html"), inside the dashboard. It runs in a sandboxed frame: it never sees the login of the member;
// it asks this host (postMessage) to call the system's API for it, as the logged-in member, and gets its texts in the language of the visitor.
export default function PluginFrame({ name, file = "", title, route = null, bare = false, onWrite = null }) {
  const dash = useAuth(), site = useSession(); // in the dashboard the AuthContext, on the public site the Session
  const user = dash?.user ?? site?.user ?? null;
  const frame = useRef(null);
  const routeRef = useRef(route);
  routeRef.current = route; // the page asks for it later than this render: always the latest
  const dict = useRef({ keys: [], dict: {} });
  const [height, setHeight] = useState(640);
  const router = useRouter();
  const [adminPop, setAdminPop] = useState(null); // {file, query}: the admin screen of this plugin in a popup (the Edit button on an item in edit mode)
  const dirty = useRef(false);
  const ready = useRef(null);
  useEffect(() => { ready.current = holdLoader(); return () => ready.current?.(); }, []); // the loader over the page waits until the plugin page has drawn itself (its first resize)
  const [ask, setAsk] = useState(null); // {type: "media" | "html", id, html, title}: the system shows its own picker / editor for the plugin

  useEffect(() => {
    const onMessage = async (e) => {
      if (e.source !== frame.current?.contentWindow) return;
      const d = e.data || {};
      const reply = (m) => frame.current?.contentWindow?.postMessage({ plugin: "reply", id: d.id, ...m }, "*");
      const text = makeTranslator(dict.current.dict, tx);  // the plugin's own translations first, then the system's own texts
      if (d.plugin === "hello") {
        const lang = getLanguage();
        try { const r = await fetch(`${apiBase()}/api/plugins/lang/${name}/?lang=${lang}`); if (r.ok) dict.current = await r.json(); } catch {}
        const strings = Object.fromEntries(dict.current.keys.map((k) => [k, makeTranslator(dict.current.dict, tx)(k)]));
        frame.current.contentWindow.postMessage({ plugin: "init", name, lang, strings, apiBase: apiBase(), route: routeRef.current || {}, siteOrigin: window.location.origin, vars: siteVars(), attrs: { editing: site?.editing ? "1" : "0", blocks: document.documentElement.dataset.blocks || "card", hero: document.documentElement.dataset.hero || "0", list: document.documentElement.dataset.list || "grid", center: document.documentElement.dataset.center || "0", pagesize: document.documentElement.dataset.pagesize || "all" }, scheme: scheme(), user: { id: user?.id, name: user?.first_name || user?.email, email: user?.email, is_staff: !!user?.is_staff } }, "*");
      } else if (d.plugin === "confirm") reply({ ok: true, data: await confirmDialog(String(d.message || ""), { title: d.opts?.title, okLabel: d.opts?.okLabel, danger: !!d.opts?.danger }) });
      else if (d.plugin === "store") {  // the page has no storage of its own: keep it per plugin in this browser
        const k = `plg:${name}:${String(d.key || "").slice(0, 60)}`;
        try {
          if (d.op === "set") { localStorage.setItem(k, JSON.stringify(d.value)); window.dispatchEvent(new Event("plugin-store")); reply({ ok: true, data: true }); }
          else if (d.op === "remove") { localStorage.removeItem(k); window.dispatchEvent(new Event("plugin-store")); reply({ ok: true, data: true }); }
          else reply({ ok: true, data: JSON.parse(localStorage.getItem(k)) });
        } catch { reply({ ok: true, data: null }); }
      }
      else if (d.plugin === "upload" && typeof d.path === "string" && d.path.startsWith("/") && d.file instanceof Blob) {  // a file for the system API, sent as the member
        try { const fd = new FormData(); fd.append("file", d.file, d.file.name || "bestand"); Object.entries(d.fields || {}).forEach(([k, v]) => fd.append(k, String(v))); reply({ ok: true, data: await api(d.path, { method: "POST", body: fd }) }); }
        catch (err) { reply({ ok: false, error: text(errorText(err)) }); }
      }
      else if (d.plugin === "go" && typeof d.path === "string") { if (d.path.startsWith("/") && !d.path.startsWith("//")) { window.dispatchEvent(new Event("nav-start")); router.push(d.path); } else if (/^https?:\/\//.test(d.path)) window.location.href = d.path; }
      else if (d.plugin === "openadmin" && site?.editing && typeof d.file === "string" && /^web\/[A-Za-z0-9_.-]+\.html$/.test(d.file)) setAdminPop({ anchor: (() => { const f = frame.current?.getBoundingClientRect(); const r = d.rect; return f && r && Number.isFinite(r.left) ? { left: f.left + r.left, top: f.top + r.bottom + 8 } : null; })(), file: d.file, query: { popup: "1", ...(d.query || {}) } });
      else if (d.plugin === "media") setAsk({ type: "media", id: d.id });
      else if (d.plugin === "html") setAsk({ type: "html", id: d.id, html: String(d.html || ""), title: d.opts?.title });
      else if (d.plugin === "resize") { ready.current?.(); setHeight(Math.max(120, Math.min(30000, Number(d.height) || 640))); }
      else if (d.plugin === "api" && typeof d.path === "string" && d.path.startsWith("/")) {
        if (onWrite && (d.opts?.method || "GET").toUpperCase() !== "GET") onWrite();  // the page of the plugin changed something
        try { reply({ ok: true, data: await api(d.path, { method: (d.opts?.method || "GET").toUpperCase(), body: d.opts?.body }) }); }
        catch (err) { reply({ ok: false, error: text(errorText(err)) }); }
      }
    };
    const onTheme = () => frame.current?.contentWindow?.postMessage({ plugin: "vars", vars: siteVars(), scheme: scheme() }, "*");  // the colours follow the light/dark switch of the site
    window.addEventListener("message", onMessage);
    window.addEventListener("themechange", onTheme);
    frame.current?.contentWindow?.postMessage({ plugin: "rehello" }, "*");  // a frame that loaded before this page was ready (server-rendered) missed its first hello
    return () => { window.removeEventListener("message", onMessage); window.removeEventListener("themechange", onTheme); };
  }, [name, user, router, onWrite]);
  useEffect(() => { frame.current?.contentWindow?.postMessage({ plugin: "attrs", attrs: { editing: site?.editing ? "1" : "0" } }, "*"); }, [site?.editing]);
  const closeAdmin = () => { setAdminPop(null); if (dirty.current) { dirty.current = false; window.location.reload(); } };
  const answer = (id, data) => { frame.current?.contentWindow?.postMessage({ plugin: "reply", id, ok: true, data }, "*"); setAsk(null); };

  return (
    <>
      <iframe ref={frame} scrolling="no" title={title || name} src={`${apiBase()}/api/plugins/web/${name}/${file}`} sandbox="allow-scripts allow-forms allow-popups allow-downloads" allow="fullscreen" allowFullScreen style={{ width: "100%", height, border: bare ? 0 : "1px solid var(--line)", borderRadius: bare ? 0 : 12, background: bare ? "transparent" : "var(--card)" }} />
      {adminPop && typeof document !== "undefined" && createPortal(
        <div className={`pb-objback${adminPop.anchor ? " anchored" : ""}`} onMouseDown={(e) => { if (e.target === e.currentTarget) closeAdmin(); }}>
          <div className="pb-objpop" role="dialog" style={adminPop.anchor ? anchorStyle(adminPop.anchor, 900) : { width: "min(900px, 100%)" }}>
            <div className="pb-objhead"><strong>{title || name}</strong><span style={{ flex: 1 }} /><button type="button" className="pb-panelx" onClick={closeAdmin} aria-label={tx("Sluiten")}>×</button></div>
            <PluginFrame name={name} file={adminPop.file} bare route={{ params: {}, query: adminPop.query }} onWrite={() => { dirty.current = true; }} />
          </div>
        </div>, document.body)}
      {ask?.type === "media" && <MediaPicker onClose={() => answer(ask.id, null)} onPick={(item) => answer(ask.id, { id: item.id, url: item.url })} />}
      {ask?.type === "html" && <RichEditor title={ask.title || tx("Tekst bewerken")} initialHtml={ask.html} onSave={async (html) => answer(ask.id, html)} onPlain={async (t) => answer(ask.id, `<p>${t.replace(/</g, "&lt;")}</p>`)} onClose={() => answer(ask.id, null)} />}
    </>
  );
}
