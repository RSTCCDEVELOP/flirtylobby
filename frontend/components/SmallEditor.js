// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useRef, useState } from "react";
import { tx } from "../lib/t";
import { IconLink } from "./Icons";
import { OPEN_OPTIONS, WINDOW_FEATURES } from "../lib/linkopen";

// The small editor for every description in a data popup (user, profile, plan, donation ...): bold, italic, underline, list and link.
// Safe against copy-paste exploits: everything that goes in (typing, paste, drop) and everything that comes out is cleaned with a whitelist:
// only a few tags, no attributes except the address of a link (http, https, mailto or tel) and where it opens (data-open: self, tab or window), no scripts, styles, events or images.
// The value is stored as "html:<clean html>" (plain text stays plain text until it is edited).
export const PREFIX = "html:";
const ALLOWED = new Set(["P", "BR", "STRONG", "B", "EM", "I", "U", "UL", "OL", "LI", "A"]);
const DROP = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "SVG", "MATH", "FORM", "INPUT", "BUTTON", "TEXTAREA", "SELECT", "LINK", "META", "BASE", "TEMPLATE", "NOSCRIPT", "VIDEO", "AUDIO", "CANVAS", "IMG", "PICTURE", "SOURCE", "FRAME", "FRAMESET", "APPLET"]);
const SAFE_URL = /^(https?:\/\/|mailto:|tel:)/i;

const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const plainToHtml = (t) => String(t || "").split(/\n{2,}/).filter((p) => p.trim()).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");

function clean(node, out) {
  node.childNodes.forEach((c) => {
    if (c.nodeType === 3) { out.appendChild(document.createTextNode(c.nodeValue)); return; }
    if (c.nodeType !== 1) return; // comments, processing instructions ... are dropped
    const tag = c.tagName;
    if (DROP.has(tag)) return; // with everything inside it
    if (!ALLOWED.has(tag)) { clean(c, out); return; } // an unknown tag: only its text stays
    const el = document.createElement(tag.toLowerCase());
    if (tag === "A") {
      const href = (c.getAttribute("href") || "").trim().replace(/[\u0000-\u001f\u007f\s]+/g, "");
      if (!SAFE_URL.test(href)) { clean(c, out); return; } // no javascript:, data: ... : a link without a safe address is just its text
      const open = ["self", "tab", "window"].includes(c.getAttribute("data-open")) ? c.getAttribute("data-open") : "tab"; // (a link without a choice opens in a new tab, as before)
      el.setAttribute("href", href); el.setAttribute("rel", "noopener noreferrer nofollow");
      if (open !== "tab") el.setAttribute("data-open", open);
      if (open !== "self") el.setAttribute("target", "_blank");
    }
    clean(c, el);
    out.appendChild(el);
  });
}

// html in (anything) -> clean html out (only the whitelist above)
export function sanitizeHtml(html) {
  if (typeof document === "undefined") return "";
  const doc = new DOMParser().parseFromString(`<body>${html || ""}</body>`, "text/html");  // (a parsed document: nothing runs while it is cleaned)
  const box = document.createElement("div");
  clean(doc.body, box);
  return box.innerHTML;
}

export const toHtml = (value) => (String(value || "").startsWith(PREFIX) ? sanitizeHtml(String(value).slice(PREFIX.length)) : plainToHtml(value));
export const isEmpty = (html) => !String(html || "").replace(/<[^>]*>/g, "").trim();

// shows a stored description: html (cleaned again) or plain text
export function RichText({ value, className = "", style }) {
  if (!value) return null;
  if (!String(value).startsWith(PREFIX)) return <p className={className} style={{ whiteSpace: "pre-wrap", margin: 0, ...style }}>{value}</p>;
  const onClick = (e) => { const a = e.target.closest?.('a[data-open="window"]'); if (a) { e.preventDefault(); window.open(a.href, "_blank", WINDOW_FEATURES); } }; // a link that opens in a new window
  return <div className={`rich-small ${className}`} style={style} onClick={onClick} dangerouslySetInnerHTML={{ __html: sanitizeHtml(String(value).slice(PREFIX.length)) }} />;
}

export default function SmallEditor({ value, onChange, minHeight = 96, maxLength = 4000, disabled = false, placeholder = "" }) {
  const area = useRef(null);
  const last = useRef(null);
  const range = useRef(null); // the selected text while the link panel is open
  const [lk, setLk] = useState(null); // { url, open } while the link panel is open
  useEffect(() => { // from outside (opening another record): put it in, but never while the person is typing
    const html = toHtml(value);
    if (area.current && html !== last.current && document.activeElement !== area.current) { area.current.innerHTML = html; last.current = html; }
  }, [value]);
  const push = () => {
    const el = area.current;
    if (!el) return;
    const html = sanitizeHtml(el.innerHTML);
    if (html.replace(/<[^>]*>/g, "").length > maxLength) return;
    last.current = html;
    onChange(isEmpty(html) ? "" : PREFIX + html);
  };
  const cmd = (name, arg) => { if (disabled) return; area.current.focus(); document.execCommand(name, false, arg); push(); };
  const anchorOf = (n) => (n?.nodeType === 1 ? n : n?.parentElement)?.closest?.("a");
  const link = () => { // open the panel for the address and where the link opens (an existing link under the cursor is changed)
    if (disabled) return;
    const sel = window.getSelection();
    range.current = sel.rangeCount && area.current.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
    const a = anchorOf(sel.anchorNode);
    setLk({ url: a?.getAttribute("href") || "https://", open: a ? a.getAttribute("data-open") || "tab" : "tab" });
  };
  const applyLink = () => {
    const u = (lk.url || "").trim();
    setLk(null);
    if (!SAFE_URL.test(u)) return;
    area.current.focus();
    if (range.current) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(range.current); }
    document.execCommand("createLink", false, u);
    const a = anchorOf(window.getSelection().anchorNode) || anchorOf(window.getSelection().focusNode);
    if (a) a.setAttribute("data-open", lk.open);
    push();
  };
  const insert = (html) => { document.execCommand("insertHTML", false, html); push(); };
  const btn = { minWidth: "2rem", padding: ".2rem .5rem", fontWeight: 700 };
  return (
    <div className="small-editor" style={{ border: "1px solid var(--line)", borderRadius: 10, background: "var(--card)", opacity: disabled ? 0.6 : 1 }}>
      <div style={{ display: "flex", gap: ".25rem", padding: ".3rem", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }} onMouseDown={(e) => e.preventDefault()}>
        <button type="button" className="btn sm" style={btn} onClick={() => cmd("bold")} aria-label={tx("Vet")}><b>B</b></button>
        <button type="button" className="btn sm" style={{ ...btn, fontStyle: "italic" }} onClick={() => cmd("italic")} aria-label={tx("Cursief")}>I</button>
        <button type="button" className="btn sm" style={{ ...btn, textDecoration: "underline" }} onClick={() => cmd("underline")} aria-label={tx("Onderstreept")}>U</button>
        <button type="button" className="btn sm" style={btn} onClick={() => cmd("insertUnorderedList")} aria-label={tx("Lijst")}>•≡</button>
        <button type="button" className="btn sm" style={btn} onClick={() => cmd("insertOrderedList")} aria-label={tx("Genummerde lijst")}>1.</button>
        <button type="button" className="btn sm" style={btn} onClick={link} aria-label={tx("Link")}><IconLink /></button>
        <button type="button" className="btn sm" style={btn} onClick={() => cmd("removeFormat")} aria-label={tx("Opmaak wissen")}>⌫</button>
      </div>
      {lk && (
        <div style={{ display: "flex", gap: ".4rem", padding: ".4rem .5rem", borderBottom: "1px solid var(--line)", flexWrap: "wrap", alignItems: "center" }}>
          <input style={{ flex: "1 1 200px" }} value={lk.url} autoFocus aria-label={tx("Adres van de link (https://…)")} placeholder="https://…" onChange={(e) => setLk({ ...lk, url: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyLink(); } if (e.key === "Escape") setLk(null); }} />
          <select value={lk.open} aria-label={tx("Openen in")} onChange={(e) => setLk({ ...lk, open: e.target.value })}>{OPEN_OPTIONS.map(([k, l]) => <option key={k} value={k}>{tx(l)}</option>)}</select>
          <button type="button" className="btn sm primary" onClick={applyLink}>{tx("Toepassen")}</button>
          <button type="button" className="btn sm" onClick={() => setLk(null)}>{tx("Annuleren")}</button>
        </div>)}
      <div ref={area} className="rich-small" contentEditable={!disabled} suppressContentEditableWarning role="textbox" aria-multiline="true" data-placeholder={placeholder}
        style={{ minHeight, padding: ".6rem .8rem", outline: "none", overflow: "auto", maxHeight: 280 }}
        onInput={push} onBlur={push}
        onPaste={(e) => { // never the raw clipboard: the html of it is cleaned first (or the plain text is used)
          e.preventDefault();
          const h = e.clipboardData.getData("text/html");
          insert(h ? sanitizeHtml(h) : plainToHtml(e.clipboardData.getData("text/plain")));
        }}
        onDrop={(e) => { e.preventDefault(); const t = e.dataTransfer.getData("text/plain"); if (t) insert(plainToHtml(t)); }} />
    </div>
  );
}
