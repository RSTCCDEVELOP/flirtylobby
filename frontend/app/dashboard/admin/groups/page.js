// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../../../../lib/t";
import { confirmDialog } from "../../../../lib/dialog";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import AccessList from "../../../../components/AccessList";
import Collapsible from "../../../../components/Collapsible";
import Tabs from "../../../../components/Tabs";
import { IconBriefcase } from "../../../../components/Icons";
import KitScope from "../../../../lib/ui-kit/KitScope";
import { TagChip, TagPicker, useTagMap } from "../../../../components/Tags";
import { api, errorText } from "../../../../lib/api";
import { lvl } from "../../../../lib/perms";

const EMPTY = { name: "", description: "", roles: [], members: [], entity_ids: [] };
const nameOf = (u) => [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email;

export default function Groups() {
  const { user } = useAuth();
  const L = lvl(user, "users");
  const [groups, setGroups] = useState([]);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const tagMap = useTagMap("group"); // the tags of the groups
  const [entities, setEntities] = useState([]);
  useEffect(() => { api("/entities/").then(setEntities).catch(() => {}); }, []);
  const [modules, setModules] = useState([]);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("general");

  const load = useCallback(() => api("/user-groups/").then(setGroups).catch((e) => setError(errorText(e))), []);
  useEffect(() => {
    load();
    api("/roles/").then(setRoles).catch(() => {});
    api("/users/").then(setUsers).catch(() => {});
    if (user.is_staff) api("/modules/all/").then((m) => setModules(m.filter((x) => x.acl))).catch(() => {});
  }, [load, user.is_staff]);

  const roleName = Object.fromEntries(roles.map((r) => [r.id, r.name]));

  async function openEdit(g) {
    let access = {};
    if (user.is_staff && g?.id) {
      try {
        const grants = await api(`/module-grants/?group=${g.id}`);
        access = Object.fromEntries(grants.map((x) => [x.module, { id: x.id, level: x.level }]));
      } catch {}
    }
    setQ(""); setTab("general");
    setModal({ ...EMPTY, ...g, access, original: access, entity_ids: (g?.entities || []).map((x) => x.id) });
  }

  async function remove(g) {
    if (!(await confirmDialog(tx("Groep \"{0}\" verwijderen? Leden verliezen de rollen en module-toegang van deze groep.", g.name), { danger: true }))) return;
    try { await api(`/user-groups/${g.id}/`, { method: "DELETE" }); load(); } catch (e) { setError(errorText(e)); }
  }

  async function save(e) {
    e.preventDefault();
    const { id, name, description, roles: r, members, entity_ids } = modal;
    try {
      const saved = await (id
        ? api(`/user-groups/${id}/`, { method: "PATCH", body: { name, description, roles: r, members, entity_ids } })
        : api("/user-groups/", { method: "POST", body: { name, description, roles: r, members, entity_ids } }));
      if (user.is_staff) { // module access: only the differences
        for (const m of modules) {
          const now = modal.access[m.key]?.level || 0, before = modal.original[m.key]?.level || 0;
          if (now === before) continue;
          if (now === 0) await api(`/module-grants/${modal.original[m.key].id}/`, { method: "DELETE" });
          else await api("/module-grants/", { method: "POST", body: { module: m.key, type: "group", id: saved.id, level: now } });
        }
      }
      setModal(null);
      load();
    } catch (err) {
      setModal({ ...modal, error: errorText(err) });
    }
  }

  const toggle = (field, id) => setModal({ ...modal, [field]: modal[field].includes(id) ? modal[field].filter((x) => x !== id) : [...modal[field], id] });
  const shownUsers = useMemo(() => users.filter((u) => !u.is_staff && (nameOf(u) + u.email).toLowerCase().includes(q.toLowerCase())), [users, q]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{tx("User groups")}</h1>
          <p className="muted" style={{ margin: 0 }}>{tx("Groepen van users. Een groep kun je koppelen aan rollen en aan modules: alle leden krijgen die rechten.")}</p>
        </div>
        {L >= 3 && <button className="btn primary" onClick={() => openEdit(null)}>{tx("+ Nieuwe groep")}</button>}
      </div>
      {error && <div className="alert">{error}</div>}

      <Collapsible id="groups-list" title={tx("User groups")}>
        <KitScope tag="ui-data-table"><div className="int-list">
          {groups.map((g) => (
            <div className="card int-item" key={g.id}>
              <div className="int-main">
                <strong>{g.name} <span className="badge ok" style={{ marginLeft: ".4rem" }}>{g.member_count} {tx("user")}{g.member_count === 1 ? "" : "s"}</span></strong>
                <span className="muted">{g.description || "—"}</span>
                <span className="chips" style={{ margin: ".4rem 0 0" }}>
                  {g.roles.length ? g.roles.map((id) => <span key={id} className="chip" style={{ cursor: "default" }}>{roleName[id] || "…"}</span>) : <span className="muted" style={{ fontSize: ".85rem" }}>{tx("Geen rollen gekoppeld")}</span>}
                  {tagMap.of(g.id).map((t) => <TagChip key={`t${t.id}`} tag={t} />)}
                  {(g.entities || []).map((e) => <span key={`e${e.id}`} className="chip" style={{ cursor: "default" }} title={tx("Entiteit")}><IconBriefcase width={12} height={12} /> {e.name}</span>)}
                </span>
              </div>
              <div className="int-actions">
                {L >= 2 && <button className="btn sm" onClick={() => openEdit(g)}>{tx("Wijzig")}</button>}
                {L >= 3 && <button className="btn sm danger" onClick={() => remove(g)}>{tx("Verwijder")}</button>}
              </div>
            </div>
          ))}
          {!groups.length && <p className="muted">{tx("Nog geen groepen.")}</p>}
        </div></KitScope>
      </Collapsible>

      {modal && (
        <div className="overlay" onClick={() => setModal(null)}>
          <form className="card modal form int-modal inv-modal" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h2>{modal.id ? tx("Groep wijzigen") : tx("Nieuwe groep")}</h2>
            <Tabs className="tabs-one-row" value={tab} onChange={setTab} tabs={[
              ["general", "Algemeen"],
              ["roles", "Rollen", null, modal.roles.length || null],
              ["entities", "Entiteiten", null, (modal.entity_ids || []).length || null],
              ...(user.is_staff && modules.length > 0 ? [["modules", "Modules", null, modules.filter((m) => modal.access[m.key]?.level > 0).length || null]] : []),
              ["members", "Leden", null, modal.members.length || null],
            ]} />
            <div className="inv-body">
              {tab === "general" && (
                <div style={{ display: "grid", gap: ".8rem", alignContent: "start" }}>
                  <div className="grid2">
                    <label>{tx("Naam")}<input value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} required maxLength={100} placeholder={tx("bv. Redactie")} /></label>
                    <label>{tx("Omschrijving")}<input value={modal.description} onChange={(e) => setModal({ ...modal, description: e.target.value })} maxLength={255} /></label>
                  </div>
                  {modal.id ? <TagPicker kind="group" refId={modal.id} label={tx("Tags")} canEdit={L >= 2} /> : <p className="muted" style={{ margin: 0 }}>{tx("Tags kun je instellen nadat de groep is opgeslagen.")}</p>}
                </div>
              )}
              {tab === "roles" && (
                <div className="perm-list">
                  {roles.map((r) => (
                    <label className="check sec-toggle" key={r.id}>
                      <span className="switch"><input type="checkbox" checked={modal.roles.includes(r.id)} onChange={() => toggle("roles", r.id)} /><span /></span>
                      <span>{r.name} <small className="muted">{r.description}</small></span>
                    </label>
                  ))}
                  {!roles.length && <span className="muted">{tx("Geen rollen beschikbaar.")}</span>}
                </div>
              )}
              {tab === "entities" && (
                <div className="perm-list">
                  {entities.map((en) => (
                    <label className="check sec-toggle" key={en.id}>
                      <span className="switch"><input type="checkbox" checked={(modal.entity_ids || []).includes(en.id)} onChange={() => toggle("entity_ids", en.id)} /><span /></span>
                      <span>{en.name || tx("Naamloos")} <small className="muted">{tx(en.kind_label)}{en.city ? ` · ${en.city}` : ""}</small></span>
                    </label>
                  ))}
                  {!entities.length && <span className="muted">{tx("Nog geen entiteiten.")}</span>}
                </div>
              )}
              {tab === "modules" && user.is_staff && (
                <AccessList modules={modules} value={Object.fromEntries(Object.entries(modal.access).map(([k, v]) => [k, v?.level || 0]))}
                  onChange={(k, l) => setModal({ ...modal, access: { ...modal.access, [k]: { ...modal.access[k], level: l } } })} />
              )}
              {tab === "members" && (
                <div style={{ display: "grid", gap: ".6rem", alignContent: "start" }}>
                  <input type="search" placeholder={tx("Zoek een user…")} value={q} onChange={(e) => setQ(e.target.value)} />
                  <div className="perm-list">
                    {shownUsers.map((u) => (
                      <label className="check sec-toggle" key={u.id}>
                        <span className="switch"><input type="checkbox" checked={modal.members.includes(u.id)} onChange={() => toggle("members", u.id)} /><span /></span>
                        <span>{nameOf(u)} <small className="muted">{u.email}</small></span>
                      </label>
                    ))}
                    {!shownUsers.length && <span className="muted">{tx("Geen users gevonden.")}</span>}
                  </div>
                </div>
              )}
            </div>
            {modal.error && <div className="alert">{modal.error}</div>}
            <div className="row inv-foot">
              <button type="button" className="btn" onClick={() => setModal(null)}>{tx("Annuleren")}</button>
              <button className="btn primary">{tx("Opslaan")}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
