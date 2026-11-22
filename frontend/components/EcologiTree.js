// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useId } from "react";
import { tx } from "../lib/t";

const STEPS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];
export const nextGoal = (n) => STEPS.find((s) => s > n) || Math.ceil((n + 1) / 100000) * 100000;
const nf = (n) => { try { return new Intl.NumberFormat().format(n); } catch { return String(n); } };

// A tree that fills with green as trees are planted: the crown grows full towards the next milestone (10, 25, 50, 100 ...).
export default function EcologiTree({ value = 0, size = 150, caption = true, light = false }) {
  const id = useId().replace(/:/g, "");
  const goal = nextGoal(value);
  const base = STEPS[STEPS.indexOf(goal) - 1] || 0;
  const pct = Math.max(value > 0 ? 6 : 0, Math.min(100, Math.round(((value - base) / (goal - base)) * 100)));
  const circles = [[60, 40, 27], [37, 60, 21], [83, 60, 21], [60, 66, 27], [45, 44, 17], [76, 44, 17]];
  const top = 13, bottom = 94;
  const y = top + (1 - pct / 100) * (bottom - top); // the level of the fill in the crown
  const pale = light ? "rgba(255,255,255,.22)" : "#dcebdc";
  return (
    <figure className="eco-tree" style={{ margin: 0 }} aria-label={`${nf(value)} ${tx("bomen")}, ${tx("volgende mijlpaal")} ${nf(goal)}`}>
      <svg viewBox="0 0 120 150" width={size} height={size * 1.25} role="img">
        <defs>
          <clipPath id={`c${id}`}>{circles.map(([cx, cy, r], i) => <circle key={i} cx={cx} cy={cy} r={r} />)}</clipPath>
          <linearGradient id={`g${id}`} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#2f7d5b" /><stop offset="1" stopColor="#8fd1a8" /></linearGradient>
        </defs>
        <ellipse cx="60" cy="143" rx="34" ry="5" fill={light ? "rgba(255,255,255,.2)" : "#cfe0cf"} />
        <path d="M54 92h12l3 50H51z" fill={light ? "#e9dcc4" : "#7a5f43"} />
        <path d="M60 112l-13-13M60 104l12-11" fill="none" stroke={light ? "#e9dcc4" : "#7a5f43"} strokeWidth="4" strokeLinecap="round" />
        <g clipPath={`url(#c${id})`}>
          <rect x="0" y={top} width="120" height={bottom - top + 2} fill={pale} />
          <rect x="0" y={y} width="120" height={bottom + 2 - y} fill={`url(#g${id})`} style={{ transition: "y .9s ease, height .9s ease" }} />
          <path d={`M0 ${y} q15 -4 30 0 t30 0 t30 0 t30 0 V${bottom + 2} H0z`} fill={`url(#g${id})`} opacity=".55" />
        </g>
      </svg>
      {caption && <figcaption><strong>{nf(value)}</strong><small>{tx("volgende mijlpaal")}: {nf(goal)}</small></figcaption>}
    </figure>
  );
}
