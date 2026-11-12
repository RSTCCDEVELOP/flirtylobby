// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Tabs from "./Tabs";
import { NetworkView } from "./EnergyBlocks";
import { IconBolt, IconCheck, IconTrash } from "./Icons";
import { api, errorText } from "../lib/api";
import { confirmDialog } from "../lib/dialog";
import { tx } from "../lib/t";

const Code = ({ children }) => <pre style={{ margin: 0, padding: ".8rem 1rem", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 10, overflowX: "auto", fontSize: ".8rem", lineHeight: 1.5 }}><code>{children}</code></pre>;

function Copy({ text }) {
  const [ok, setOk] = useState(false);
  return <button type="button" className="btn sm" onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1800); } catch { /* no clipboard */ } }}>{ok ? <><IconCheck /> {tx("Gekopieerd")}</> : tx("Kopiëren")}</button>;
}

const ago = (iso) => { if (!iso) return tx("nog niet gelezen"); const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 1 ? tx("zojuist") : m < 60 ? `${m} ${tx("min. geleden")}` : m < 1440 ? `${Math.round(m / 60)} ${tx("uur geleden")}` : new Date(iso).toLocaleDateString(); };

// The popup to link a website (or to change a linked one): name, address of the API and key; the other tab says where to find them.
function SitePopup({ site, onClose, onSaved }) {
  const [tab, setTab] = useState("link");
  const [f, setF] = useState({ name: site?.name || "", url: site?.url || "", api_key: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { const k = (e) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }, [onClose]);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const r = site
        ? await api(`/super/energy/sites/${site.id}/`, { method: "PATCH", body: { name: f.name, url: f.url, ...(f.api_key ? { api_key: f.api_key } : {}) } })
        : await api("/super/energy/sites/", { method: "POST", body: f });
      onSaved(r);
    } catch (x) { setErr(errorText(x)); setBusy(false); }
  };
  return createPortal(
    <div className="pb-objback" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pb-objpop" role="dialog" aria-label={tx("Website koppelen")} style={{ width: "min(620px, 94vw)", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div className="pb-objhead"><strong>{site ? tx("Website wijzigen") : tx("Website koppelen")}</strong><span style={{ flex: 1 }} /><button type="button" className="pb-panelx" onClick={onClose} aria-label={tx("Sluiten")}>×</button></div>
        <div style={{ padding: "1rem 1.3rem 1.3rem", overflowY: "auto", display: "grid", gap: ".9rem" }}>
          <Tabs value={tab} onChange={setTab} tabs={[["link", "Gegevens"], ["help", "Waar vind ik dit?"]]} />
          {tab === "link" && (
            <form className="form" onSubmit={submit} style={{ display: "grid", gap: ".9rem" }}>
              {err && <div className="alert">{err}</div>}
              <label>{tx("Naam")}<input required autoFocus value={f.name} maxLength={120} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Hebbes Fashion" /></label>
              <label>{tx("Adres van de API")}<input required value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://localhost:8000/api/energy/public/" /><small className="muted">{tx("Het adres van de website of van de API mag ook.")}</small></label>
              <label>{tx("Sleutel")} <small className="muted">{site?.api_key ? tx("leeg laten = niet wijzigen") : tx("optioneel")}</small><input value={f.api_key} onChange={(e) => setF({ ...f, api_key: e.target.value })} autoComplete="off" placeholder={tx("de sleutel van die website")} /></label>
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <button type="button" className="btn" onClick={onClose}>{tx("Annuleren")}</button>
                <button className="btn primary" disabled={busy}><IconBolt /> {busy ? tx("Bezig met lezen…") : site ? tx("Opslaan en lezen") : tx("Koppelen en lezen")}</button>
              </div>
            </form>
          )}
          {tab === "help" && (
            <div style={{ display: "grid", gap: ".6rem" }} className="muted">
              <p style={{ margin: 0 }}>{tx("Plak het adres van de energie-API van de andere website, bijvoorbeeld https://localhost:8000/api/energy/public/, en de sleutel als die website er een vraagt.")}</p>
              <p style={{ margin: 0 }}>{tx("Je vindt beide bij Super admin → Green metingen → Deze site van die website, of in zijn Info-venster → Green.")}</p>
              <p style={{ margin: 0 }}>{tx("Na het koppelen wordt de website meteen uitgelezen. Staat er een fout bij, dan kun je het adres of de sleutel wijzigen.")}</p>
            </div>
          )}
        </div>
      </div>
    </div>, document.body);
}

// The collector: the websites whose energy API is read (address + key), the combined figures of all of them, and publishing the total picture (the system object "Alle websites samen").
export default function EnergyNetworkPanel() {
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState("");
  const [popup, setPopup] = useState(null); // null: closed, {}: link a new website, a site: change it
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
  const saved = async (s) => { setPopup(null); await load(); setMsg(s.ok ? { ok: true, text: `${s.name}: ${s.self_site ? tx("gelezen. Dit is deze website zelf: hij telt niet dubbel mee in het totaal.") : tx("gelezen.")}` } : { ok: false, text: `${s.name}: ${s.error}` }); };
  const toggle = async (s) => { await api(`/super/energy/sites/${s.id}/`, { method: "PATCH", body: { enabled: !s.enabled } }).catch(() => {}); load(); };
  const remove = async (s) => { if (!(await confirmDialog(tx("Deze website uit het totaalbeeld halen?"), { danger: true, title: tx("Website verwijderen"), okLabel: tx("Verwijderen") }))) return; await api(`/super/energy/sites/${s.id}/`, { method: "DELETE" }).catch(() => {}); load(); };
  const publish = async (body) => { try { const r = await api("/super/energy/settings/", { method: "POST", body }); setD((o) => ({ ...o, settings: r })); setMsg({ ok: true, text: tx("Opgeslagen.") }); } catch (x) { setMsg({ ok: false, text: errorText(x) }); } };

  if (!d) return <p className="muted">{msg ? msg.text : tx("Laden…")}</p>;
  const snippet = `fetch("${d.endpoint}")\n  .then((r) => r.json())\n  .then((n) => {\n    // n.totals: avg_page_bytes, avg_requests, avg_co2_g, total_co2_kg, views\n    // n.sites[]: een regel per website\n    console.log(n.title, n.totals);\n  });`;

  return (
    <div style={{ display: "grid", gap: "1.1rem" }}>
      {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
      {popup && <SitePopup key={popup.id || "new"} site={popup.id ? popup : null} onClose={() => setPopup(null)} onSaved={saved} />}

      <div className="card" style={{ display: "grid", gap: ".7rem" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: ".6rem" }}>
          <strong>{tx("Gekoppelde websites")} <span className="dw-count" style={{ fontSize: ".75rem", fontWeight: 600, color: "var(--muted)", marginLeft: ".3rem" }}>{d.sites_admin.length}</span></strong>
          <span style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
            <button type="button" className="btn sm" disabled={!!busy || !d.sites_admin.length} onClick={() => refresh()}>{busy === "refresh" ? tx("Bezig met lezen…") : tx("Alles verversen")}</button>
            <button type="button" className="btn primary sm" onClick={() => setPopup({})}><IconBolt /> {tx("Website koppelen")}</button>
          </span>
        </div>
        {d.sites_admin.length === 0 && <p className="muted" style={{ margin: 0 }}>{tx("Nog geen websites gekoppeld. Klik op Website koppelen: je plakt het adres van de API en de sleutel. Het totaalbeeld hieronder is nu alleen deze website.")}</p>}
        {d.sites_admin.map((s) => (
          <div key={s.id} style={{ borderTop: "1px solid var(--line)", paddingTop: ".7rem", opacity: s.enabled ? 1 : .55 }}>
            {(
              <div style={{ display: "flex", gap: ".8rem", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ flex: 1, minWidth: 220 }}><strong>{s.name}</strong> <span className={s.ok ? "badge ok" : "badge off"}>{s.ok ? tx("Gelezen") : tx("Fout")}</span>{s.self_site && <span className="badge" title={tx("Dit is deze website zelf: hij telt niet dubbel mee")}>{tx("deze website zelf")}</span>}
                  <small className="muted" style={{ display: "block", overflowWrap: "anywhere" }}>{s.url}{s.api_key ? ` · ${tx("met sleutel")}` : ""} · {ago(s.fetched)}</small>
                  {s.ok && s.summary?.avg_page_bytes > 0 && <small className="muted" style={{ display: "block" }}>{Math.round(s.summary.avg_page_bytes / 1000).toLocaleString()} KB · {s.summary.avg_requests} {tx("verzoeken")} · {s.summary.avg_co2_g} g CO2 · {(s.summary.views || 0).toLocaleString()} {tx("bezoeken")}</small>}
                  {!s.ok && s.error && <small style={{ display: "block", color: "var(--danger)" }}>{s.error}</small>}</span>
                <button type="button" className="btn sm" disabled={!!busy} onClick={() => refresh(s.id)}>{busy === `refresh${s.id}` ? tx("Bezig…") : tx("Verversen")}</button>
                <label className="check sec-toggle" style={{ margin: 0 }}><span className="switch"><input type="checkbox" checked={s.enabled} onChange={() => toggle(s)} /><span /></span><span>{tx("Meetellen")}</span></label>
                <button type="button" className="btn sm" onClick={() => setPopup(s)}>{tx("Wijzigen")}</button>
                <button type="button" className="btn sm danger" aria-label={tx("Verwijderen")} onClick={() => remove(s)}><IconTrash /></button>
              </div>
            )}
          </div>
        ))}
      </div>

      <NetworkView n={d} />

      <div className="card" style={{ display: "grid", gap: ".9rem" }}>
        <strong>{tx("Totaalbeeld tonen en publiceren")}</strong>
        <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={d.settings.network_public} onChange={(e) => publish({ network_public: e.target.checked })} /><span /></span><span>{tx("Het totaalbeeld publiceren")} <small className="muted">{tx("Dan kan het totaalbeeld als systeemobject (Admin → Energie → Weergaven → Alle websites samen) op een pagina worden gezet en via de API worden opgevraagd. Alleen namen, adressen en cijfers; geen sleutels of foutmeldingen.")}</small></span></label>
        <label>{tx("Titel")}<input defaultValue={d.settings.network_title} maxLength={120} onBlur={(e) => e.target.value !== d.settings.network_title && publish({ network_title: e.target.value })} placeholder={tx("Alle websites samen")} /></label>
        <div><strong style={{ fontSize: ".9rem" }}>{tx("Adres van het totaalbeeld")}</strong>
          <div style={{ display: "flex", gap: ".5rem", marginTop: ".35rem", flexWrap: "wrap" }}><code style={{ flex: 1, minWidth: 240, padding: ".5rem .7rem", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 8, overflowWrap: "anywhere" }}>{d.endpoint}</code><Copy text={d.endpoint} /></div></div>
        <Code>{snippet}</Code>
        <small className="muted">{tx("Laat de websites regelmatig uitlezen met")} <code>python manage.py energy_collect</code> ({tx("bijvoorbeeld elke nacht via cron")}). {tx("Ook wanneer je dit scherm opent worden websites die een uur niet zijn gelezen vanzelf ververst.")}</small>
      </div>
    </div>
  );
}
