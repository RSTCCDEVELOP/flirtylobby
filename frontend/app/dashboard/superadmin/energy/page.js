// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useCallback, useEffect, useState } from "react";
import Tabs from "../../../../components/Tabs";
import { NetworkView } from "../../../../components/EnergyBlocks";
import { IconBolt, IconCheck, IconTrash } from "../../../../components/Icons";
import { api, errorText } from "../../../../lib/api";
import { confirmDialog } from "../../../../lib/dialog";
import { tx } from "../../../../lib/t";

const Code = ({ children }) => <pre style={{ margin: 0, padding: ".8rem 1rem", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 10, overflowX: "auto", fontSize: ".8rem", lineHeight: 1.5 }}><code>{children}</code></pre>;

function Copy({ text }) {
  const [ok, setOk] = useState(false);
  return <button type="button" className="btn sm" onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1800); } catch { /* no clipboard */ } }}>{ok ? <><IconCheck /> {tx("Gekopieerd")}</> : tx("Kopiëren")}</button>;
}

const ago = (iso) => { if (!iso) return tx("nog niet gelezen"); const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 1 ? tx("zojuist") : m < 60 ? `${m} ${tx("min. geleden")}` : m < 1440 ? `${Math.round(m / 60)} ${tx("uur geleden")}` : new Date(iso).toLocaleDateString(); };

// Super admin → Energie: the collector. It reads the energy API of all connected websites and shows the total picture.
export default function EnergyNetwork() {
  const [tab, setTab] = useState("overview");
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState("");
  const [add, setAdd] = useState({ name: "", url: "", api_key: "" });
  const [edit, setEdit] = useState(null);
  const load = useCallback(() => api("/super/energy/").then(setD).catch((e) => setMsg({ ok: false, text: errorText(e) })), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { // sites that were not read for an hour are read when this screen opens
    if (!d || busy) return;
    if (d.sites_admin.some((s) => s.enabled && (!s.fetched || Date.now() - new Date(s.fetched) > 3600000))) refresh();
  }, [d?.sites_admin?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = async (id) => {
    setBusy("refresh" + (id || "")); setMsg(null);
    try { setD(await api("/super/energy/refresh/", { method: "POST", body: id ? { id } : {} })); } catch (e) { setMsg({ ok: false, text: errorText(e) }); } finally { setBusy(""); }
  };
  const addSite = async (e) => {
    e.preventDefault(); setBusy("add"); setMsg(null);
    try { const s = await api("/super/energy/sites/", { method: "POST", body: add }); setAdd({ name: "", url: "", api_key: "" }); await load(); setMsg(s.ok ? { ok: true, text: `${s.name}: ${tx("gelezen.")}` } : { ok: false, text: `${s.name}: ${s.error}` }); }
    catch (x) { setMsg({ ok: false, text: errorText(x) }); } finally { setBusy(""); }
  };
  const saveEdit = async () => { try { await api(`/super/energy/sites/${edit.id}/`, { method: "PATCH", body: { name: edit.name, url: edit.url, ...(edit.api_key !== undefined && edit.api_key !== "" ? { api_key: edit.api_key } : {}) } }); setEdit(null); await load(); } catch (x) { setMsg({ ok: false, text: errorText(x) }); } };
  const toggle = async (s) => { await api(`/super/energy/sites/${s.id}/`, { method: "PATCH", body: { enabled: !s.enabled } }).catch(() => {}); load(); };
  const remove = async (s) => { if (!(await confirmDialog(tx("Deze website uit het totaalbeeld halen?"), { danger: true, title: tx("Website verwijderen"), okLabel: tx("Verwijderen") }))) return; await api(`/super/energy/sites/${s.id}/`, { method: "DELETE" }).catch(() => {}); load(); };
  const publish = async (body) => { try { const r = await api("/super/energy/settings/", { method: "POST", body }); setD((o) => ({ ...o, settings: r })); setMsg({ ok: true, text: tx("Opgeslagen.") }); } catch (x) { setMsg({ ok: false, text: errorText(x) }); } };

  if (!d) return <p className="muted">{msg ? msg.text : tx("Laden…")}</p>;
  const snippet = `fetch("${d.endpoint}")\n  .then((r) => r.json())\n  .then((n) => {\n    // n.totals: avg_page_bytes, avg_requests, avg_co2_g, total_co2_kg, views\n    // n.sites[]: een regel per website\n    console.log(n.title, n.totals);\n  });`;

  return (
    <>
      <div className="page-head"><div><h1>{tx("Energie: totaalbeeld")}</h1>
        <p className="muted" style={{ margin: 0 }}>{tx("De verzamelmodule leest de energie-API van alle gekoppelde websites uit en toont samen het paginagewicht, het aantal verzoeken en de geschatte uitstoot.")}</p></div>
        <button type="button" className="btn primary" disabled={!!busy} onClick={() => refresh()}><IconBolt /> {busy.startsWith("refresh") ? tx("Bezig met lezen…") : tx("Alles verversen")}</button></div>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}
      <Tabs value={tab} onChange={setTab} tabs={[["overview", "Overzicht", <IconBolt key="o" />], ["sites", "Websites", null, d.sites_admin.length], ["publish", "Publiceren"]]} />

      {tab === "overview" && <div style={{ marginTop: "1rem" }}><NetworkView n={d} /></div>}

      {tab === "sites" && (
        <div style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
          <form className="card form" onSubmit={addSite} style={{ display: "grid", gap: ".8rem" }}>
            <strong>{tx("Website koppelen")}</strong>
            <p className="muted" style={{ margin: 0 }}>{tx("Vul het adres van de website in (de energie-API staat op /api/energy/public/ van het API-adres) en, als die website een sleutel vraagt, die sleutel.")}</p>
            <div className="grid2">
              <label>{tx("Naam")}<input required value={add.name} maxLength={120} onChange={(e) => setAdd({ ...add, name: e.target.value })} placeholder="Hebbes Fashion" /></label>
              <label>{tx("Adres van de website of van de API")}<input required value={add.url} onChange={(e) => setAdd({ ...add, url: e.target.value })} placeholder="https://api.voorbeeld.nl" /></label>
              <label>{tx("Sleutel")} <small className="muted">{tx("optioneel")}</small><input value={add.api_key} onChange={(e) => setAdd({ ...add, api_key: e.target.value })} autoComplete="off" /></label>
            </div>
            <div className="row" style={{ justifyContent: "flex-start" }}><button className="btn primary" disabled={!!busy}>{busy === "add" ? tx("Bezig met lezen…") : tx("Koppelen en lezen")}</button></div>
          </form>
          {d.sites_admin.length === 0 && <p className="muted">{tx("Nog geen websites gekoppeld. Dit is nu alleen het cijfer van deze website.")}</p>}
          {d.sites_admin.map((s) => (
            <div key={s.id} className="card" style={{ display: "grid", gap: ".6rem", opacity: s.enabled ? 1 : .6 }}>
              {edit?.id === s.id ? (
                <div className="grid2">
                  <label>{tx("Naam")}<input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
                  <label>{tx("Adres")}<input value={edit.url} onChange={(e) => setEdit({ ...edit, url: e.target.value })} /></label>
                  <label>{tx("Nieuwe sleutel")} <small className="muted">{s.api_key ? tx("leeg laten = niet wijzigen") : tx("optioneel")}</small><input value={edit.api_key || ""} onChange={(e) => setEdit({ ...edit, api_key: e.target.value })} autoComplete="off" /></label>
                  <div className="row" style={{ alignItems: "end", justifyContent: "flex-start" }}><button type="button" className="btn primary" onClick={saveEdit}>{tx("Opslaan")}</button><button type="button" className="btn" onClick={() => setEdit(null)}>{tx("Annuleren")}</button></div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: ".8rem", alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ flex: 1, minWidth: 220 }}><strong>{s.name}</strong> <span className={s.ok ? "badge ok" : "badge off"}>{s.ok ? tx("Gelezen") : tx("Fout")}</span>
                    <small className="muted" style={{ display: "block", overflowWrap: "anywhere" }}>{s.url}{s.api_key ? ` · ${tx("met sleutel")}` : ""} · {ago(s.fetched)}</small>
                    {!s.ok && s.error && <small style={{ display: "block", color: "var(--danger)" }}>{s.error}</small>}</span>
                  <button type="button" className="btn sm" disabled={!!busy} onClick={() => refresh(s.id)}>{busy === `refresh${s.id}` ? tx("Bezig…") : tx("Verversen")}</button>
                  <label className="check sec-toggle" style={{ margin: 0 }}><span className="switch"><input type="checkbox" checked={s.enabled} onChange={() => toggle(s)} /><span /></span><span>{tx("Meetellen")}</span></label>
                  <button type="button" className="btn sm" onClick={() => setEdit({ id: s.id, name: s.name, url: s.url, api_key: "" })}>{tx("Wijzigen")}</button>
                  <button type="button" className="btn sm danger" aria-label={tx("Verwijderen")} onClick={() => remove(s)}><IconTrash /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "publish" && (
        <div style={{ display: "grid", gap: "1rem", marginTop: "1rem", maxWidth: 860 }}>
          <div className="card" style={{ display: "grid", gap: ".9rem" }}>
            <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={d.settings.network_public} onChange={(e) => publish({ network_public: e.target.checked })} /><span /></span><span>{tx("Het totaalbeeld publiceren")} <small className="muted">{tx("Dan kan het totaalbeeld als systeemobject (Admin → Energie → Weergaven → Alle websites samen) op een pagina worden gezet en via de API worden opgevraagd. Alleen namen, adressen en cijfers; geen sleutels of foutmeldingen.")}</small></span></label>
            <label>{tx("Titel")}<input defaultValue={d.settings.network_title} maxLength={120} onBlur={(e) => e.target.value !== d.settings.network_title && publish({ network_title: e.target.value })} placeholder={tx("Alle websites samen")} /></label>
            <div><strong>{tx("Adres van het totaalbeeld")}</strong>
              <div style={{ display: "flex", gap: ".5rem", marginTop: ".35rem", flexWrap: "wrap" }}><code style={{ flex: 1, minWidth: 240, padding: ".5rem .7rem", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 8, overflowWrap: "anywhere" }}>{d.endpoint}</code><Copy text={d.endpoint} /></div></div>
          </div>
          <div className="card" style={{ display: "grid", gap: ".6rem" }}>
            <strong>{tx("Gebruik")}</strong>
            <Code>{snippet}</Code>
            <small className="muted">{tx("Laat de websites regelmatig uitlezen met")} <code>python manage.py energy_collect</code> ({tx("bijvoorbeeld elke nacht via cron")}). {tx("Ook wanneer je dit scherm opent worden websites die een uur niet zijn gelezen vanzelf ververst.")}</small>
          </div>
        </div>
      )}
    </>
  );
}
