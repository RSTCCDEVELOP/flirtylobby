// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useCallback, useEffect, useState } from "react";
import { Busy } from "../../../../components/PageLoader";
import RightsEditor, { useRightsPeople } from "../../../../components/RightsEditor";
import Tabs from "../../../../components/Tabs";
import { api, errorText } from "../../../../lib/api";
import { tx } from "../../../../lib/t";
import KitScope from "../../../../lib/ui-kit/KitScope";

// Rights (standard, always on): who may view, edit and delete what. Users and groups of users, for every module, every page and the records of plugins.
// The rights of a module are stored as the access of that module (view = use, edit = edit, delete = manage); a page has lists of its own, and so has every record of a plugin (see backend/apps/accounts/rights.py).
export default function RightsPage() {
  const people = useRightsPeople();
  const [tab, setTab] = useState("modules");
  const [ov, setOv] = useState(null);
  const [msg, setMsg] = useState(null);
  const load = useCallback(() => api("/rights/overview/").then(setOv).catch((e) => setMsg({ ok: false, text: errorText(e) })), []);
  useEffect(() => { load(); }, [load]);
  if (!ov) return msg ? <div className="alert">{msg.text}</div> : <Busy page />;
  return (
    <KitScope bridge>
      <div className="page-head"><div><h1>{tx("Rechten")}</h1>
        <p className="muted" style={{ margin: 0 }}>{tx("Wie mag wat: gebruikers en groepen krijgen rechten om te bekijken, te bewerken en te verwijderen. Voor alle modules, voor elke pagina en voor de records van plugins.")}</p></div></div>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} role="status">{msg.text}</div>}
      <div className="card" style={{ padding: "1rem", display: "grid", gap: ".9rem" }}>
        <Tabs value={tab} onChange={(t) => { setTab(t); setMsg(null); }} tabs={[["modules", "Modules"], ["pages", "Pagina's"], ["plugins", "Plugins"]]} />
        {tab === "modules" && <ModuleRights modules={ov.modules} people={people} setMsg={setMsg} reload={load} />}
        {tab === "pages" && <PageRights people={people} setMsg={setMsg} />}
        {tab === "plugins" && <PluginRights plugins={ov.plugins} setMsg={setMsg} reload={load} />}
      </div>
    </KitScope>
  );
}

// a module: choose it, give users and groups their rights, save
function ModuleRights({ modules, people, setMsg, reload }) {
  const [key, setKey] = useState("");
  const [entries, setEntries] = useState([]);
  const [busy, setBusy] = useState(false);
  const open = async (k) => {
    setKey(k); setMsg(null); setEntries([]);
    if (!k) return;
    try { setEntries((await api(`/rights/module/${k}/`)).entries); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  };
  const save = async () => {
    setBusy(true); setMsg(null);
    try { setEntries((await api(`/rights/module/${key}/`, { method: "PUT", body: { entries } })).entries); setMsg({ ok: true, text: tx("Opgeslagen.") }); reload(); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  const groups = [...new Set(modules.map((m) => m.group || "Overig"))];
  return (
    <div style={{ display: "grid", gap: ".8rem" }}>
      <label>{tx("Module")}
        <select value={key} onChange={(e) => open(e.target.value)}>
          <option value="">{tx("Kies een module…")}</option>
          {groups.map((g) => <optgroup key={g} label={tx(g)}>{modules.filter((m) => (m.group || "Overig") === g).map((m) => <option key={m.key} value={m.key}>{tx(m.label)}{m.entries ? ` (${m.entries})` : ""}</option>)}</optgroup>)}
        </select>
      </label>
      {key && <>
        <RightsEditor chain entries={entries} onChange={setEntries} people={people}
          hint="Wie hier niets heeft, heeft geen toegang tot de module (beheerders hebben altijd alles). Bekijken = gebruiken, Bewerken = wijzigen, Verwijderen = ook verwijderen en beheren. Rollen blijven werken zoals ze waren." emptyText="Nog geen gebruikers of groepen met een eigen recht." />
        <div><button type="button" className="btn primary" disabled={busy} onClick={save}>{tx("Opslaan")}</button></div>
      </>}
    </div>
  );
}

// a page: the same lists as in the settings of the page
function PageRights({ people, setMsg }) {
  const [pages, setPages] = useState([]);
  const [key, setKey] = useState("");
  const [entries, setEntries] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { Promise.all([api("/pages/?scope=public"), api("/pages/?scope=private")]).then(([a, b]) => setPages([...(a.pages || []), ...(b.pages || [])])).catch(() => {}); }, []);
  const open = async (k) => {
    setKey(k); setMsg(null); setEntries([]);
    if (!k) return;
    try { setEntries((await api(`/rights/page/${k}/`)).entries); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  };
  const save = async () => {
    setBusy(true); setMsg(null);
    try { setEntries((await api(`/rights/page/${key}/`, { method: "PUT", body: { entries } })).entries); setMsg({ ok: true, text: tx("Opgeslagen.") }); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  const titleOf = (p) => Object.values(p.title || {})[0] || p.key;
  return (
    <div style={{ display: "grid", gap: ".8rem" }}>
      <label>{tx("Pagina")}
        <select value={key} onChange={(e) => open(e.target.value)}>
          <option value="">{tx("Kies een pagina…")}</option>
          {pages.map((p) => <option key={p.key} value={p.key}>{titleOf(p)}</option>)}
        </select>
      </label>
      {key && <>
        <RightsEditor entries={entries} onChange={setEntries} people={people}
          hint="Elk recht heeft een eigen lijst. Een recht zonder lijst heeft geen beperking: dan gelden de rechten van de module Pagina's. Staat er wel een lijst, dan mogen alleen zij het (en wie het hoger recht heeft). Beheerders en wie de pagina's beheert mogen altijd." emptyText="Geen beperkingen: iedereen met het recht van de module." />
        <div><button type="button" className="btn primary" disabled={busy} onClick={save}>{tx("Opslaan")}</button></div>
      </>}
    </div>
  );
}

// plugins: the records of a plugin can have rights; here a superadmin decides whether people who are no administrator may set them
function PluginRights({ plugins, setMsg, reload }) {
  const set = async (p, on) => {
    setMsg(null);
    try { await api(`/rights/plugin/${p.name}/`, { method: "PUT", body: { rights_members: on } }); reload(); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  };
  return (
    <div style={{ display: "grid", gap: ".8rem" }}>
      <p className="muted" style={{ margin: 0 }}>{tx("De records van een plugin (een product, een document …) kunnen eigen rechten hebben: wie ze mag bekijken, bewerken en verwijderen. Het maken van die rechten doet de plugin; hier bepaal je per plugin of ook gebruikers die geen admin zijn rechten mogen zetten voor hun eigen records.")}</p>
      {plugins.length === 0 ? <p className="muted">{tx("Er zijn geen plugins.")}</p> : (
        <div className="e2e-table-wrap" style={{ overflowX: "auto" }}>
          <table className="e2e-table" style={{ width: "100%" }}>
            <thead><tr><th style={{ textAlign: "left" }}>{tx("Plugin")}</th><th style={{ textAlign: "left" }}>{tx("Records met rechten")}</th><th style={{ textAlign: "center" }}>{tx("Ook gebruikers die geen admin zijn mogen rechten zetten")}</th></tr></thead>
            <tbody>
              {plugins.map((p) => (
                <tr key={p.name}>
                  <td><b>{p.title}</b>{!p.enabled && <small className="muted" style={{ display: "block" }}>{tx("Staat uit")}</small>}{p.models.length > 0 && <small className="muted" style={{ display: "block" }}>{p.models.join(", ")}</small>}</td>
                  <td>{p.restricted_records}</td>
                  <td style={{ textAlign: "center" }}><label className="check" style={{ justifyContent: "center" }}><span className="switch"><input type="checkbox" aria-label={`${p.title}: ${tx("Ook gebruikers die geen admin zijn mogen rechten zetten")}`} checked={!!p.rights_members} onChange={(e) => set(p, e.target.checked)} /><span /></span></label></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
