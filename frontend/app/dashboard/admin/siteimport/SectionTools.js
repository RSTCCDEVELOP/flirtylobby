// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconTrash } from "../../../../components/Icons";
import { tx } from "../../../../lib/t";

// Tools on the parts of a design in the preview of the creator: point at a part (a top-level block of <main>) and a frame with a trash can appears, to take it out of the design before it is published.
// The number that is sent is the place of the part among the blocks of <main> (counted from 0), the same count that the server uses. The preview frame has no scripts, so the tools sit in a layer on top of it.
export default function SectionTools({ frameRef, version, onDelete, disabled, zoom = 1 }) {
  const el = useRef(null);
  const [box, setBox] = useState(null);   // {index, x, y, w, h} of the part that is pointed at

  const measure = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    const node = el.current;
    if (!doc || !node || !node.isConnected) { setBox(null); return; }
    const r = node.getBoundingClientRect();
    const index = [...doc.querySelectorAll("main > div")].indexOf(node);
    if (index < 0) { setBox(null); return; }
    const next = { index, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
    setBox((cur) => (cur && cur.index === next.index && cur.x === next.x && cur.y === next.y && cur.w === next.w && cur.h === next.h ? cur : next));
  }, [frameRef]);

  useEffect(() => {   // a new preview: follow the mouse and the scrolling
    el.current = null; setBox(null);
    const win = frameRef.current?.contentWindow;
    const doc = frameRef.current?.contentDocument;
    if (!doc || disabled) return undefined;
    const move = (e) => { const s = e.target && e.target.closest ? e.target.closest("main > div") : null; if (s && s !== el.current) { el.current = s; measure(); } };
    try { doc.addEventListener("mousemove", move, { passive: true }); win?.addEventListener("scroll", measure, { passive: true }); win?.addEventListener("resize", measure); } catch { /* not readable */ }
    const t = setInterval(measure, 400);
    return () => { clearInterval(t); try { doc.removeEventListener("mousemove", move); win?.removeEventListener("scroll", measure); win?.removeEventListener("resize", measure); } catch { /* gone */ } };
  }, [version, disabled, measure, frameRef]);

  if (!box || disabled) return null;
  const k = 1 / Math.max(zoom, 0.25);   // the layer is scaled with the preview: the button is scaled back, so it is always the same size on the screen
  const SIZE = 34;
  const top = Math.max(box.y, 0) + 8 * k;   // a part that is higher than the screen keeps its button in view
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }} data-easy2edit-tag="ui-section-tools">
      <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, outline: `${3 * k}px dashed #d92d20`, outlineOffset: -3 * k, borderRadius: 6 }} />
      <button type="button" onClick={() => onDelete(box.index)} title={tx("Onderdeel verwijderen")} aria-label={tx("Onderdeel verwijderen")}
        style={{ position: "absolute", left: Math.max(box.x + box.w - (SIZE + 12) * k, 8 * k), top: Math.min(top, box.y + Math.max(box.h - (SIZE + 8) * k, 0)), width: SIZE, height: SIZE, transform: `scale(${k})`, transformOrigin: "0 0", pointerEvents: "auto", cursor: "pointer",
          display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0, border: "2px solid #fff", borderRadius: 10, background: "#d92d20", color: "#fff", fontSize: 18, boxShadow: "0 3px 12px rgba(0,0,0,.35)" }}>
        <IconTrash width={18} height={18} />
      </button>
    </div>
  );
}
