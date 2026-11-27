// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../../../lib/api";
import { tx } from "../../../../lib/t";

// The widgets of a design WORK in the preview of the creator. The preview frame itself runs no scripts (and has the rights of this page, so it never may), so the widget is drawn
// by a frame of its own on top of the place that the preview keeps for it: a sandboxed frame without any rights (only scripts), with the real widget (its html, css and js, with the options of the
// website or its example). The place follows the preview when it scrolls, is resized or changes, and gets the height that the widget asks for.
export default function PreviewWidgets({ frameRef, version }) {
  const [boxes, setBoxes] = useState([]);   // [{id, key, x, y, w, h}]
  const [docs, setDocs] = useState({});     // widget key -> its html document
  const asked = useRef(new Set());
  const heights = useRef({});               // widget key -> the height it asked for

  const scan = useCallback(() => {
    const d = frameRef.current?.contentDocument;
    if (!d) return;
    const out = [];
    d.querySelectorAll('[data-sysobject-preview^="widget-"]').forEach((el, i) => {
      const key = String(el.getAttribute("data-sysobject-preview") || "").slice(7);
      const need = heights.current[key];
      if (need && Math.abs(el.offsetHeight - need) > 2) el.style.minHeight = `${need}px`;  // room for the widget
      el.style.visibility = "hidden";                                                       // the widget itself is drawn on top
      const r = el.getBoundingClientRect();
      out.push({ id: `${i}-${key}`, key, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(need || r.height) });
    });
    setBoxes((cur) => (JSON.stringify(cur) === JSON.stringify(out) ? cur : out));
  }, [frameRef]);

  useEffect(() => {   // a new preview: look for the places again, follow the scrolling and the changes
    const t0 = setTimeout(scan, 120);
    const win = frameRef.current?.contentWindow;
    try { win?.addEventListener("scroll", scan, { passive: true }); win?.addEventListener("resize", scan); } catch { /* not readable */ }
    const t = setInterval(scan, 500);
    return () => { clearTimeout(t0); clearInterval(t); try { win?.removeEventListener("scroll", scan); win?.removeEventListener("resize", scan); } catch { /* gone */ } };
  }, [version, scan, frameRef]);

  useEffect(() => {   // a widget tells its height
    const on = (e) => {
      const m = e.data;
      if (m && typeof m === "object" && m.widget && Number(m.widgetHeight) > 0) { heights.current[m.widget] = Math.min(1200, Math.ceil(Number(m.widgetHeight))); scan(); }
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [scan]);

  useEffect(() => {   // the documents of the widgets that are in the design (once each)
    boxes.forEach((b) => {
      if (asked.current.has(b.key)) return;
      asked.current.add(b.key);
      api(`/sitecreator/widget-doc/${encodeURIComponent(b.key)}/`).then((r) => setDocs((cur) => ({ ...cur, [b.key]: r?.doc || "" }))).catch(() => asked.current.delete(b.key));
    });
  }, [boxes]);

  if (!boxes.length) return null;
  return (
    <div aria-hidden="false" style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }} data-easy2edit-tag="ui-preview-widgets">
      {boxes.map((b) => docs[b.key] ? (
        <iframe key={b.id} title={`${tx("Widget")} ${b.key}`} sandbox="allow-scripts" srcDoc={docs[b.key]} tabIndex={-1} style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, border: 0, background: "transparent", pointerEvents: "none" }} />
      ) : null)}
    </div>
  );
}
