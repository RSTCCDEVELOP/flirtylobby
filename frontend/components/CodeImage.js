"use client";

import { useEffect, useRef } from "react";

// A code of capitals and digits drawn on a small picture (letters a bit crooked, with lines and dots), so that it is read by a person and typed over. Used by the confirmation "code on the screen".
export default function CodeImage({ code, label = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !code) return;
    const dpr = window.devicePixelRatio || 1, W = 220, H = 64;
    c.width = W * dpr; c.height = H * dpr;
    const g = c.getContext("2d");
    g.scale(dpr, dpr);
    const css = getComputedStyle(document.documentElement);
    const bg = css.getPropertyValue("--bg").trim() || "#0b1220", fg = css.getPropertyValue("--text").trim() || "#e5e9f2", ac = css.getPropertyValue("--blue").trim() || "#3b82f6";
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const rnd = (a, b) => a + Math.random() * (b - a);
    for (let i = 0; i < 6; i++) { g.strokeStyle = ac; g.globalAlpha = .35; g.lineWidth = rnd(1, 2); g.beginPath(); g.moveTo(rnd(0, W), rnd(0, H)); g.bezierCurveTo(rnd(0, W), rnd(0, H), rnd(0, W), rnd(0, H), rnd(0, W), rnd(0, H)); g.stroke(); }
    for (let i = 0; i < 40; i++) { g.fillStyle = fg; g.globalAlpha = .25; g.fillRect(rnd(0, W), rnd(0, H), 2, 2); }
    g.globalAlpha = 1; g.fillStyle = fg; g.textBaseline = "middle"; g.textAlign = "center";
    const step = W / (code.length + 1);
    [...code].forEach((ch, i) => {
      g.save(); g.translate(step * (i + 1), H / 2 + rnd(-6, 6)); g.rotate(rnd(-.35, .35));
      g.font = `700 ${Math.round(rnd(30, 36))}px ui-monospace, Menlo, Consolas, monospace`; g.fillText(ch, 0, 0); g.restore();
    });
  }, [code]);
  return <canvas ref={ref} role="img" aria-label={label} style={{ width: 220, height: 64, borderRadius: 10, border: "1px solid var(--line)", display: "block", margin: "0 auto" }} />;
}
