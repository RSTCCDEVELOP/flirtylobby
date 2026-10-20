"use client";

import { useState } from "react";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";

// "Opmaak": the layout of a page in one click. The items stay (texts, pictures, system objects), only their grid changes.
export const PRESETS = [
  ["auto", "Automatisch", "Volgens het thema van de website", [[1], [1, 1, 1]]],
  ["single", "Onder elkaar", "Alles in één kolom", [[1], [1], [1]]],
  ["two", "Twee kolommen", "Twee naast elkaar", [[1, 1], [1, 1]]],
  ["three", "Drie kolommen", "Drie naast elkaar", [[1, 1, 1], [1, 1, 1]]],
  ["four", "Vier kolommen", "Vier naast elkaar", [[1, 1, 1, 1]]],
  ["hero", "Hero met kaarten", "Eerst één breed blok, dan drie kaarten", [[1], [1, 1, 1]]],
  ["split", "Breed en smal", "Een brede en een smalle kolom", [[2, 1]]],
];

const Mini = ({ rows }) => (
  <span className="lp-mini" aria-hidden="true">
    {rows.map((r, i) => <span key={i} className="lp-row">{r.map((w, j) => <i key={j} style={{ flex: w }} />)}</span>)}
  </span>
);

export default function LayoutPresets({ pageKey, current = "", onApplied, standard = false }) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  async function apply(p) {
    setBusy(p); setErr("");
    try { const d = await api(`/pages/layout/${encodeURIComponent(pageKey)}/preset/`, { method: "POST", body: { preset: p } }); onApplied?.(d, p); }
    catch (e) { setErr(errorText(e)); }
    setBusy("");
  }
  return (
    <div className="lp">
      <strong style={{ fontSize: ".85rem" }}>{tx("Opmaak")}</strong>
      <div className="lp-list" role="radiogroup" aria-label={tx("Opmaak van de pagina")}>
        {PRESETS.filter(([k]) => k !== "auto" || standard).map(([k, label, hint, rows]) => (
          <button key={k} type="button" role="radio" aria-checked={current === k} disabled={!!busy} title={tx(hint)} className={`lp-btn ${current === k ? "on" : ""}`} onClick={() => apply(k)}>
            <Mini rows={rows} /><span>{busy === k ? tx("Bezig…") : tx(label)}</span>
          </button>
        ))}
      </div>
      {err && <small style={{ color: "var(--danger)" }}>{err}</small>}
    </div>
  );
}
