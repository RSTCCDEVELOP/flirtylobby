// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { api, mediaUrl } from "../lib/api";
import { tx } from "../lib/t";
import { useSession } from "./Session";
import TextEditPopup from "./TextEditPopup";

// The texts of a design: every piece of text in the html, in order. The frame and this component count them in the same way, so a click in the frame
// ("text number 12") can be found again in the html that is saved. (Also run inside the frame: keep this function free of anything outside it.)
function textNodes(doc) {
  const out = [], skip = /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|TITLE|HEAD|SVG|OPTION)$/i;
  const w = doc.createTreeWalker(doc.body || doc.documentElement, 4, null);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    let p = n.parentNode, bad = false;
    while (p && p.nodeType === 1) { if (skip.test(p.nodeName)) { bad = true; break; } p = p.parentNode; }
    if (!bad && /\S/.test(n.nodeValue)) out.push(n);
  }
  return out;
}

// A page that was taken over 1 to 1 from an html file (Site importeren): its own html, css and scripts run in a frame without any rights
// on this site (no cookies, no login, no access to the page around it); the frame grows with its content and its links open the site.
// With pageKey, someone who may edit sees a pencil at every text and button in edit mode: a small screen to change the text and the link.
export default function DesignFrame({ html, title, pageKey }) {
  const ref = useRef(null);
  const { editing } = useSession();
  const canEdit = !!pageKey && !!editing;
  const [cur, setCur] = useState(html);
  const [height, setHeight] = useState(900);
  const [sel, setSel] = useState(null); // the text that is being changed: { idx, text, href, link }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => setCur(html), [html]);
  const id = `d${useId().replace(/[^a-zA-Z0-9]/g, "")}`; // the same on the server and in the browser: the frame sends its height with this name
  const doc = useMemo(() => {
    const src = String(cur || "").replaceAll("__MEDIA__/", mediaUrl("/media/"));
    const edit = canEdit ? `var textNodes=${textNodes.toString()};var pen=document.createElement("div");pen.style.cssText="position:absolute;z-index:2147483647;width:30px;height:30px;border-radius:50%;background:#7b2ce0;color:#fff;display:none;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.35);pointer-events:none";pen.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>';document.body.appendChild(pen);var hot=null,hotNode=null;
var INL={SPAN:1,B:1,STRONG:1,EM:1,I:1,U:1,SMALL:1,MARK:1,SUP:1,SUB:1,CODE:1},OK={A:1,BR:1};
function pure(el){var all=el.querySelectorAll("*");for(var i=0;i<all.length;i++){var t=all[i].tagName;if(!INL[t]&&!OK[t])return false}return true}
function pick(n){var el=n.parentElement;while(INL[el.tagName]&&el.parentElement&&el.parentElement!==document.body&&pure(el.parentElement))el=el.parentElement;return pure(el)?el:null}
function pathOf(el){var p=[];while(el&&el!==document.body){var par=el.parentElement;p.unshift(Array.prototype.indexOf.call(par.children,el));el=par}return p}
function look(el){var c=getComputedStyle(el),bg="",x=el;while(x&&x.nodeType===1){var b=getComputedStyle(x).backgroundColor;if(b&&b!=="rgba(0, 0, 0, 0)"&&b!=="transparent"){bg=b;break}x=x.parentElement}return {color:c.color,font:c.fontFamily,size:c.fontSize,weight:c.fontWeight,lh:c.lineHeight,align:c.textAlign,ls:c.letterSpacing,tt:c.textTransform,bg:bg||"#ffffff"}}
function at(x,y){var r=document.caretRangeFromPoint?document.caretRangeFromPoint(x,y):null;var n=r&&r.startContainer;if(!n||n.nodeType!==3||!/\\S/.test(n.nodeValue))return null;var all=textNodes(document),i=all.indexOf(n);return i<0?null:{n:n,i:i,el:pick(n)||n.parentElement,rich:!!pick(n)}}
function clear(){if(hot){hot.style.outline=hot.__o||"";hot.style.cursor=hot.__c||""}hot=null;hotNode=null;pen.style.display="none"}
document.addEventListener("mousemove",function(e){var h=at(e.clientX,e.clientY);if(!h){clear();return}var el=h.el,r=document.createRange();r.selectNodeContents(el);var rb=r.getBoundingClientRect();if(hot!==el){clear();hot=el;el.__o=el.style.outline;el.__c=el.style.cursor;el.style.outline="2px dashed #7b2ce0";el.style.cursor="pointer"}hotNode=h;pen.style.display="flex";pen.style.left=(rb.right+window.scrollX-4)+"px";pen.style.top=(rb.top+window.scrollY-26)+"px"},true);
document.addEventListener("mouseleave",clear);
document.addEventListener("click",function(e){var h=hotNode||at(e.clientX,e.clientY);if(!h)return;e.preventDefault();e.stopPropagation();var el=h.el,a=el.closest("a[href]");var link=a?Array.prototype.indexOf.call(document.querySelectorAll("a[href]"),a):-1;var lk=look(el);clear();parent.postMessage({design:${JSON.stringify(id)},edit:{kind:h.rich?"el":"node",idx:h.i,path:h.rich?pathOf(el):null,tag:el.tagName,html:h.rich?el.innerHTML:"",text:h.n.nodeValue.trim(),href:a?a.getAttribute("href"):"",link:link,look:lk}},"*")},true);` : "";
    const tail = `<style>html,body{overflow-y:hidden!important}</style><script>(function(){var id=${JSON.stringify(id)};function send(){var b=document.body,e=document.documentElement;parent.postMessage({design:id,h:Math.max(b?b.scrollHeight:0,e.scrollHeight)},"*")}
document.querySelectorAll("a[href]").forEach(function(a){var h=a.getAttribute("href")||"";if(h&&h.charAt(0)!=="#"&&!/^javascript:/i.test(h))a.target="_top"});${edit}
window.addEventListener("load",send);window.addEventListener("resize",send);if(window.ResizeObserver)new ResizeObserver(send).observe(document.body);setInterval(send,1500);})();<\/script>`;
    return /<\/body>/i.test(src) ? src.replace(/<\/body>/i, `${tail}</body>`) : src + tail;
  }, [cur, id, canEdit]);
  useEffect(() => {
    const on = (e) => {
      if (e.source !== ref.current?.contentWindow || e.data?.design !== id) return;
      if (e.data.edit) { setErr(""); setSel(e.data.edit); return; }
      setHeight(Math.max(200, Math.min(60000, Number(e.data.h) || 600)));
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [id]);
  const save = async () => {
    setBusy(true); setErr("");
    try {
      const d = new DOMParser().parseFromString(cur, "text/html");
      if (sel.kind === "el") {
        let el = d.body;
        for (const i of sel.path) el = el?.children[i];
        if (!el || el.tagName !== sel.tag) throw new Error(tx("Deze tekst is niet meer te vinden."));
        const t = d.createElement("div");
        t.innerHTML = sel.html;
        t.querySelectorAll("script,iframe,object,embed").forEach((x) => x.remove());
        t.querySelectorAll("*").forEach((x) => { [...x.attributes].forEach((at) => { if (/^on/i.test(at.name) || (/^(href|src)$/i.test(at.name) && /^\s*javascript:/i.test(at.value))) x.removeAttribute(at.name); }); });
        el.innerHTML = t.innerHTML;
      } else {
        const node = textNodes(d)[sel.idx];
        if (!node) throw new Error(tx("Deze tekst is niet meer te vinden."));
        const m = node.nodeValue.match(/^(\s*)[\s\S]*?(\s*)$/);
        node.nodeValue = `${m[1]}${sel.text.trim()}${m[2]}`;
      }
      if (sel.link >= 0) d.querySelectorAll("a[href]")[sel.link]?.setAttribute("href", sel.href.trim());
      const next = `<!doctype html>\n${d.documentElement.outerHTML}`;
      await api(`/pages/design/${pageKey}/save/`, { method: "POST", body: { design: next } });
      setCur(next); setSel(null);
    } catch (e) { setErr(e?.message || tx("Opslaan is niet gelukt.")); }
    setBusy(false);
  };
  const pageCss = useMemo(() => (canEdit ? [...String(cur || "").matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n").replaceAll("__MEDIA__/", mediaUrl("/media/")) : ""), [cur, canEdit]);
  return (<>
    <iframe ref={ref} title={title || "Pagina"} srcDoc={doc} sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-top-navigation-by-user-activation" style={{ display: "block", width: "100%", height, border: 0 }} />
    {sel && <TextEditPopup key={`${sel.kind}${sel.idx}`} sel={sel} css={pageCss} onChange={setSel} onSave={save} onClose={() => setSel(null)} busy={busy} err={err} />}
  </>);
}
