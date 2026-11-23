// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { tx } from "../lib/t";
import { IconUser, IconUsers } from "./Icons";

// The rights system on one screen: users and groups of users with the rights to view, edit and delete (see backend/apps/accounts/rights.py).
// `entries` = [{type: "user"|"group", id, name, view, edit, delete}]; onChange(entries) after every change. The same editor is used for modules, pages and records of plugins.
export const RIGHTS = [["view", "Bekijken"], ["edit", "Bewerken"], ["delete", "Verwijderen"]];

// the users and groups to choose from (one request for the whole screen)
export function useRightsPeople(enabled = true) {
  const [people, setPeople] = useState({ users: [], groups: [], ready: false });
  useEffect(() => { if (enabled) api("/rights/people/").then((d) => setPeople({ ...d, ready: true })).catch(() => setPeople({ users: [], groups: [], ready: true })); }, [enabled]);
  return people;
}

export default function RightsEditor({ entries, onChange, people, disabled = false, hint = "", emptyText = "", chain = false }) {  // chain: a right includes the lower ones (modules: view < edit < delete); without it every right has a list of its own (pages and records)
  const [kind, setKind] = useState("group");
  const [pick, setPick] = useState("");
  const has = (e) => entries.some((x) => x.type === e.type && x.id === e.id);
  const options = (kind === "user" ? people.users : people.groups).filter((o) => !entries.some((x) => x.type === kind && x.id === o.id));
  const set = (i, patch) => onChange(entries.map((e, n) => (n === i ? { ...e, ...patch } : e)));
  const add = () => {
    const o = options.find((x) => String(x.id) === String(pick));
    if (!o || has({ type: kind, id: o.id })) return;
    onChange([...entries, { type: kind, id: o.id, name: o.name, view: true, edit: false, delete: false }]);
    setPick("");
  };
  const flip = (i, key, on) => {
    const order = RIGHTS.map(([k]) => k), at = order.indexOf(key), next = { ...entries[i], [key]: on };
    if (chain) order.forEach((k, n) => { if (on ? n < at : n > at) next[k] = on ? true : false; });  // ticked on: the lower rights go on too; ticked off: the higher rights go off too
    set(i, next);
  };
  return (
    <div className="rights" data-easy2edit-tag="ui-data-table" style={{ display: "grid", gap: ".7rem" }}>
      {hint && <p className="muted" style={{ margin: 0 }}>{tx(hint)}</p>}
      <div style={{ overflowX: "auto" }}>
        <table className="rights-table" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={{ textAlign: "left" }}>{tx("Gebruiker of groep")}</th>{RIGHTS.map(([k, l]) => <th key={k} style={{ textAlign: "center", whiteSpace: "nowrap" }}>{tx(l)}</th>)}<th /></tr></thead>
          <tbody>
            {entries.length === 0 && <tr><td colSpan={RIGHTS.length + 2} className="muted">{tx(emptyText || "Nog niemand.")}</td></tr>}
            {entries.map((e, i) => (
              <tr key={`${e.type}${e.id}`}>
                <td><span style={{ display: "inline-flex", alignItems: "center", gap: ".45rem" }}>{e.type === "group" ? <IconUsers /> : <IconUser />}<span>{e.name}</span><small className="muted">{tx(e.type === "group" ? "Groep" : "User")}</small></span></td>
                {RIGHTS.map(([k, l]) => (
                  <td key={k} style={{ textAlign: "center" }}>
                    <label className="check" style={{ justifyContent: "center" }} title={tx(l)}><span className="switch"><input type="checkbox" aria-label={`${e.name}: ${tx(l)}`} disabled={disabled} checked={!!e[k]} onChange={(ev) => flip(i, k, ev.target.checked)} /><span /></span></label>
                  </td>
                ))}
                <td style={{ textAlign: "right" }}><button type="button" className="btn sm danger" disabled={disabled} onClick={() => onChange(entries.filter((_, n) => n !== i))} aria-label={tx("Verwijder")} title={tx("Verwijder")}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!disabled && (
        <div className="grant-add" style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", alignItems: "center" }}>
          <select value={kind} onChange={(e) => { setKind(e.target.value); setPick(""); }} aria-label={tx("Soort")} style={{ flex: "0 0 auto" }}>
            <option value="group">{tx("User group")}</option><option value="user">{tx("User")}</option>
          </select>
          <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label={tx("Kies")} style={{ flex: "1 1 14rem", minWidth: 0 }}>
            <option value="">{people.ready ? tx("Kies…") : tx("Laden…")}</option>
            {options.map((o) => <option key={o.id} value={o.id}>{kind === "user" ? `${o.name} (${o.email})` : o.name}</option>)}
          </select>
          <button type="button" className="btn primary" disabled={!pick} onClick={add}>{tx("Toevoegen")}</button>
        </div>
      )}
    </div>
  );
}
