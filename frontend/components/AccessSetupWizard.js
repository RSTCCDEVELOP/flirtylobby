// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api, errorText } from "../lib/api";
import { confirmDialog } from "../lib/dialog";
import { tx } from "../lib/t";
import Loading from "./Loading";
import Tabs from "./Tabs";

// The steps of a set-up, each with a switch before anything is made: [key, title, text, needs (another step), count]
const STEPS = [
  ["roles", "Rollen aanmaken", "De rollen met hun rechten (permissions) die de groepen gebruiken.", null, (c) => c.roles.length],
  ["groups", "Groepen aanmaken", "De user groups van deze setup.", null, (c) => c.groups.length],
  ["grants", "Module-toegang koppelen", "Per groep de modules met het niveau Gebruik, Bewerken of Beheer.", "groups", (c) => c.groups.reduce((a, g) => a + g.modules.length, 0)],
  ["enable_modules", "Benodigde modules aanzetten", "Modules die uitstaan maar nodig zijn worden aangezet. Plugins blijf je zelf beheren.", "groups", () => null],
  ["people", "Demo-gebruikers aanmaken", "Zonder wachtwoord, ze kunnen niet inloggen en hebben een @example.com-adres.", "groups", (c) => c.people],
];

const LEVEL = { 1: "Gebruik", 2: "Bewerken", 3: "Beheer" };

// Admin and higher: choose a standard set-up of people and rights for a standard installation: roles, user groups with module access and demo users.
// It only adds (nothing that exists is changed) and skips modules that are switched off. The demo users cannot log in and can be removed again per set-up.
export default function AccessSetupWizard({ onClose, onDone }) {
  const [list, setList] = useState(null);
  const [pick, setPick] = useState(null);       // the chosen set-up (key)
  const [tab, setTab] = useState("groups");
  const [steps, setSteps] = useState({ roles: true, groups: true, grants: true, enable_modules: false, people: true });
  const [confirm, setConfirm] = useState(false);   // the choice of the steps, before anything is made
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);
  const load = () => api("/access-setups/").then(setList).catch((e) => setErr(errorText(e)));
  useEffect(() => { load(); }, []);
  const open = (k) => { setPick(k); setTab("groups"); setResult(null); setErr(""); setConfirm(false); };
  const cur = list?.setups.find((s) => s.key === pick);
  const replace = (s) => setList((o) => ({ ...o, setups: o.setups.map((x) => (x.key === s.key ? s : x)) }));
  const apply = async () => {
    setBusy(true); setErr("");
    try { const r = await api("/access-setups/", { method: "POST", body: { key: pick, steps } }); replace(r.setup); setResult(r); setConfirm(false); onDone?.(); }
    catch (e) { setErr(errorText(e)); }
    setBusy(false);
  };
  const remove = async (key = pick) => {
    if (!(await confirmDialog(tx("De groepen en demo-gebruikers van deze setup verwijderen? De rollen blijven bestaan."), { danger: true }))) return;
    setBusy(true); setErr("");
    try { const r = await api("/access-setups/", { method: "POST", body: { key, action: "remove" } }); replace(r.setup); setResult({ removed: r.removed }); onDone?.(); }
    catch (e) { setErr(errorText(e)); }
    setBusy(false);
  };
  return createPortal(
    <div className="overlay" role="dialog" aria-modal="true" aria-label={tx("Standaard setup")} onClick={() => !busy && onClose()}>
      <form className="card modal form int-modal inv-modal" onClick={(e) => e.stopPropagation()} onSubmit={(e) => e.preventDefault()} data-easy2edit-tag="ui-setup-wizard">
        <div className="row between" style={{ flex: "0 0 auto" }}>
          <h2 style={{ margin: 0 }}>{cur ? cur.name : tx("Standaard setup kiezen")}</h2>
          <button type="button" className="btn sm" disabled={busy} onClick={onClose} aria-label={tx("Sluiten")}>×</button>
        </div>
        {!cur && <p className="muted" style={{ margin: 0 }}>{tx("Kies een setup die past bij je installatie. Je krijgt rollen, groepen met toegang tot modules en demo-gebruikers. Er wordt alleen iets toegevoegd: wat al bestaat blijft zoals het is.")}</p>}
        {cur && !confirm && <Tabs className="tabs-one-row" value={tab} onChange={setTab} tabs={[["groups", "Groepen", null, cur.groups.length], ["roles", "Rollen", null, cur.roles.length], ["people", "Gebruikers", null, cur.people]]} />}
        <div className="inv-body">
          {err && <div className="alert">{err}</div>}
          {!list && !err && <Loading compact />}
          {result && (
            <div className="alert ok" role="status">
              {result.removed
                ? `${tx("Verwijderd")}: ${result.removed.groups} ${tx("groepen")}, ${result.removed.people} ${tx("demo-gebruikers")}.`
                : `${tx("Klaar")}: ${result.made.groups} ${tx("groepen")}, ${result.made.roles} ${tx("rollen")}, ${result.made.grants} ${tx("module-toegangen")}, ${result.made.people} ${tx("demo-gebruikers")}.`}
              {result.switched_on?.length > 0 && <small style={{ display: "block" }}>{tx("Aangezet")}: {result.switched_on.join(", ")}.</small>}
              {result.skipped?.length > 0 && <small style={{ display: "block" }}>{tx("Overgeslagen omdat de module uitstaat")}: {result.skipped.join(", ")}.</small>}
            </div>
          )}
          {list && !cur && (
            <div className="setup-grid">
              {list.setups.map((s) => (
                <div key={s.key} className="setup-tile" role="button" tabIndex={0} onClick={() => open(s.key)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(s.key); } }}>
                  <strong>{s.name}</strong>
                  <small className="muted">{s.groups.length} {tx("groepen")} · {s.roles.length} {tx("rollen")} · {s.people} {tx("gebruikers")}</small>
                  <span className="row" style={{ gap: ".3rem", flexWrap: "wrap" }}>
                    {s.recommended && <span className="badge ok">{tx("Past bij deze installatie")}</span>}
                    {s.applied && <span className="badge">{tx("Al toegepast")}</span>}
                  </span>
                  {(s.applied || s.demo_users > 0) && <button type="button" className="btn sm danger" style={{ justifySelf: "start" }} disabled={busy} onClick={(e) => { e.stopPropagation(); remove(s.key); }}>{tx("Verwijderen")}</button>}
                </div>
              ))}
            </div>
          )}
          {cur && confirm && (
            <div style={{ display: "grid", gap: ".7rem", alignContent: "start" }}>
              <p className="setup-intro">{tx("Kies welke stappen de setup moet volgen. Er wordt alleen iets toegevoegd: wat al bestaat blijft zoals het is.")}</p>
              {STEPS.map(([k, title, text, need, count]) => {
                const off = need && !steps[need];
                return (
                  <label key={k} className="en-row" style={off ? { opacity: .5, cursor: "not-allowed" } : undefined}>
                    <span className="en-text"><strong>{tx(title)}{count(cur) != null && <small className="muted"> · {count(cur)}</small>}</strong><small className="muted">{tx(text)}</small></span>
                    <span className="switch"><input type="checkbox" disabled={off} checked={!off && !!steps[k]} onChange={(e) => setSteps({ ...steps, [k]: e.target.checked })} /><span /></span>
                  </label>
                );
              })}
            </div>
          )}
          {cur && !confirm && tab === "groups" && (
            <div className="setup-groups">
              <p className="setup-intro">{cur.desc}</p>
              {cur.groups.map((g) => (
                <section key={g.name} className="setup-group">
                  <header>
                    <span className="sg-title"><strong>{g.name}</strong>{g.exists && <span className="badge">{tx("Bestaat al")}</span>}</span>
                    {g.desc && <span className="sg-desc muted">{g.desc}</span>}
                    <span className="sg-roles"><small className="muted">{tx("Rollen")}</small>{g.roles.length ? g.roles.map((r) => <span key={r} className="sg-chip">{r}</span>) : <small className="muted">—</small>}</span>
                  </header>
                  <div className="sg-mods">
                    {g.modules.map((m) => (
                      <div key={m.key} className={`sg-mod${m.on ? "" : " off"}`}>
                        <span className="sg-name">{tx(m.label)}{!m.on && <small className="muted">{tx("staat uit: wordt overgeslagen")}</small>}</span>
                        <span className={`sg-level l${m.level}`}>{tx(LEVEL[m.level])}</span>
                      </div>
                    ))}
                    {!g.modules.length && <span className="sg-empty muted">{tx("Geen module-toegang in deze groep.")}</span>}
                  </div>
                </section>
              ))}
            </div>
          )}
          {cur && !confirm && tab === "roles" && (
            <ul className="acl-list">
              {cur.roles.map((r) => <li key={r.name}><span className="acl-name"><strong>{r.name}</strong><small className="muted">{r.desc}</small></span>{r.exists ? <span className="badge">{tx("Bestaat al")}</span> : <small className="muted">{r.permissions.length} {tx("rechten")}</small>}</li>)}
            </ul>
          )}
          {cur && !confirm && tab === "people" && (
            <div style={{ display: "grid", gap: ".8rem" }}>
              <label className="en-row"><span className="en-text"><strong>{tx("Demo-gebruikers aanmaken")}</strong><small className="muted">{tx("Zonder wachtwoord, ze kunnen niet inloggen en hebben een @example.com-adres. Je kunt ze later weer verwijderen.")}</small></span><span className="switch"><input type="checkbox" checked={!!steps.people && !!steps.groups} disabled={!steps.groups} onChange={(e) => setSteps({ ...steps, people: e.target.checked })} /><span /></span></label>
              <ul className="acl-list" style={steps.people && steps.groups ? undefined : { opacity: .5 }}>{cur.groups.map((g) => <li key={g.name}><span className="acl-name"><strong>{g.name}</strong><small className="muted">{g.people.join(", ") || "—"}</small></span></li>)}</ul>
            </div>
          )}
        </div>
        <div className="row inv-foot">
          {cur && <button type="button" className="btn" disabled={busy} onClick={() => { if (confirm) setConfirm(false); else { setPick(null); setResult(null); } }} style={{ marginRight: "auto" }}>{tx("Terug")}</button>}
          {cur && !confirm && (cur.applied || cur.demo_users > 0) && <button type="button" className="btn danger" disabled={busy} onClick={() => remove()}>{tx("Setup verwijderen")}</button>}
          {cur && !confirm && <button type="button" className="btn primary" disabled={busy} onClick={() => { setConfirm(true); setResult(null); }}>{tx("Setup toepassen")}</button>}
          {cur && confirm && <button type="button" className="btn primary" disabled={busy || !Object.values(steps).some(Boolean)} onClick={apply}>{busy ? tx("Bezig…") : tx("Starten")}</button>}
          {!cur && <button type="button" className="btn" onClick={onClose}>{tx("Sluiten")}</button>}
        </div>
      </form>
    </div>, document.body);
}
