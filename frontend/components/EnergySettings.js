// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useCallback, useEffect, useState } from "react";
import { IconCheck } from "./Icons";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";
import { resetEnergy } from "./EnergyBlocks";

// The settings of the green measurements (module Energie): the calculation model, the pages that are scanned, how long measurements are kept and, with showApi, the API for other websites.
export default function EnergySettingsPanel({ showApi = false, onSaved }) {
  const [st, setSt] = useState(null);
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState(null);
  const [copied, setCopied] = useState(false);
  const load = useCallback(() => api("/admin/energy/settings/").then((r) => { setSt(r); setForm({ ...r, scan_paths: r.scan_paths.join("\n") }); }).catch((e) => setMsg({ ok: false, text: errorText(e) })), []);
  useEffect(() => { load(); }, [load]);
  const save = async (body, okText) => {
    try { const r = await api("/admin/energy/settings/", { method: "PATCH", body }); setSt(r); setForm({ ...r, scan_paths: r.scan_paths.join("\n") }); resetEnergy(); setMsg({ ok: true, text: okText || tx("Opgeslagen.") }); onSaved?.(r); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  };
  if (!st || !form) return <p className="muted">{msg ? msg.text : tx("Laden…")}</p>;
  const set = (k, v) => setForm((o) => ({ ...o, [k]: v }));
  const when = (iso) => { try { return new Date(iso).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
  return (
    <div style={{ display: "grid", gap: "1rem", maxWidth: 820 }}>
      {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
      <form className="card form" style={{ display: "grid", gap: "1rem" }} onSubmit={(e) => { e.preventDefault(); save({ kwh_per_gb: Number(form.kwh_per_gb), g_per_kwh: Number(form.g_per_kwh), retention_days: Number(form.retention_days), prune_old: !!form.prune_old, scan_paths: form.scan_paths, auto_scan: form.auto_scan, scan_every: form.scan_every, scan_hour: Number(form.scan_hour), scan_weekday: Number(form.scan_weekday), scan_sites: form.scan_sites }); }}>
        <div><strong>{tx("Rekenmodel")}</strong>
          <p className="muted" style={{ margin: ".25rem 0 0" }}>{tx("De uitstoot is een schatting: het paginagewicht (data) wordt omgerekend naar energie voor de hele keten (servers, netwerk en apparaat) en daarna naar CO2. Het model heet Sustainable Web Design.")}</p></div>
        <div className="grid2">
          <label>{tx("Energie per GB data (kWh)")}<input type="number" step="0.01" min="0.05" max="5" value={form.kwh_per_gb} onChange={(e) => set("kwh_per_gb", e.target.value)} /><small className="muted">{tx("Standaard 0,81")}</small></label>
          <label>{tx("CO2 per kWh (gram)")}<input type="number" step="1" min="10" max="1500" value={form.g_per_kwh} onChange={(e) => set("g_per_kwh", e.target.value)} /><small className="muted">{tx("Standaard 442 (wereldgemiddelde). Gebruik de waarde van het land van je hosting voor een nauwkeuriger cijfer.")}</small></label>
        </div>
        <div><strong>{tx("Automatisch meten")}</strong>
          <p className="muted" style={{ margin: ".25rem 0 0" }}>{tx("De pagina's hieronder worden automatisch gemeten, zonder dat je op Meet nu klikt. Standaard één keer per dag, 's nachts.")}</p></div>
        <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={!!form.auto_scan} onChange={(e) => set("auto_scan", e.target.checked)} /><span /></span><span>{tx("Automatisch meten")}</span></label>
        {form.auto_scan && (
          <>
            <div className="grid2">
              <label>{tx("Hoe vaak")}<select value={form.scan_every} onChange={(e) => set("scan_every", e.target.value)}>
                {[["hourly", "Elk uur"], ["6h", "Elke 6 uur"], ["daily", "Elke dag (standaard)"], ["weekly", "Elke week"]].map(([k, l]) => <option key={k} value={k}>{tx(l)}</option>)}</select></label>
              {["daily", "weekly"].includes(form.scan_every) && <label>{tx("Om hoe laat")}<select value={form.scan_hour} onChange={(e) => set("scan_hour", e.target.value)}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}</select></label>}
              {form.scan_every === "weekly" && <label>{tx("Op welke dag")}<select value={form.scan_weekday} onChange={(e) => set("scan_weekday", e.target.value)}>{["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"].map((n, i) => <option key={i} value={i}>{tx(n)}</option>)}</select></label>}
            </div>
            <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={!!form.scan_sites} onChange={(e) => set("scan_sites", e.target.checked)} /><span /></span><span>{tx("Gekoppelde websites ook uitlezen")} <small className="muted">{tx("Dan wordt het totaalbeeld van alle websites ook bijgewerkt.")}</small></span></label>
          </>
        )}
        {st.last_run_at && <small className={st.last_status === "failed" ? "" : "muted"} style={st.last_status === "failed" ? { color: "var(--danger)" } : undefined}>{tx("Laatst gemeten")}: {when(st.last_run_at)}{st.last_status === "failed" ? ` · ${tx("mislukt")}: ${st.last_error}` : ""}{st.auto_scan && st.next_run ? ` · ${tx("volgende meting")}: ${when(st.next_run)}` : ""}</small>}
        {!st.last_run_at && st.auto_scan && <small className="muted">{tx("De eerste automatische meting volgt binnen een minuut nadat de server draait.")}</small>}
        <div><strong>{tx("Meten")}</strong></div>
        <label>{tx("Pagina's voor \"Meet nu\"")}<textarea rows={4} value={form.scan_paths} onChange={(e) => set("scan_paths", e.target.value)} placeholder={"/\n/prijzen"} /><small className="muted">{tx("Eén pagina per regel, bijvoorbeeld /prijzen. Leeg is de startpagina.")}</small></label>
        <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={!!form.prune_old} onChange={(e) => set("prune_old", e.target.checked)} /><span /></span><span>{tx("Oude metingen opruimen")} <small className="muted">{form.prune_old ? tx("Metingen en scans die ouder zijn dan het aantal dagen hieronder worden verwijderd.") : tx("Uit: alle metingen blijven bewaard, voor de statistiek.")}</small></span></label>
        {form.prune_old && <label>{tx("Metingen bewaren (dagen)")}<input type="number" min="30" max="1100" value={form.retention_days} onChange={(e) => set("retention_days", e.target.value)} style={{ maxWidth: 160 }} /><small className="muted">{tx("De cijfers van het live stroomgebruik (per 10 minuten) worden altijd na 3 dagen opgeruimd; de dagcijfers en scans niet, tenzij je dit aanzet.")}</small></label>}
        <div className="row" style={{ justifyContent: "flex-start" }}><button className="btn primary">{tx("Opslaan")}</button></div>
      </form>

      {showApi && (
        <div className="card" style={{ display: "grid", gap: ".9rem" }}>
          <strong>{tx("API voor andere websites")}</strong>
          <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={st.api_public} onChange={(e) => save({ api_public: e.target.checked })} /><span /></span><span>{tx("Andere websites mogen deze cijfers opvragen")} <small className="muted">{tx("Alleen totalen en cijfers per pagina; niets over bezoekers.")}</small></span></label>
          <div><strong style={{ fontSize: ".9rem" }}>{tx("Sleutel")}</strong> <small className="muted">{st.api_key ? tx("De API vraagt een sleutel (X-Energy-Key of ?key=).") : tx("Geen sleutel: iedereen die het adres kent kan de cijfers opvragen.")}</small>
            <div style={{ display: "flex", gap: ".5rem", marginTop: ".35rem", flexWrap: "wrap", alignItems: "center" }}>
              {st.api_key && <><code style={{ padding: ".5rem .7rem", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 8, overflowWrap: "anywhere" }}>{st.api_key}</code>
                <button type="button" className="btn sm" onClick={async () => { try { await navigator.clipboard.writeText(st.api_key); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* no clipboard */ } }}>{copied ? <><IconCheck /> {tx("Gekopieerd")}</> : tx("Kopiëren")}</button></>}
              <button type="button" className="btn sm" onClick={() => save({ new_key: true }, tx("Nieuwe sleutel gemaakt. Geef hem door aan de website die de cijfers ophaalt."))}>{st.api_key ? tx("Nieuwe sleutel") : tx("Sleutel maken")}</button>
              {st.api_key && <button type="button" className="btn sm danger" onClick={() => save({ api_key: "" }, tx("De sleutel is verwijderd: de API is weer open."))}>{tx("Sleutel verwijderen")}</button>}
            </div></div>
          {st.api_url && <div><strong style={{ fontSize: ".9rem" }}>{tx("Adres van de API van deze website")}</strong> <small className="muted">{tx("Geef dit adres (en de sleutel) door aan de hoofdportal")}</small>
            <div style={{ display: "flex", gap: ".5rem", marginTop: ".35rem", flexWrap: "wrap" }}><code style={{ flex: 1, minWidth: 240, padding: ".5rem .7rem", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 8, overflowWrap: "anywhere" }}>{st.api_url}</code>
              <button type="button" className="btn sm" onClick={async () => { try { await navigator.clipboard.writeText(st.api_url); } catch { /* no clipboard */ } }}>{tx("Kopiëren")}</button></div></div>}
          <small className="muted">{tx("Voorbeeldcode staat bij Admin → Energie → API.")}</small>
        </div>
      )}
    </div>
  );
}
