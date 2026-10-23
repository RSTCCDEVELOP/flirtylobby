// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { Busy } from "./PageLoader";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";

const Switch = ({ checked, onChange, disabled }) => (
  <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /><span /></span></label>
);

export default function NotificationPrefs({ bare = false }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api("/notify/prefs/").then(setD).catch((e) => setError(errorText(e))); }, []);
  if (!d) return error ? <div className="alert">{error}</div> : <Busy />;
  const set = async (k, field, v) => {
    const kinds = d.kinds.map((x) => (x.key === k ? { ...x, [field]: v } : x));
    setD({ ...d, kinds });
    const row = kinds.find((x) => x.key === k);
    try { await api("/notify/prefs/", { method: "PUT", body: { kinds: { [k]: { show: row.show, email: row.email } } } }); } catch (e) { setError(errorText(e)); }
  };
  // one switch per column: everything on or off (only what the person may change)
  const can = (k, field) => (field === "show" ? k.user_can_hide : d.email_on);
  const val = (k, field) => (field === "email" ? k.email && d.email_on : k.show);
  const rows = (field) => d.kinds.filter((k) => can(k, field));
  const allOn = (field) => rows(field).length > 0 && rows(field).every((k) => val(k, field));
  const setAll = async (field, v) => {
    const kinds = d.kinds.map((x) => (can(x, field) ? { ...x, [field]: v } : x));
    setD({ ...d, kinds });
    try { await api("/notify/prefs/", { method: "PUT", body: { kinds: Object.fromEntries(rows(field).map((k) => { const r = kinds.find((x) => x.key === k.key); return [k.key, { show: r.show, email: r.email }]; })) } }); } catch (e) { setError(errorText(e)); }
  };
  const head = (field, label) => (
    <th><span className="col-all"><span>{tx(label)}</span><Switch checked={allOn(field)} disabled={!rows(field).length} onChange={(v) => setAll(field, v)} /></span></th>
  );
  return (
    <div className={bare ? "" : "card"} style={{ overflowX: "auto" }}>
      {error && <div className="alert">{error}</div>}
      <p className="muted" style={{ marginTop: 0 }}>{tx("Kies per soort of je de melding wilt zien en of je er een e-mail van wilt. Wijzigingen worden direct opgeslagen.")}</p>
      <table className="notif-prefs">
        <thead><tr><th>{tx("Soort")}</th>{head("show", "Tonen")}{head("email", "E-mail")}</tr></thead>
        <tbody>
          {d.kinds.map((k) => (
            <tr key={k.key}>
              <td><strong>{tx(k.label)}</strong><br /><small className="muted">{tx(k.desc)}</small></td>
              <td><Switch checked={k.show} disabled={!k.user_can_hide} onChange={(v) => set(k.key, "show", v)} /></td>
              <td><Switch checked={k.email && d.email_on} disabled={!d.email_on} onChange={(v) => set(k.key, "email", v)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {!d.email_on && <p className="muted">{tx("E-mail voor meldingen staat uit op deze website.")}</p>}
    </div>
  );
}

