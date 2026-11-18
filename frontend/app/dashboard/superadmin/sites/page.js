// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconCheck, IconEdit, IconEye, IconGlobe, IconKey, IconRefresh, IconSettings, IconTrash } from "../../../../components/Icons";
import { SiteMaintenance, SiteOnline, SiteView } from "../../../../components/SiteDetails";
import Tabs from "../../../../components/Tabs";
import Loading from "../../../../components/Loading";
import PlusLock from "../../../../components/PlusLock";
import { useAuth } from "../../../../components/AuthContext";
import { api, errorText } from "../../../../lib/api";
import { confirmDialog } from "../../../../lib/dialog";
import { SOURCE_TEXT } from "../../../../lib/sourceNotice";
import { tx } from "../../../../lib/t";

const when = (v) => (v ? new Date(v).toLocaleString() : "–");

// Super admin+ -> Site manager: the easy2edit websites. Every website reports itself to the easy2edit server the first time and at every login of an administrator;
// the installation that is the server shows the list here.
export default function SiteManager() {
  const { user } = useAuth();
  const plus = !!user?.is_superadmin_plus;
  const [data, setData] = useState(null);  // {me, sites}
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState("");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState(null);
  const [view, setView] = useState(null);  // the website whose information is shown (asked through its API)
  const load = useCallback(() => api("/system/sites/").then(setData).catch((e) => setMsg({ ok: false, text: errorText(e) })), []);
  useEffect(() => { if (plus) load(); }, [plus, load]);
  // this website as a client (not the server): is it connected? A live check when the page opens, and on request.
  const [check, setCheck] = useState(null);  // {state: connected | pending | refused | disabled | offline | disconnected, error}
  const [checking, setChecking] = useState(false);
  const runCheck = useCallback(async () => {
    setChecking(true);
    try { const r = await api("/system/sites/", { method: "POST", body: { action: "check" } }); setCheck(r.check); setData((d) => (d ? { ...d, me: r.me } : d)); }
    catch (e) { setCheck({ state: "offline", error: errorText(e) }); }
    setChecking(false);
  }, []);
  const checked = useRef(false);
  useEffect(() => { if (plus && data && !data.me.server && !checked.current) { checked.current = true; runCheck(); } }, [plus, data, runCheck]);
  if (!plus) return <p className="muted">{tx("Dit onderdeel is alleen voor een superadmin+.")} <PlusLock /></p>;
  if (!data) return msg ? <div className="alert">{msg.text}</div> : <Loading fill />;
  const { me, sites } = data;
  const act = async (body, ok) => {
    setBusy(body.action); setMsg(null);
    try { setData(await api("/system/sites/", { method: "POST", body })); setMsg({ ok: true, text: ok }); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); await load(); }
    setBusy("");
  };
  const disconnect = async () => {
    if (!(await confirmDialog(tx("Deze website ontkoppelen van de easy2edit-server? Hij meldt zich niet meer aan, krijgt geen bibliotheek of sleutels meer en de server kan hem niet meer opvragen. Je kunt later weer verbinden."), { danger: true, okLabel: tx("Ontkoppelen") }))) return;
    setCheck(null);
    await act({ action: "disconnect" }, tx("Deze website is ontkoppeld van de easy2edit-server."));
  };
  const activate = async () => { await act({ action: "activate" }, tx("De verbinding is geactiveerd via de API.")); runCheck(); };
  const connect = async () => { await act({ action: "connect" }, tx("Gemeld bij de easy2edit-server.")); runCheck(); };
  const save = async () => {
    setBusy("edit");
    try {
      const r = await api(`/system/sites/${edit.id}/`, { method: "PATCH", body: { name: edit.name, url: edit.url, notes: edit.notes, status: edit.status, block_message: edit.block_message || "" } });
      await load();
      if (r.offline && r.offline.ok === false) { setEdit((x) => ({ ...x, error: tx("Opgeslagen, maar de website kon niet via zijn API offline of online worden gezet: {0}. Hij volgt bij zijn volgende melding.", r.offline.detail || r.offline.reason) })); }  // blocked / released: the website is switched through its API
      else { if (r.offline?.ok) setMsg({ ok: true, text: r.status === "blocked" ? tx("Geblokkeerd en offline gezet met een melding.") : tx("Vrijgegeven en weer online gezet.") }); setEdit(null); }
    } catch (e) { setEdit((x) => ({ ...x, error: errorText(e) })); }
    setBusy("");
  };
  const approve = async (s) => {
    try { await api(`/system/sites/${s.id}/`, { method: "PATCH", body: { status: "active" } }); await load(); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  };
  const remove = async (s) => {
    if (!(await confirmDialog(tx("{0} uit de lijst verwijderen? De website zelf blijft bestaan en meldt zich bij het volgende inloggen opnieuw.", s.name || s.url), { danger: true, okLabel: tx("Verwijderen") }))) return;
    try { await api(`/system/sites/${s.id}/`, { method: "DELETE" }); await load(); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  };
  const list = sites.filter((s) => !q.trim() || `${s.name} ${s.url} ${s.ip || ""} ${s.seen_ip || ""}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <>
      <h1>{tx("Site manager")}<PlusLock /></h1>
      <p className="muted">{tx("Elke easy2edit-website meldt zich de eerste keer bij de easy2edit-server en daarna bij elke keer dat een beheerder, superadmin of superadmin+ inlogt. De server houdt de lijst bij.")}</p>
      {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}

      <div className="card" style={{ display: "grid", gap: "1.1rem", marginBottom: "1rem" }}>
        <div className="sm-top">
          <div style={{ display: "grid", gap: ".6rem", alignContent: "start", minWidth: 0 }}>
        <strong>{tx("Deze website")}</strong>
        {me.server ? (
          <small className="muted">{tx("Meldt zich bij")} <code>{me.api_url}</code> · {me.last_ok_at ? `${tx("laatste melding")} ${when(me.last_ok_at)}` : tx("nog niet gemeld")}</small>
        ) : (() => {
          const st = me.disconnected ? "disconnected" : check?.state;  // the connection with the easy2edit server, live
          const bad = ["refused", "disabled", "offline", "blocked"].includes(st);
          return (
            <div style={{ display: "grid", gap: ".5rem" }}>
              <div className="row" style={{ justifyContent: "flex-start", alignItems: "center", gap: ".6rem", flexWrap: "wrap" }}>
                <span className={`badge ${st === "connected" ? "ok" : st === "pending" ? "warn" : ""}`}>
                  {st === "connected" ? tx("Verbonden met de easy2edit-server") : st === "pending" ? tx("Verbonden, wacht op goedkeuring") : st === "disconnected" ? tx("Ontkoppeld") : bad ? tx("Niet verbonden") : tx("Bezig…")}
                </span>
                <small className="muted"><code>{me.api_url}</code> · {me.last_ok_at ? `${tx("laatste melding")} ${when(me.last_ok_at)}` : tx("nog niet gemeld")}</small>
              </div>
              {bad && <div className="alert">{tx(SOURCE_TEXT[st === "offline" ? "unreachable" : st])}{check?.error ? ` (${check.error})` : ""}</div>}
              {st === "pending" && <small className="muted">{tx(SOURCE_TEXT.pending)}</small>}
            </div>
          );
        })()}
        {me.server && me.last_error && <div className="alert">{tx("Laatste fout")}: {me.last_error}</div>}
          </div>
          <div className="sm-buttons">
          {!me.server && !me.disconnected && <button type="button" className="btn" disabled={!!busy || checking} onClick={runCheck}><IconRefresh /> {checking ? tx("Bezig…") : tx("Verbinding testen")}</button>}
          {!me.server && !me.disconnected && <button type="button" className="btn" disabled={!!busy || checking} onClick={activate} title={tx("Wisselt opnieuw een koppelsleutel uit met de easy2edit-server, zodat de server deze website kan opvragen.")}><IconKey /> {busy === "activate" ? tx("Bezig…") : tx("Activeren via API")}</button>}
          <button type="button" className="btn" disabled={!!busy || (!me.server && me.disconnected)} onClick={() => act({ action: "sync" }, tx("Gemeld bij de easy2edit-server."))}><IconRefresh /> {busy === "sync" ? tx("Bezig…") : tx("Nu melden")}</button>
          {!me.server && (me.disconnected
            ? <button type="button" className="btn primary" disabled={!!busy} onClick={connect}>{tx("Verbinden")}</button>
            : <button type="button" className="btn danger" disabled={!!busy} onClick={disconnect}>{tx("Ontkoppelen")}</button>)}
          </div>
        </div>
        <div className="sm-switches">
          <label className="check sec-toggle">
            <span className="switch"><input type="checkbox" checked={!!me.server} disabled={!!busy} onChange={(e) => act({ action: "server", on: e.target.checked }, e.target.checked ? tx("Deze installatie is nu de site manager-server.") : tx("Deze installatie is geen site manager-server meer."))} /><span /></span>
            <span>{tx("Deze installatie is de easy2edit-server (site manager)")}<small className="muted" style={{ display: "block" }}>{tx("Alleen op de installatie die api.easy2edit.com draait: die neemt dan de meldingen van alle websites aan en toont de lijst hieronder.")}</small></span>
          </label>
          {me.server && (
            <label className="check sec-toggle">
            <span className="switch"><input type="checkbox" checked={!!me.auto_approve} disabled={!!busy} onChange={(e) => act({ action: "auto_approve", on: e.target.checked }, tx("Opgeslagen."))} /><span /></span>
            <span>{tx("Nieuwe websites automatisch goedkeuren")}<small className="muted" style={{ display: "block" }}>{tx("Uit (aanbevolen): een nieuwe website kan zich melden, maar krijgt pas de bibliotheek en de sleutels als je hem hier goedkeurt.")}</small></span>
          </label>
          )}
        </div>
      </div>

      {me.server ? (
        <>
          <div className="row" style={{ justifyContent: "flex-start", gap: ".6rem", alignItems: "center", marginBottom: ".6rem" }}>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Zoeken…")} style={{ maxWidth: "20rem" }} />
            <span className="muted">{list.length}/{sites.length}</span>
          </div>
          <div className="sm-list">
            <div className="sm-row sm-head" role="row">
              <span>{tx("Naam")}</span><span>{tx("Adres")}</span><span>{tx("IP-adres")} · {tx("versie")}</span><span>{tx("Laatste inlog")}</span><span>{tx("Status")}</span><span />
            </div>
            {list.map((s) => (
              <div key={s.id} className="sm-row">
                <span className="sm-cell sm-name"><strong>{s.name || "–"}</strong><small className="muted">{tx("Eerste melding")} {when(s.first_seen)}</small></span>
                <span className="sm-cell">
                  {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.url.replace(/^https?:\/\//, "")}</a> : "–"}
                  {s.url_generated && <small className="muted">{tx("Aangemaakt door de server")}</small>}
                </span>
                <span className="sm-cell">
                  <span>{s.ip || "–"}{s.seen_ip && s.seen_ip !== s.ip && <small className="muted"> ({tx("gezien")}: {s.seen_ip})</small>}</span>
                  <small className="muted">{s.version || "–"}{s.build ? ` · ${s.build}` : ""}</small>
                </span>
                <span className="sm-cell">
                  <span>{when(s.last_login_at)}</span>
                  {s.last_login_role && <small className="muted">{s.last_login_role} · {s.login_count}×</small>}
                </span>
                <span className="sm-cell">
                  <span><span className={`badge ${s.status === "active" ? "ok" : s.status === "pending" ? "warn" : ""}`}>{s.status === "active" ? tx("Actief") : s.status === "pending" ? tx("Wacht op goedkeuring") : s.status === "disconnected" ? tx("Ontkoppeld") : tx("Geblokkeerd")}</span></span>
                  <span className="sm-chips">
                    {s.license_state && <span className={`badge ${s.license_state === "active" ? "ok" : s.license_state === "expired" ? "warn" : ""}`} title={s.license_until ? `${tx("Geldig tot")}: ${s.license_until}` : ""}>{s.license_state === "active" ? tx("Licentie actief") : s.license_state === "expired" ? tx("Licentie verlopen") : tx("Geen licentie")}</span>}
                    {s.install_state && <span className={`badge ${s.install_state === "installed" ? "ok" : ""}`} title={s.install_name || ""}>{s.install_state === "installed" ? tx("Geïnstalleerd") : tx("Lege standaardinstallatie")}</span>}
                  </span>
                  <small className="muted">{when(s.last_seen)}</small>
                </span>
                <span className="sm-actions">
                  {s.status === "pending" && <button type="button" className="btn sm primary" onClick={() => approve(s)}><IconCheck /> {tx("Goedkeuren")}</button>}
                  <button type="button" className="btn sm" onClick={() => setView(s)} title={tx("Bekijken")} aria-label={tx("Bekijken")}><IconEye /></button>
                  <button type="button" className="btn sm" onClick={() => setEdit({ ...s, tab: "data", first0: s.status })} title={tx("Wijzigen")} aria-label={tx("Wijzigen")}><IconEdit /></button>
                  <button type="button" className="btn sm danger" onClick={() => remove(s)} title={tx("Verwijderen")} aria-label={tx("Verwijderen")}><IconTrash /></button>
                </span>
              </div>
            ))}
            {!list.length && <p className="muted" style={{ padding: ".8rem 1rem", margin: 0 }}>{sites.length ? tx("Niets gevonden.") : tx("Nog geen websites gemeld.")}</p>}
          </div>
        </>
      ) : <p className="muted">{tx("De lijst met websites staat op de easy2edit-server. Zet hierboven de schakelaar aan op die installatie.")}</p>}

      {view && <SiteView site={view} onClose={() => setView(null)} />}
      {edit && (() => {
        const approved = edit.status === "active", blocked = edit.status === "blocked";
        const first = edit.first0 || edit.status;  // the status when the pop-up was opened: the switch "Geblokkeerd" goes back to it
        const setStatus = (status) => setEdit({ ...edit, status });
        const label = { active: ["Actief", "ok"], pending: ["Wacht op goedkeuring", "warn"], blocked: ["Geblokkeerd", ""], disconnected: ["Ontkoppeld", ""] }[edit.status] || ["", ""];
        return (
          <div className="overlay" onClick={() => setEdit(null)}>
            <form className="card modal form" style={{ width: "min(640px, 94vw)", display: "flex", flexDirection: "column", gap: ".9rem" }} onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); save(); }}>
              <div className="row between" style={{ alignItems: "center", gap: ".8rem" }}>
                <span style={{ display: "flex", alignItems: "center", gap: ".7rem", minWidth: 0 }}>
                  <span className="st-ico"><IconGlobe /></span>
                  <span style={{ display: "grid", minWidth: 0 }}>
                    <h2 style={{ margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx("Website wijzigen")}</h2>
                    <small className="muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{edit.name || edit.url || "–"}</small>
                  </span>
                </span>
                <span className={`badge ${label[1]}`}>{tx(label[0])}</span>
              </div>
              <Tabs value={edit.tab || "data"} onChange={(k) => setEdit({ ...edit, tab: k })} tabs={[["data", "Gegevens", <IconSettings key="d" />], ["online", "Online", <IconGlobe key="o" />], ["maintenance", "Onderhoud", <IconRefresh key="m" />]]} />
              {edit.tab === "online" ? <SiteOnline site={edit} /> : edit.tab === "maintenance" ? <SiteMaintenance site={edit} /> : (
                <>
                  <div className="form-grid">
                    <label>{tx("Naam")}<input value={edit.name || ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
                    <label>{tx("Adres")}<input value={edit.url || ""} placeholder="https://naam.easy2edit.com" onChange={(e) => setEdit({ ...edit, url: e.target.value })} /></label>
                  </div>
                  <div className="card" style={{ display: "grid", gap: ".8rem" }}>
                    <label className="check sec-toggle">
                      <span className="switch"><input type="checkbox" checked={approved} disabled={blocked || edit.status === "disconnected"} onChange={(e) => setStatus(e.target.checked ? "active" : "pending")} /><span /></span>
                      <span>{tx("Goedgekeurd")}<small className="muted" style={{ display: "block" }}>{tx("Een goedgekeurde website krijgt de bibliotheek en de sleutels van de server en kan door jou worden opgevraagd.")}</small></span>
                    </label>
                    <label className="check sec-toggle">
                      <span className="switch"><input type="checkbox" checked={blocked} onChange={(e) => setStatus(e.target.checked ? "blocked" : first !== "blocked" ? first : "active")} /><span /></span>
                      <span>{tx("Geblokkeerd")}<small className="muted" style={{ display: "block" }}>{tx("Een geblokkeerde website gaat offline met een melding, kan zich niet meer melden en krijgt niets meer van de server.")}</small></span>
                    </label>
                    {blocked && (
                      <label>{tx("Bericht voor bezoekers bij blokkeren")}
                        <textarea rows={2} maxLength={500} value={edit.block_message || ""} onChange={(e) => setEdit({ ...edit, block_message: e.target.value })} placeholder={tx("Leeg = het standaardbericht: de website is geblokkeerd en tijdelijk niet beschikbaar.")} />
                      </label>
                    )}
                  </div>
                  <label>{tx("Notities")}<textarea rows={3} value={edit.notes || ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></label>
                  {edit.error && <div className="alert">{edit.error}</div>}
                </>
              )}
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <button type="button" className="btn" onClick={() => setEdit(null)}>{edit.tab === "online" || edit.tab === "maintenance" ? tx("Sluiten") : tx("Annuleren")}</button>
                {edit.tab !== "online" && edit.tab !== "maintenance" && <button className="btn primary" disabled={busy === "edit"}>{tx("Opslaan")}</button>}
              </div>
            </form>
          </div>
        );
      })()}
    </>
  );
}
