"use client";

import { useEffect, useState } from "react";
import { tx } from "../lib/t";

// A progress bar for a job whose end is not known in advance: it climbs quickly at first and slows down towards 90%,
// and jumps to 100% when the job is done (`done`). `label` tells what is going on.
export default function ProgressBar({ running, done = false, label = "" }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (done) { setN(100); return undefined; }
    if (!running) { setN(0); return undefined; }
    setN(2);
    const t = setInterval(() => setN((v) => (v >= 92 ? v : v + Math.max(0.4, (92 - v) / 14))), 250);
    return () => clearInterval(t);
  }, [running, done]);
  if (!running && !done) return null;
  const pct = Math.min(100, Math.round(n));
  return (
    <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label || tx("Bezig…")}>
      <div className="progress-top"><span>{label || tx("Bezig…")}</span><strong>{pct}%</strong></div>
      <div className="progress-track"><i style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
