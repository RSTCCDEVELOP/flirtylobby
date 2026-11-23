// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

// A small line chart in SVG (no library): one or more series over seconds, with a grid, the last value as a dot and the unit in the title.
// series: [{ label, color, points: [number | null, ...] }] (one point per second)
export default function LineChart({ title, unit = "", series, height = 150, decimals = 0 }) {
  const W = 600, H = height, L = 44, R = 12, T = 10, B = 22;
  const all = series.flatMap((s) => s.points.filter((v) => typeof v === "number"));
  const n = Math.max(2, ...series.map((s) => s.points.length));
  const max = all.length ? Math.max(...all) * 1.15 || 1 : 1;
  const x = (i) => L + (i / (n - 1)) * (W - L - R);
  const y = (v) => T + (1 - v / max) * (H - T - B);
  const fmt = (v) => Number(v).toLocaleString(undefined, { maximumFractionDigits: decimals });
  const ticks = [0, 0.5, 1].map((f) => f * max);
  return (
    <figure style={{ margin: 0, display: "grid", gap: ".3rem" }}>
      <figcaption style={{ display: "flex", justifyContent: "space-between", gap: ".6rem", flexWrap: "wrap", fontSize: ".85rem" }}>
        <strong>{title}{unit ? <span className="muted" style={{ fontWeight: 400 }}> · {unit}</span> : null}</strong>
        <span style={{ display: "inline-flex", gap: ".8rem" }}>{series.map((s) => <span key={s.label} style={{ display: "inline-flex", alignItems: "center", gap: ".3rem" }}><i style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: "inline-block" }} />{s.label}</span>)}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} style={{ width: "100%", height: "auto", background: "color-mix(in srgb, var(--card, #fff) 92%, var(--blue, #2f7d5b) 8%)", borderRadius: 10 }}>
        {ticks.map((tv, i) => (
          <g key={i}>
            <line x1={L} x2={W - R} y1={y(tv)} y2={y(tv)} stroke="currentColor" strokeOpacity=".12" />
            <text x={L - 6} y={y(tv) + 4} textAnchor="end" fontSize="11" fill="currentColor" opacity=".6">{fmt(tv)}</text>
          </g>
        ))}
        <text x={L} y={H - 6} fontSize="11" fill="currentColor" opacity=".6">0 s</text>
        <text x={W - R} y={H - 6} fontSize="11" fill="currentColor" opacity=".6" textAnchor="end">{n - 1} s</text>
        {series.map((s) => {
          const pts = s.points.map((v, i) => (typeof v === "number" ? `${x(i).toFixed(1)},${y(v).toFixed(1)}` : null)).filter(Boolean);
          const last = [...s.points].map((v, i) => [v, i]).reverse().find(([v]) => typeof v === "number");
          return (
            <g key={s.label}>
              {pts.length > 1 && <polyline points={pts.join(" ")} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />}
              {last && <circle cx={x(last[1])} cy={y(last[0])} r="4" fill={s.color} />}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
