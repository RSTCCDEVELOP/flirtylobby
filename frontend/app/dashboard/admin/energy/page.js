// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useCallback, useEffect, useState } from "react";
import Tabs from "../../../../components/Tabs";
import EnergyBlock, { fmtBytes, fmtG, fmtN, resetEnergy } from "../../../../components/EnergyBlocks";
import { IconBolt, IconCheck } from "../../../../components/Icons";
import { api, errorText } from "../../../../lib/api";
import { tx } from "../../../../lib/t";

const PERIODS = [7, 30, 90, 365];

function Copy({ text, label }) {
  const [ok, setOk] = useState(false);
  return <button type="button" className="btn sm" onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1800); } catch { /* no clipboard */ } }}>{ok ? <><IconCheck /> {tx("Gekopieerd")}</> : label || tx("Kopiëren")}</button>;
}

const Code = ({ children }) => <pre style={{ margin: 0, padding: ".8rem 1rem", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 10, overflowX: "auto", fontSize: ".8rem", lineHeight: 1.5 }}><code>{children}</code></pre>;

// Admin → Energie: the figures of this website, the API for other websites, the layouts (system objects) and the calculation model.
export default function EnergyAdmin() {
  const [tab, setTab] = useState("overview");
  const [days, setDays] = useState(30);
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState("");
  const [stamp, setStamp] = useState(0);
  const [form, setForm] = useState(null);
  const load = useCallback(() => api(`/admin/energy/?days=${days}`).then((r) => { setD(r); setForm((f) => f || { ...r.settings, scan_paths: r.settings.scan_paths.join("\n") }); }).catch((e) => setMsg({ ok: false, text: errorText(e) })), [days]);
  useEffect(() => { load(); }, [load]);
  const refresh = () => { resetEnergy(); setStamp((x) => x + 1); return load(); };

  const scan = async () => {
    setBusy("scan"); setMsg(null);
    try { const r = await api("/admin/energy/scan/", { method: "POST", body: {} }); await refresh(); setMsg(r.failed?.length ? { ok: false, text: r.failed.map((f) => `${f.path}: ${f.error}`).join(" ") } : { ok: true, text: `${r.scanned} ${tx("pagina's gemeten.")}` }); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); } finally { setBusy(""); }
  };
  const patch = async (body, okText) => {
    try { const r = await api("/admin/energy/settings/", { method: "PATCH", body }); setD((o) => ({ ...o, settings: r })); setForm({ ...r, scan_paths: r.scan_paths.join("\n") }); resetEnergy(); setMsg({ ok: true, text: okText || tx("Opgeslagen.") }); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  };
  const toggleLayout = async (l) => { try { const r = await api("/admin/energy/objects/", { method: "POST", body: { key: l.key, on: !l.on } }); setD((o) => ({ ...o, layouts: r })); } catch (e) { setMsg({ ok: false, text: errorText(e) }); } };

  if (!d) return <p className="muted">{msg ? msg.text : tx("Laden…")}</p>;
  const st = d.settings, ep = d.endpoints;
  const sample = JSON.stringify({ site: d.site, period_days: d.period_days, summary: d.summary, series: d.series.slice(-2), pages: d.pages.slice(0, 2) }, null, 2);
  const embed = `<div id="energie"></div>\n<script>\nfetch("${ep.public}?days=30${st.api_key ? "&key=JOUW_SLEUTEL" : ""}")\n  .then((r) => r.json())\n  .then((d) => {\n    document.getElementById("energie").textContent =\n      "Paginagewicht " + (d.summary.avg_page_bytes / 1e6).toFixed(2) + " MB, " +\n      d.summary.avg_co2_g.toFixed(2) + " g CO2 per paginabezoek";\n  });\n</script>`;

  return (
    <>
      <div className="page-head"><div><h1>{tx("Energie & uitstoot")}</h1>
        <p className="muted" style={{ margin: 0 }}>{tx("Hoeveel data de pagina's versturen en wat dat aan energie en CO2 kost: gemeten bij bezoekers en met een scan, te tonen op je website en via een API te koppelen aan andere websites.")}</p></div></div>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}
      <Tabs value={tab} onChange={setTab} tabs={[["overview", "Overzicht", <IconBolt key="o" />], ["api", "API"], ["layouts", "Weergaven", null, d.layouts.filter((l) => l.on).length], ["settings", "Instellingen"]]} />

      {tab === "overview" && (
        <div style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: ".8rem" }}>
            <span className="pb-seg">{PERIODS.map((p) => <button type="button" key={p} className={days === p ? "on" : ""} onClick={() => setDays(p)}>{p} {tx("dagen")}</button>)}</span>
            <span style={{ display: "flex", alignItems: "center", gap: ".7rem", flexWrap: "wrap" }}>
              {busy === "scan" && <small className="muted">{tx("De pagina's worden gemeten… dit kan een halve minuut duren.")}</small>}
              <button type="button" className="btn primary" disabled={!!busy} onClick={scan}><IconBolt /> {busy === "scan" ? tx("Bezig met meten…") : tx("Meet nu")}</button>
            </span>
          </div>
          {busy === "scan" && <div style={{ height: 6, background: "var(--line)", borderRadius: 99, overflow: "hidden" }}><i style={{ display: "block", width: "40%", height: "100%", background: "var(--blue)", borderRadius: 99, animation: "enscan 1.3s ease-in-out infinite alternate" }} /><style>{"@keyframes enscan{from{margin-left:0}to{margin-left:60%}}"}</style></div>}
          <EnergyBlock key={`${stamp}-${days}`} layout="overview" days={days} />
          {d.scans.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: ".9rem 1.1rem .3rem" }}><strong>{tx("Metingen door de server (scan)")}</strong><small className="muted" style={{ display: "block" }}>{tx("De server opent de pagina zoals een browser en telt alle bestanden van je eigen website die erbij horen. Op een testomgeving zijn de bestanden groter dan op de echte website.")}</small></div>
              <div className="table-wrap"><table>
                <thead><tr><th>{tx("Pagina")}</th><th>{tx("Totaal")}</th><th>{tx("Verzoeken")}</th><th>{tx("Uitstoot")}</th><th>HTML</th><th>{tx("Scripts")}</th><th>{tx("Stijlen")}</th><th>{tx("Afbeeldingen")}</th><th>{tx("Lettertypen")}</th><th>{tx("Datum")}</th></tr></thead>
                <tbody>{d.scans.map((s) => <tr key={s.path}><td>{s.path === "/" ? tx("Startpagina") : s.path}</td><td><b>{fmtBytes(s.bytes)}</b></td><td>{fmtN(s.requests)}</td><td>{fmtG(s.co2_g)}</td>
                  {["html", "script", "style", "image", "font"].map((k) => <td key={k}>{fmtBytes(s.breakdown?.[k] || 0)}</td>)}<td>{new Date(s.at).toLocaleString()}</td></tr>)}</tbody>
              </table></div>
            </div>
          )}
        </div>
      )}

      {tab === "api" && (
        <div style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
          <div className="card" style={{ display: "grid", gap: ".9rem" }}>
            <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={st.api_public} onChange={(e) => patch({ api_public: e.target.checked })} /><span /></span><span>{tx("Andere websites mogen deze cijfers opvragen")} <small className="muted">{tx("Alleen totalen en cijfers per pagina; niets over bezoekers.")}</small></span></label>
            <div><strong>{tx("Adres van de API")}</strong>
              <div style={{ display: "flex", gap: ".5rem", marginTop: ".35rem", flexWrap: "wrap" }}><code style={{ flex: 1, minWidth: 240, padding: ".5rem .7rem", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 8, overflowWrap: "anywhere" }}>{ep.public}</code><Copy text={ep.public} /></div>
              <small className="muted" style={{ display: "block", marginTop: ".3rem" }}>{tx("Met ?days=7, 30, 90 of 365 kies je de periode. De verzamelmodule van een andere website (Super admin → Energie) leest dit adres uit.")}</small></div>
            <div><strong>{tx("Sleutel")}</strong> <small className="muted">{st.api_key ? tx("De API vraagt een sleutel (X-Energy-Key of ?key=).") : tx("Geen sleutel: iedereen die het adres kent kan de cijfers opvragen.")}</small>
              <div style={{ display: "flex", gap: ".5rem", marginTop: ".35rem", flexWrap: "wrap", alignItems: "center" }}>
                {st.api_key && <><code style={{ padding: ".5rem .7rem", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 8, overflowWrap: "anywhere" }}>{st.api_key}</code><Copy text={st.api_key} /></>}
                <button type="button" className="btn sm" onClick={() => patch({ new_key: true }, tx("Nieuwe sleutel gemaakt. Geef hem door aan de website die de cijfers ophaalt."))}>{st.api_key ? tx("Nieuwe sleutel") : tx("Sleutel maken")}</button>
                {st.api_key && <button type="button" className="btn sm danger" onClick={() => patch({ api_key: "" }, tx("De sleutel is verwijderd: de API is weer open."))}>{tx("Sleutel verwijderen")}</button>}
              </div></div>
          </div>
          <div className="card" style={{ display: "grid", gap: ".8rem" }}>
            <strong>{tx("Voorbeeld")}</strong>
            <Code>{`curl "${ep.public}?days=30"${st.api_key ? ` -H "X-Energy-Key: ${st.api_key}"` : ""}`}</Code>
            <Code>{sample}</Code>
            <strong>{tx("Op een andere website tonen")}</strong>
            <small className="muted">{tx("De API mag vanuit elke website in de browser worden opgevraagd. Zo toon je de cijfers van deze website bijvoorbeeld op je hoofdwebsite:")}</small>
            <Code>{embed}</Code>
            <Copy text={embed} label={tx("Code kopiëren")} />
          </div>
          <div className="card" style={{ display: "grid", gap: ".4rem" }}>
            <strong>{tx("Velden")}</strong>
            <div className="table-wrap"><table><tbody>
              {[["summary.avg_page_bytes", "Gemiddeld paginagewicht in bytes"], ["summary.avg_requests", "Gemiddeld aantal verzoeken per pagina"], ["summary.avg_co2_g", "Geschatte uitstoot per paginabezoek in gram CO2"], ["summary.rating", "Label A+ tot F"], ["summary.views / total_kwh / total_co2_kg", "Aantal paginabezoeken en totalen"], ["series[]", "Per dag: views, avg_bytes, avg_requests, avg_co2_g, co2_g"], ["pages[]", "Per pagina: path, views, avg_bytes, avg_requests, avg_co2_g"], ["scans[]", "Meting door de server per pagina, met de verdeling per soort bestand"], ["benchmark", "Een gemiddelde webpagina om mee te vergelijken"], ["model", "De rekenwaarden (kWh per GB, gram CO2 per kWh)"]].map(([k, v]) => <tr key={k}><td><code>{k}</code></td><td>{tx(v)}</td></tr>)}
            </tbody></table></div>
          </div>
        </div>
      )}

      {tab === "layouts" && (
        <div style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
          <p className="muted" style={{ margin: 0 }}>{tx("Elke weergave is een systeemobject dat je in de bewerkmodus op een pagina zet. Zet uit wat je niet wilt aanbieden.")}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: "1rem" }}>
            {d.layouts.map((l) => (
              <div key={l.key} className="card" style={{ display: "grid", gap: ".7rem", alignContent: "start" }}>
                <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={l.on} onChange={() => toggleLayout(l)} /><span /></span><span><strong>{tx(l.label)}</strong> <small className="muted" style={{ display: "block" }}>{tx(l.desc)}</small></span></label>
                <small className="muted">{tx("Naam op de pagina")}: <code>{l.slug}</code></small>
                {l.on && <div style={{ border: "1px dashed var(--line)", borderRadius: 12, padding: ".7rem", overflow: "hidden" }}><EnergyBlock key={`${stamp}-${l.key}`} layout={l.key} days={days} /></div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "settings" && form && (
        <form className="card form" style={{ marginTop: "1rem", display: "grid", gap: "1rem", maxWidth: 760 }} onSubmit={(e) => { e.preventDefault(); patch({ kwh_per_gb: Number(form.kwh_per_gb), g_per_kwh: Number(form.g_per_kwh), retention_days: Number(form.retention_days), scan_paths: form.scan_paths }); }}>
          <p className="muted" style={{ margin: 0 }}>{tx("De uitstoot is een schatting: het paginagewicht (data) wordt omgerekend naar energie voor de hele keten (servers, netwerk en apparaat) en daarna naar CO2. Het model heet Sustainable Web Design.")}</p>
          <div className="grid2">
            <label>{tx("Energie per GB data (kWh)")}<input type="number" step="0.01" min="0.05" max="5" value={form.kwh_per_gb} onChange={(e) => setForm({ ...form, kwh_per_gb: e.target.value })} /><small className="muted">{tx("Standaard 0,81")}</small></label>
            <label>{tx("CO2 per kWh (gram)")}<input type="number" step="1" min="10" max="1500" value={form.g_per_kwh} onChange={(e) => setForm({ ...form, g_per_kwh: e.target.value })} /><small className="muted">{tx("Standaard 442 (wereldgemiddelde). Gebruik de waarde van het land van je hosting voor een nauwkeuriger cijfer.")}</small></label>
          </div>
          <label>{tx("Pagina's voor \"Meet nu\"")}<textarea rows={4} value={form.scan_paths} onChange={(e) => setForm({ ...form, scan_paths: e.target.value })} placeholder={"/\n/prijzen"} /><small className="muted">{tx("Eén pagina per regel, bijvoorbeeld /prijzen. Leeg is de startpagina.")}</small></label>
          <label>{tx("Metingen bewaren (dagen)")}<input type="number" min="30" max="1100" value={form.retention_days} onChange={(e) => setForm({ ...form, retention_days: e.target.value })} style={{ maxWidth: 160 }} /></label>
          <div className="row" style={{ justifyContent: "flex-start" }}><button className="btn primary">{tx("Opslaan")}</button></div>
        </form>
      )}
    </>
  );
}
