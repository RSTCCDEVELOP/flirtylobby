"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// A panel that floats above the page (in document.body) next to an element, so no row of the page can cut it off or paint over it.
// It sits under the element, stays inside the screen and scrolls itself when it is taller than the space.
export default function FloatPanel({ anchor, children, className = "" }) {
  const box = useRef(null);
  const [pos, setPos] = useState(null);
  const place = () => {
    const a = anchor.current?.getBoundingClientRect();
    if (!a) return;
    const w = box.current?.offsetWidth || 360, h = box.current?.offsetHeight || 300;
    const vw = window.innerWidth, vh = window.innerHeight;
    let top = a.bottom + 8;
    if (top + h > vh - 12 && a.top - 8 - h > 12) top = a.top - 8 - h;  // not enough room below: above the element when that fits
    top = Math.max(12, Math.min(top, vh - 80));
    const left = Math.max(12, Math.min(a.left, vw - w - 12));
    setPos({ top, left, maxH: vh - top - 12 });
  };
  useLayoutEffect(place, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const on = () => place();
    window.addEventListener("scroll", on, true);
    window.addEventListener("resize", on);
    const t = setInterval(on, 400); // the page below can move (an image loads, a row grows)
    return () => { window.removeEventListener("scroll", on, true); window.removeEventListener("resize", on); clearInterval(t); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (typeof document === "undefined") return null;
  return createPortal(
    <div ref={box} className={`float-panel ${className}`} style={{ top: pos?.top ?? -9999, left: pos?.left ?? 0, maxHeight: pos?.maxH }} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>{children}</div>,
    document.body,
  );
}
