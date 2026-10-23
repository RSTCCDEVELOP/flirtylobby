// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useCallback, useEffect, useState } from "react";
import DashHero from "../../../../components/DashHero";
import Tabs from "../../../../components/Tabs";
import { Busy } from "../../../../components/PageLoader";
import { useAuth } from "../../../../components/AuthContext";
import { api, errorText } from "../../../../lib/api";
import { lvl } from "../../../../lib/perms";
import { tx } from "../../../../lib/t";

const Switch = ({ checked, onChange, disabled, label }) => (
  <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /><span /></span>{label && <span>{label}</span>}</label>
);

const LAYOUTS = {
  bell: ["Klokje met lijst", "Een lijstje onder het belletje in de header."],
  panel: ["Zijpaneel", "Een paneel dat rechts over de pagina schuift."],
  toasts: ["Alleen pop-ups", "Nieuwe meldingen verschijnen even als pop-up; het belletje opent de meldingenpagina."],
  page: ["Meldingenpagina", "Het belletje opent direct de pagina met alle meldingen."],
};
const Sketch = ({ k }) => (
  <svg viewBox="0 0 120 64" aria-hidden="true">
    <rect x="1" y="1" width="118" height="62" rx="6" fill="none" stroke="currentColor" opacity=".3" />
    <rect x="1" y="1" width="118" height="10" rx="6" fill="currentColor" opacity=".12" />
    <circle cx="108" cy="6" r="3" fill="currentColor" />
    {k === "bell" && <><rect x="70" y="14" width="44" height="30" rx="4" fill="currentColor" opacity=".18" /><path d="M74 22h36M74 30h30M74 38h24" stroke="currentColor" opacity=".5" /></>}
    {k === "panel" && <rect x="80" y="11" width="39" height="52" fill="currentColor" opacity=".18" />}
    {k === "toasts" && <><rect x="74" y="16" width="40" height="10" rx="3" fill="currentColor" opacity=".35" /><rect x="74" y="30" width="40" height="10" rx="3" fill="currentColor" opacity=".2" /></>}
    {k === "page" && <path d="M20 22h80M20 32h80M20 42h60M20 52h70" stroke="currentColor" opacity=".45" />}
  </svg>
);

function Settings({ canEdit }) {
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState(null);
  const load = useCallback(() => api("/notify/admin/").then(setD).catch((e) => setMsg({ ok: false, text: errorText(e) })), []);
  useEffect(() => { load(); }, [load]);
  if (!d) return msg ? <div className="alert">{msg.text}</div> : <Busy />;
  const s = d.settings;
  const save = async (patch) => {
    const next = { ...s, ...patch };
    setD({ ...d, settings: next });
    try { const r = await api("/notify/admin/", { method: "PUT", body: next }); setD((x) => ({ ...x, settings: r.settings })); setMsg(null); } catch (e) { setMsg({ ok: false, text: errorText(e) }); load(); }
  };
  const kind = (k, patch) => save({ kinds: { ...s.kinds, [k]: { ...s.kinds[k], ...patch } } });
  return (
    <>
      {msg && <div className="alert">{msg.text}</div>}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <strong>{tx("Hoe werken de meldingen?")}</strong>
        <div className="notif-layouts" style={{ marginTop: ".6rem" }}>
          {d.layouts.map((k) => (
            <button key={k} type="button" disabled={!canEdit} className={`notif-layout ${s.layout === k ? "active" : ""}`} onClick={() => save({ layout: k })}>
              <Sketch k={k} /><strong>{tx(LAYOUTS[k][0])}</strong><small className="muted">{tx(LAYOUTS[k][1])}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="card" style={{ marginBottom: "1rem", display: "grid", gap: ".8rem" }}>
        <Switch checked={s.toasts} disabled={!canEdit} onChange={(v) => save({ toasts: v })} label={tx("Nieuwe melding ook als pop-up tonen")} />
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "end" }}>
          <label>{tx("Positie pop-up")}<br />
            <select value={s.toast_position} disabled={!canEdit || !s.toasts} onChange={(e) => save({ toast_position: e.target.value })}>
              {d.positions.map((p) => <option key={p} value={p}>{tx({ "top-right": "Rechtsboven", "top-center": "Midden boven", "bottom-right": "Rechtsonder", "bottom-left": "Linksonder" }[p])}</option>)}
            </select></label>
          <label>{tx("Seconden zichtbaar")}<br /><input type="number" min="2" max="60" value={s.toast_seconds} disabled={!canEdit || !s.toasts} onChange={(e) => save({ toast_seconds: Number(e.target.value) })} style={{ width: 90 }} /></label>
          <label>{tx("Aantal in lijst of paneel")}<br /><input type="number" min="3" max="50" value={s.bell_max} disabled={!canEdit} onChange={(e) => save({ bell_max: Number(e.target.value) })} style={{ width: 90 }} /></label>
          <label>{tx("Gelezen bewaren (dagen, 0 = altijd)")}<br /><input type="number" min="0" max="3650" value={s.keep_days} disabled={!canEdit} onChange={(e) => save({ keep_days: Number(e.target.value) })} style={{ width: 90 }} /></label>
        </div>
        <Switch checked={s.group} disabled={!canEdit} onChange={(v) => save({ group: v })} label={tx("Meerdere ongelezen van dezelfde soort samenvoegen (3× Nieuw bericht)")} />
        <Switch checked={s.email} disabled={!canEdit} onChange={(v) => save({ email: v })} label={tx("E-mail bij meldingen toestaan")} />
        <Switch checked={s.email_instant} disabled={!canEdit || !s.email} onChange={(v) => save({ email_instant: v })} label={tx("E-mail direct versturen")} />
      </div>
      <p className="muted">{tx("Totaal {0} meldingen, waarvan {1} ongelezen.", d.stats.total, d.stats.unread)}</p>
    </>
  );
}

function Kinds({ canEdit }) {
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState(null);
  useEffect(() => { api("/notify/admin/").then(setD).catch((e) => setMsg(errorText(e))); }, []);
  if (!d) return msg ? <div className="alert">{msg}</div> : <Busy />;
  const s = d.settings;
  const set = async (k, patch) => {
    const kinds = { ...s.kinds, [k]: { ...s.kinds[k], ...patch } };
    setD({ ...d, settings: { ...s, kinds } });
    try { await api("/notify/admin/", { method: "PUT", body: { ...s, kinds } }); setMsg(null); } catch (e) { setMsg(errorText(e)); }
  };
  const editable = (k, field) => canEdit && k.key !== "system" || (canEdit && field !== "enabled");
  const usable = (k, field) => editable(k, field) && (field === "enabled" || s.kinds[k.key].enabled) && (field !== "email" || s.email);
  const colAll = (field, label) => {
    const rows = d.kinds.filter((k) => usable(k, field));
    const on = rows.length > 0 && rows.every((k) => s.kinds[k.key][field]);
    const setAll = async (v) => {
      const kinds = { ...s.kinds };
      rows.forEach((k) => { kinds[k.key] = { ...kinds[k.key], [field]: v }; });
      setD({ ...d, settings: { ...s, kinds } });
      try { await api("/notify/admin/", { method: "PUT", body: { ...s, kinds } }); setMsg(null); } catch (e) { setMsg(errorText(e)); }
    };
    return <span className="col-all"><span>{tx(label)}</span><Switch checked={on} disabled={!rows.length} onChange={setAll} /></span>;
  };
  return (
    <div className="card" style={{ overflowX: "auto" }}>
      {msg && <div className="alert">{msg}</div>}
      <p className="muted" style={{ marginTop: 0 }}>{tx("Per soort: staat de soort aan, en wat is de standaard voor nieuwe gebruikers. Gebruikers kunnen dit zelf aanpassen bij Meldingen → Instellingen.")}</p>
      <table className="notif-prefs">
        <thead><tr><th>{tx("Soort")}</th><th>{tx("Module")}</th><th>{colAll("enabled", "Aan")}</th><th>{colAll("show", "Standaard tonen")}</th><th>{colAll("email", "Standaard e-mail")}</th></tr></thead>
        <tbody>
          {d.kinds.map((k) => {
            const c = s.kinds[k.key];
            return (
              <tr key={k.key}>
                <td><strong>{tx(k.label)}</strong><br /><small className="muted">{tx(k.desc)}</small></td>
                <td><small>{k.module}</small></td>
                <td><Switch checked={c.enabled} disabled={!canEdit || k.key === "system"} onChange={(v) => set(k.key, { enabled: v })} /></td>
                <td><Switch checked={c.show} disabled={!canEdit || !c.enabled} onChange={(v) => set(k.key, { show: v })} /></td>
                <td><Switch checked={c.email} disabled={!canEdit || !c.enabled || !s.email} onChange={(v) => set(k.key, { email: v })} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Send() {
  const [f, setF] = useState({ title: "", body: "", url: "", level: "info", audience: "all" });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { const r = await api("/notify/admin/send/", { method: "POST", body: f }); setMsg({ ok: true, text: tx("Verstuurd naar {0} gebruikers.", r.sent) }); setF({ ...f, title: "", body: "", url: "" }); } catch (err) { setMsg({ ok: false, text: errorText(err) }); }
    setBusy(false);
  };
  return (
    <form className="card" onSubmit={send} style={{ display: "grid", gap: ".7rem", maxWidth: 640 }}>
      {msg && <div className={msg.ok ? "notice" : "alert"}>{msg.text}</div>}
      <label>{tx("Titel")}<input value={f.title} maxLength={200} onChange={(e) => setF({ ...f, title: e.target.value })} required /></label>
      <label>{tx("Bericht")}<textarea rows={3} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></label>
      <label>{tx("Link (optioneel)")}<input value={f.url} placeholder="/nieuws" onChange={(e) => setF({ ...f, url: e.target.value })} /></label>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <label>{tx("Soort")}<br /><select value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}>{[["info", "Info"], ["success", "Goed nieuws"], ["warning", "Let op"], ["danger", "Belangrijk"]].map(([k, l]) => <option key={k} value={k}>{tx(l)}</option>)}</select></label>
        <label>{tx("Aan wie")}<br /><select value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}><option value="all">{tx("Alle gebruikers")}</option><option value="staff">{tx("Alleen beheerders")}</option></select></label>
      </div>
      <div><button type="submit" className="btn primary" disabled={busy || !f.title.trim()}>{tx("Versturen")}</button></div>
    </form>
  );
}

export default function NotificationsAdmin() {
  const { user } = useAuth();
  const [tab, setTab] = useState("settings");
  const L = lvl(user, "notifications");
  return (
    <>
      <DashHero title="Notificaties" textId="page.admin-notifications.intro" fallback="Bepaal hoe meldingen werken en welke soorten gebruikers krijgen." />
      <Tabs value={tab} onChange={setTab} tabs={[["settings", "Instellingen"], ["kinds", "Soorten"], ["send", "Bericht versturen"]]} />
      <div style={{ marginTop: "1rem" }}>
        {tab === "settings" && <Settings canEdit={L >= 2} />}
        {tab === "kinds" && <Kinds canEdit={L >= 2} />}
        {tab === "send" && (L >= 2 ? <Send /> : <p className="muted">{tx("Je hebt geen rechten om berichten te versturen.")}</p>)}
      </div>
    </>
  );
}
