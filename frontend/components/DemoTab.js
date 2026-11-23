// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useRef, useState } from "react";
import Tabs from "./Tabs";
import Loading from "./Loading";
import { IconPlus, IconTrash, IconRefresh } from "./Icons";
import { api, errorText } from "../lib/api";
import { confirmDialog } from "../lib/dialog";
import { tx } from "../lib/t";

const tint = { padding: ".9rem 1rem", borderRadius: 12, background: "color-mix(in srgb, var(--eco-leaf, #7cc59a) 12%, transparent)", display: "grid", gap: ".7rem" };
const Switch = ({ checked, onChange, title, hint, disabled }) => (
  <label className="e2e-switch gs-sw" style={disabled ? { opacity: .6 } : undefined}>
    <input type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    <span><strong>{tx(title)}</strong>{hint && <><br /><span className="e2e-hint">{tx(hint)}</span></>}</span>
  </label>
);
const when = (v) => (v ? new Date(v).toLocaleString() : "–");

// Demo mode: a website people can try out. A linked backup is put back at planned times; demo users with their rights; nothing is sent, codes are shown.
export default function DemoTab({ setMsg }) {
  const [d, setD] = useState(null);
  const [sub, setSub] = useState("general");
  const [busy, setBusy] = useState("");
  const [times, setTimes] = useState("");
  const [firm, setFirm] = useState(null);
  const [popup, setPopup] = useState(null);  // null | {id?, ...user}
  const poll = useRef(null);
  const take = (r) => { setD(r); setTimes((r.times || []).join(", ")); };
  const load = () => api("/demo/settings/").then(take).catch((e) => setMsg({ ok: false, text: errorText(e) }));
  useEffect(() => { load(); return () => clearTimeout(poll.current); }, []);  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {  // while it restores: look again until it is ready
    clearTimeout(poll.current);
    if (d?.restoring) poll.current = setTimeout(load, 3000);
  }, [d?.restoring, d?.last_restore_at]);  // eslint-disable-line react-hooks/exhaustive-deps
  const run = async (key, fn, ok) => {
    setBusy(key); setMsg(null);
    try { const r = await fn(); if (r) take(r); if (ok) setMsg({ ok: true, text: tx(ok) }); return true; }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); return false; }
    finally { setBusy(""); }
  };
  const put = (body, ok) => run("put", () => api("/demo/settings/", { method: "PUT", body }), ok);
  if (!d) return <Loading compact />;
  const problems = d.problems || [];
  return (
    <div className="e2e-stack" style={{ gap: "1.2rem" }}>
      <div style={{ ...tint, background: d.enabled ? "color-mix(in srgb, var(--eco-green, #2f7d5b) 16%, transparent)" : tint.background }}>
        <Switch checked={d.enabled} disabled={!!busy || d.restoring || (!d.enabled && problems.length > 0)} onChange={(v) => put({ enabled: v, times: times.split(/[\s,;]+/).filter(Boolean) }, v ? "De demo mode staat aan." : "De demo mode staat uit.")}
          title="Demo mode aan" hint="Alleen een superadmin kan dit aanzetten, en pas als alles hieronder klopt. In demo mode wordt er geen e-mail of sms verstuurd en worden codes op het scherm ingevuld." />
        {!d.enabled && problems.length > 0 && <ul className="e2e-hint" style={{ margin: 0, paddingLeft: "1.2rem" }}>{problems.map((p) => <li key={p}>{tx(p)}</li>)}</ul>}
        {d.enabled && <span className="e2e-hint">{d.restoring ? tx("De demo wordt nu hersteld…") : d.next_restore_at ? tx("Volgende herstel: {0}", when(d.next_restore_at)) : ""}</span>}
      </div>
      <Tabs tabs={[["general", "Backup en tijden"], ["users", "Demo gebruikers"], ["firms", "Bedrijven"], ["login", "Weergave"]]} value={sub} onChange={setSub} />
      {sub === "general" && (
        <div className="e2e-stack" style={{ gap: "1rem" }}>
          <section style={tint}>
            <strong>{tx("Gekoppelde backup")}</strong>
            <span className="e2e-hint">{tx("Deze backup wordt teruggezet (gebruikers, pagina's, bestanden en ook de creator-bestanden). Je kunt hem altijd wisselen.")}</span>
            <select className="e2e-input" value={d.backup || ""} disabled={!!busy || d.restoring} onChange={(e) => put({ backup: e.target.value ? Number(e.target.value) : null }, "Backup gekoppeld.")} aria-label={tx("Gekoppelde backup")}>
              <option value="">{tx("Geen backup gekoppeld")}</option>
              {d.backups.map((b) => <option key={b.id} value={b.id}>{`${when(b.created_at)} · ${b.frequency}${b.note ? ` · ${b.note}` : ""}`}</option>)}
            </select>
            <div className="e2e-row" style={{ gap: ".6rem", flexWrap: "wrap" }}>
              <button type="button" className="e2e-btn e2e-btn--outline" disabled={!!busy || d.restoring} onClick={async () => { if (await confirmDialog(tx("Een backup van de website zoals die nu is maken en aan de demo koppelen?"), { okLabel: tx("Backup maken"), cancelLabel: tx("Annuleren") })) run("bk", () => api("/demo/backup/", { method: "POST", body: {} }), "Backup gemaakt en gekoppeld."); }}>{busy === "bk" ? tx("Bezig…") : tx("Nu backup maken en koppelen")}</button>
            </div>
          </section>
          <section style={tint}>
            <strong>{tx("Terugzetten op vaste tijden")}</strong>
            <span className="e2e-hint">{tx("Meerdere tijden per dag, tijd van de website (uu:mm), gescheiden door een komma. Bezoekers zien een melding als het bezig is.")}</span>
            <div className="e2e-row" style={{ gap: ".6rem", flexWrap: "wrap", alignItems: "center" }}>
              <input className="e2e-input" style={{ flex: "1 1 240px" }} value={times} onChange={(e) => setTimes(e.target.value)} placeholder="03:00, 13:00, 21:00" aria-label={tx("Tijden")} />
              <button type="button" className="e2e-btn" disabled={!!busy} onClick={() => put({ times: times.split(/[\s,;]+/).filter(Boolean) }, "Tijden opgeslagen.")}>{tx("Opslaan")}</button>
            </div>
            <div className="e2e-row" style={{ gap: ".6rem", alignItems: "center" }}>
              <label htmlFor="demo-warn">{tx("Melding vooraf (minuten)")}</label>
              <input id="demo-warn" className="e2e-input" type="number" min={0} max={120} style={{ width: 90 }} defaultValue={d.warn_minutes} onBlur={(e) => put({ warn_minutes: e.target.value }, "Opgeslagen.")} />
            </div>
          </section>
          <section style={tint}>
            <span className="e2e-hint">{tx("Laatst teruggezet")}: {when(d.last_restore_at)}{d.last_status === "failed" ? ` · ${tx("mislukt")}: ${d.last_error}` : d.last_status === "ok" ? ` · ${tx("gelukt")}` : ""}</span>
            <div><button type="button" className="e2e-btn e2e-btn--outline" disabled={!!busy || d.restoring || !d.backup} onClick={async () => { if (await confirmDialog(tx("De gekoppelde backup nu terugzetten? Alles wat sindsdien is gedaan gaat verloren."), { okLabel: tx("Nu terugzetten"), cancelLabel: tx("Annuleren") })) run("rs", () => api("/demo/restore/", { method: "POST", body: {} }), "Het terugzetten is gestart."); }}><span style={{ display: "inline-flex", width: 16, height: 16, marginRight: ".4rem", verticalAlign: "middle" }}><IconRefresh /></span>{d.restoring ? tx("Bezig met terugzetten…") : tx("Nu terugzetten")}</button></div>
          </section>
        </div>
      )}
      {sub === "users" && (
        <div className="e2e-stack" style={{ gap: ".8rem" }}>
          <span className="e2e-hint">{tx("Demo gebruikers worden na elk terugzetten opnieuw gemaakt, met hetzelfde wachtwoord en dezelfde rechten.")}</span>
          {d.users.map((u) => (
            <div key={u.id} style={{ ...tint, gridTemplateColumns: "1fr auto auto", alignItems: "center" }}>
              <span style={{ display: "grid", lineHeight: 1.3, minWidth: 0 }}><strong>{u.note || `${u.first_name} ${u.last_name}`.trim() || u.email}</strong><small className="e2e-hint" style={{ overflowWrap: "anywhere" }}>{u.email} · {u.password} · {[...u.roles, ...u.groups].join(", ") || tx("geen rechten")}</small></span>
              <button type="button" className="e2e-btn e2e-btn--outline e2e-btn--sm" onClick={() => setPopup(u)}>{tx("Wijzigen")}</button>
              <button type="button" className="e2e-btn e2e-btn--ghost e2e-btn--sm" aria-label={tx("Verwijderen")} title={tx("Verwijderen")} onClick={async () => { if (await confirmDialog(tx("Deze demo gebruiker verwijderen? Het account verdwijnt bij het volgende terugzetten."), { okLabel: tx("Verwijderen"), cancelLabel: tx("Annuleren") })) run("del", () => api(`/demo/users/${u.id}/`, { method: "DELETE" })); }}><span style={{ display: "inline-flex", width: 16, height: 16 }}><IconTrash /></span></button>
            </div>
          ))}
          <div className="e2e-row" style={{ gap: ".6rem", flexWrap: "wrap" }}>
            <button type="button" className="e2e-btn e2e-btn--outline" disabled={!!busy} onClick={() => run("seed", () => api("/demo/seed/", { method: "POST", body: {} }), "De standaard demo gegevens zijn aangemaakt: een gebruiker, een admin en twee bedrijven.")}>{tx("Standaard gegevens aanmaken")}</button>
            <button type="button" className="e2e-btn" onClick={() => setPopup({ email: "", first_name: "", last_name: "", password: "", note: "", roles: [], groups: [] })}><span style={{ display: "inline-flex", width: 16, height: 16, marginRight: ".4rem", verticalAlign: "middle" }}><IconPlus /></span>{tx("Demo gebruiker toevoegen")}</button>
          </div>
          <span className="e2e-hint">{tx("Een demo gebruiker is nooit een superadmin of hoger. De demo mag modules en plugins aan en uit zetten; de licentiestappen blijven staan.")}</span>
        </div>
      )}
      {sub === "firms" && (
        <div className="e2e-stack" style={{ gap: ".8rem" }}>
          <span className="e2e-hint">{tx("Bedrijven worden na elk terugzetten opnieuw gemaakt met dezelfde gegevens en dezelfde gebruikers erbij.")}</span>
          {(d.entities || []).map((e) => (
            <div key={e.id} style={{ ...tint, gridTemplateColumns: "1fr auto auto", alignItems: "center" }}>
              <span style={{ display: "grid", lineHeight: 1.3, minWidth: 0 }}><strong>{e.name}</strong><small className="e2e-hint">{[e.kind, e.city, `${(e.members || []).length} ${tx("gebruikers")}`].filter(Boolean).join(" · ")}</small></span>
              <button type="button" className="e2e-btn e2e-btn--outline e2e-btn--sm" onClick={() => setFirm(e)}>{tx("Wijzigen")}</button>
              <button type="button" className="e2e-btn e2e-btn--ghost e2e-btn--sm" aria-label={tx("Verwijderen")} title={tx("Verwijderen")} onClick={async () => { if (await confirmDialog(tx("Dit demo bedrijf verwijderen? Het bedrijf verdwijnt bij het volgende terugzetten."), { okLabel: tx("Verwijderen"), cancelLabel: tx("Annuleren") })) run("delf", () => api(`/demo/entities/${e.id}/`, { method: "DELETE" })); }}><span style={{ display: "inline-flex", width: 16, height: 16 }}><IconTrash /></span></button>
            </div>
          ))}
          <div><button type="button" className="e2e-btn" onClick={() => setFirm({ name: "", kind: "bedrijf", email: "", phone: "", website: "", street: "", house_number: "", postal_code: "", city: "", country: "Nederland", members: [] })}><span style={{ display: "inline-flex", width: 16, height: 16, marginRight: ".4rem", verticalAlign: "middle" }}><IconPlus /></span>{tx("Demo bedrijf toevoegen")}</button></div>
        </div>
      )}
      {sub === "login" && (
        <section style={tint}>
          <Switch checked={d.show_on_login} disabled={!!busy} onChange={(v) => put({ show_on_login: v }, "Opgeslagen.")} title="Toon de demo gebruikers bij het inloggen" hint="Netjes in een blok onder het inlogformulier, met een knop die het formulier invult." />
        </section>
      )}
      {firm && <FirmPopup d={d} firm={firm} onClose={() => setFirm(null)} onSaved={(r) => { take(r); setFirm(null); setMsg({ ok: true, text: tx("Demo bedrijf opgeslagen.") }); }} />}
      {popup && <UserPopup d={d} user={popup} onClose={() => setPopup(null)} onSaved={(r) => { take(r); setPopup(null); setMsg({ ok: true, text: tx("Demo gebruiker opgeslagen.") }); }} />}
    </div>
  );
}

function UserPopup({ d, user, onClose, onSaved }) {
  const [f, setF] = useState(user);
  const [tab, setTab] = useState("data");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [found, setFound] = useState([]);
  useEffect(() => { if (!user.id && q.trim().length > 1) { const t = setTimeout(() => api(`/demo/users/candidates/?q=${encodeURIComponent(q.trim())}`).then(setFound).catch(() => {}), 300); return () => clearTimeout(t); } setFound([]); }, [q]);  // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (k, name, on) => setF((x) => ({ ...x, [k]: on ? [...new Set([...x[k], name])] : x[k].filter((n) => n !== name) }));
  const save = async () => {
    setBusy(true); setErr("");
    try { onSaved(await api(f.id ? `/demo/users/${f.id}/` : "/demo/users/", { method: f.id ? "PUT" : "POST", body: f })); }
    catch (e) { setErr(errorText(e)); setBusy(false); }
  };
  return (
    <div role="dialog" aria-label={tx("Demo gebruiker")} style={{ position: "fixed", inset: 0, zIndex: 3200, background: "rgba(0,0,0,.45)", display: "grid", placeItems: "center", padding: "1rem" }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card" style={{ width: "min(560px, 96vw)", maxHeight: "90vh", overflowY: "auto", display: "grid", gap: "1rem", padding: "1.2rem 1.3rem" }}>
        <strong style={{ fontSize: "1.1rem" }}>{f.id ? tx("Demo gebruiker wijzigen") : tx("Demo gebruiker toevoegen")}</strong>
        <Tabs tabs={[["data", "Gegevens"], ["rights", "Rechten"]]} value={tab} onChange={setTab} />
        {tab === "data" && (
          <div className="e2e-stack" style={{ gap: ".7rem" }}>
            {!f.id && (
              <div style={tint}>
                <label className="e2e-label" htmlFor="du-find">{tx("Bestaande gebruiker koppelen (zoek op naam of e-mail)")}</label>
                <input id="du-find" className="e2e-input" value={q} onChange={(e) => setQ(e.target.value)} />
                {found.map((u) => <button key={u.id} type="button" className="e2e-btn e2e-btn--outline e2e-btn--sm" style={{ justifyContent: "flex-start" }} onClick={() => { setF((x) => ({ ...x, user_id: u.id, email: u.email, first_name: u.name.split(" ")[0] || "", last_name: u.name.split(" ").slice(1).join(" ") })); setFound([]); setQ(""); setTab("rights"); }}>{u.name || u.email} · {u.email}</button>)}
                {f.user_id && <span className="e2e-hint">{tx("Gekoppeld: {0}. Geef een demo wachtwoord op: het wachtwoord van dit account wordt dat wachtwoord.", f.email)}</span>}
              </div>
            )}
            {[["email", "E-mailadres", "email"], ["first_name", "Voornaam"], ["last_name", "Achternaam"], ["password", "Wachtwoord (zichtbaar op de login)"], ["note", "Omschrijving (bijvoorbeeld Beheerder)"]].map(([k, label, type]) => (
              <div key={k} className="e2e-field"><label className="e2e-label" htmlFor={`du-${k}`}>{tx(label)}</label><input id={`du-${k}`} className="e2e-input" type={type || "text"} value={f[k] || ""} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} autoComplete="off" /></div>
            ))}
          </div>
        )}
        {tab === "rights" && (
          <div className="e2e-stack" style={{ gap: ".8rem" }}>
            <section style={tint}><strong>{tx("Rollen")}</strong>{d.roles.length ? d.roles.map((n) => <Switch key={n} checked={f.roles.includes(n)} onChange={(v) => toggle("roles", n, v)} title={n} />) : <span className="e2e-hint">{tx("Geen rollen.")}</span>}</section>
            <section style={tint}><strong>{tx("Groepen")}</strong>{d.groups.length ? d.groups.map((n) => <Switch key={n} checked={f.groups.includes(n)} onChange={(v) => toggle("groups", n, v)} title={n} />) : <span className="e2e-hint">{tx("Geen groepen.")}</span>}</section>
          </div>
        )}
        {err && <div className="e2e-error" role="alert">{err}</div>}
        <div className="e2e-row" style={{ gap: ".6rem", justifyContent: "flex-end" }}>
          <button type="button" className="e2e-btn e2e-btn--ghost" onClick={onClose}>{tx("Annuleren")}</button>
          <button type="button" className="e2e-btn" disabled={busy} onClick={save}>{busy ? tx("Bezig…") : tx("Opslaan")}</button>
        </div>
      </div>
    </div>
  );
}

function FirmPopup({ d, firm, onClose, onSaved }) {
  const [f, setF] = useState(firm);
  const [tab, setTab] = useState("data");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const toggle = (email, on) => setF((x) => ({ ...x, members: on ? [...new Set([...x.members, email])] : x.members.filter((m) => m !== email) }));
  const save = async () => {
    setBusy(true); setErr("");
    try { onSaved(await api(f.id ? `/demo/entities/${f.id}/` : "/demo/entities/", { method: f.id ? "PUT" : "POST", body: f })); }
    catch (e) { setErr(errorText(e)); setBusy(false); }
  };
  return (
    <div role="dialog" aria-label={tx("Demo bedrijf")} style={{ position: "fixed", inset: 0, zIndex: 3200, background: "rgba(0,0,0,.45)", display: "grid", placeItems: "center", padding: "1rem" }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card" style={{ width: "min(560px, 96vw)", maxHeight: "90vh", overflowY: "auto", display: "grid", gap: "1rem", padding: "1.2rem 1.3rem" }}>
        <strong style={{ fontSize: "1.1rem" }}>{f.id ? tx("Demo bedrijf wijzigen") : tx("Demo bedrijf toevoegen")}</strong>
        <Tabs tabs={[["data", "Gegevens"], ["users", "Gebruikers"]]} value={tab} onChange={setTab} />
        {tab === "data" && (
          <div className="e2e-stack" style={{ gap: ".7rem" }}>
            <div className="e2e-field"><label className="e2e-label" htmlFor="df-kind">{tx("Soort")}</label>
              <select id="df-kind" className="e2e-input" value={f.kind} onChange={(e) => setF((x) => ({ ...x, kind: e.target.value }))}>{(d.kinds || []).map((k) => <option key={k} value={k}>{k}</option>)}</select></div>
            {[["name", "Naam"], ["legal_name", "Juridische naam"], ["email", "E-mailadres"], ["phone", "Telefoon"], ["website", "Website"], ["street", "Straat"], ["house_number", "Huisnummer"], ["postal_code", "Postcode"], ["city", "Plaats"], ["country", "Land"]].map(([k, label]) => (
              <div key={k} className="e2e-field"><label className="e2e-label" htmlFor={`df-${k}`}>{tx(label)}</label><input id={`df-${k}`} className="e2e-input" value={f[k] || ""} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} autoComplete="off" /></div>
            ))}
          </div>
        )}
        {tab === "users" && (
          <section style={tint}>
            <strong>{tx("Demo gebruikers in dit bedrijf")}</strong>
            {d.users.length ? d.users.map((u) => <Switch key={u.id} checked={f.members.includes(u.email)} onChange={(v) => toggle(u.email, v)} title={u.note || u.email} hint={u.email} />) : <span className="e2e-hint">{tx("Maak eerst demo gebruikers aan.")}</span>}
          </section>
        )}
        {err && <div className="e2e-error" role="alert">{err}</div>}
        <div className="e2e-row" style={{ gap: ".6rem", justifyContent: "flex-end" }}>
          <button type="button" className="e2e-btn e2e-btn--ghost" onClick={onClose}>{tx("Annuleren")}</button>
          <button type="button" className="e2e-btn" disabled={busy} onClick={save}>{busy ? tx("Bezig…") : tx("Opslaan")}</button>
        </div>
      </div>
    </div>
  );
}
