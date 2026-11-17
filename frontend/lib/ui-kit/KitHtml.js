// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import KitScope from "./KitScope";
import { useKit } from "./kitDoc";
import { mediaUrl } from "../api";

// A component of the UI-kit built straight into the page (no frame): the theme and the components work together, the fonts and colours are the ones of the page itself.
// The html is cleaned first (no scripts, no event attributes, no javascript: links, no frames); the script of the set runs on this block only.
const BAD_TAGS = "script,iframe,frame,frameset,object,embed,link,meta,base,style,noscript,template,applet";
const URL_ATTRS = ["href", "src", "xlink:href", "action", "formaction", "poster", "srcset"];

export function cleanHtml(html) {
  if (typeof DOMParser === "undefined") return "";
  const doc = new DOMParser().parseFromString(`<body>${html || ""}</body>`, "text/html");
  doc.body.querySelectorAll(BAD_TAGS).forEach((n) => n.remove());
  doc.body.querySelectorAll("*").forEach((el) => {
    for (const a of [...el.attributes]) {
      const n = a.name.toLowerCase(), v = a.value.replace(/[\u0000- ]+/g, "").toLowerCase();
      if (n.startsWith("on") || (URL_ATTRS.includes(n) && /^(javascript|vbscript|data:text\/html)/.test(v))) el.removeAttribute(a.name);
    }
    if (el.tagName === "A" && el.getAttribute("target") === "_blank") el.setAttribute("rel", "noopener noreferrer");
  });
  return doc.body.innerHTML;
}

// the css that belongs to this block only: every selector gets the class of the block in front
function prefixCss(css, prefix) {
  if (!css || typeof CSSStyleSheet === "undefined") return "";
  let sheet;
  try { sheet = new CSSStyleSheet(); sheet.replaceSync(css); } catch { return ""; }
  const rules = (list) => [...list].map((r) => {
    if (r.type === 1) return `${r.selectorText.split(",").map((s) => `${prefix} ${s.trim().replace(/^(html|body|:root)\s*/i, "")}`).join(",")}{${r.style.cssText}}`;
    if (r.type === 4) return `@media ${r.conditionText}{${rules(r.cssRules)}}`;
    return "";
  }).join("\n");
  return rules(sheet.cssRules);
}

// the basic type of the kit inside a block of a page: headings, paragraphs and lists look like in the design (the set keeps these rules out of its scoped css, so the small headings of the website would win)
const pageType = (c) => `.${c}{font-size:16px;line-height:1.6}.${c} :is(h1,h2,h3,h4){font-family:var(--e2e-font-heading);line-height:1.15;margin:0 0 .5em;font-weight:600;letter-spacing:.01em;color:var(--e2e-text)}.${c} h1{font-size:clamp(2rem,4vw,3.2rem)}.${c} h2{font-size:clamp(1.6rem,3vw,2.3rem)}.${c} h3{font-size:1.35rem}.${c} h4{font-size:1.1rem}.${c} p{margin:0 0 1em;font-size:1rem}.${c} :is(li){font-size:1rem}`;

export default function KitHtml({ html, css = "", tag, set = "", className = "", stage = false }) {
  const { kit } = useKit(true, set);
  const root = useRef(null);
  const id = "kh" + useId().replace(/[^a-z0-9]/gi, "");
  const media = (t) => String(t || "").replaceAll("__MEDIA__/", mediaUrl("/media/")); // the pictures of an imported or designed page (__MEDIA__/themes/...) come from the media folder
  const clean = useMemo(() => cleanHtml(media(html)), [html]); // eslint-disable-line react-hooks/exhaustive-deps
  const own = useMemo(() => prefixCss(media(css), `.${id}`), [css, id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { // the script of the set (tabs, calendar, kanban, players ...) on this block only
    const el = root.current;
    if (!el || !kit?.KIT_RUNTIME) return undefined;
    const off = [];
    const scoped = new Proxy(document, {
      get(t, p) {
        if (p === "querySelectorAll" || p === "querySelector") return (s) => el[p](s);
        if (p === "getElementById") return (i) => el.querySelector(`#${CSS.escape(i)}`) || t.getElementById(i);
        if (p === "addEventListener") return (n, f, o) => { t.addEventListener(n, f, o); off.push(() => t.removeEventListener(n, f, o)); };
        const v = t[p];
        return typeof v === "function" ? v.bind(t) : v;
      },
    });
    const timers = [];
    const win = new Proxy(window, { get(t, p) { if (p === "setInterval") return (f, ms) => { const h = t.setInterval(f, ms); timers.push(h); return h; }; const v = t[p]; return typeof v === "function" ? v.bind(t) : v; } });
    try { new Function("document", "window", kit.KIT_RUNTIME)(scoped, win); } catch { /* a broken script never breaks the page */ }
    const stop = (e) => { const a = e.target.closest?.('a[href="#"]'); if (a) e.preventDefault(); };
    el.addEventListener("click", stop);
    return () => { off.forEach((f) => f()); timers.forEach((h) => clearInterval(h)); el.removeEventListener("click", stop); };
  }, [kit, clean]);
  return (
    <KitScope tag={tag} stage={stage} className={`${id} ${className}`.trim()}>
      <style>{pageType(id) + (own || "")}</style>
      <div ref={root} dangerouslySetInnerHTML={{ __html: clean }} />
    </KitScope>
  );
}
