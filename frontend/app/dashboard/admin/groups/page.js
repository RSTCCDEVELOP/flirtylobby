"use client";

import { tx } from "../../../../lib/t";
import { confirmDialog } from "../../../../lib/dialog";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import Collapsible from "../../../../components/Collapsible";
import { api, errorText } from "../../../../lib/api";
import { lvl } from "../../../../lib/perms";

const EMPTY = { name: "", description: "", roles: [], members: [] };
const LEVELS = [[0, "Geen toegang"], [1, "1. Gebruik"], [2, "2. Bewerken"], [3, "3. Beheer"]];
const nameOf = (u) => [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email;

export default function Groups() {
  const { user } = useAuth();
  const L = lvl(user, "users");
  const [groups, setGroups] = useState([]);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [modules, setModules] = useState([]);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);
  const [q, setQ] = useState("");

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
    setQ("");
    setModal({ ...EMPTY, ...g, access, original: access });
  }

  async function remove(g) {
    if (!(await confirmDialog(tx("Groep \"{0}\" verwijderen? Leden verliezen de rollen en module-toegang van deze groep.", g.name), { danger: true }))) return;
    try { await api(`/user-groups/${g.id}/`, { method: "DELETE" }); load(); } catch (e) { setError(errorText(e)); }
  }

  async function save(e) {
    e.preventDefault();
    const { id, name, description, roles: r, members } = modal;
    try {
      const saved = await (id
        ? api(`/user-groups/${id}/`, { method: "PATCH", body: { name, description, roles: r, members } })
        : api("/user-groups/", { method: "POST", body: { name, description, roles: r, members } }));
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
        <div className="int-list">
          {groups.map((g) => (
            <div className="card int-item" key={g.id}>
              <div className="int-main">
                <strong>{g.name} <span className="badge ok" style={{ marginLeft: ".4rem" }}>{g.member_count} {tx("user")}{g.member_count === 1 ? "" : "s"}</span></strong>
                <span className="muted">{g.description || "—"}</span>
                <span className="chips" style={{ margin: ".4rem 0 0" }}>
                  {g.roles.length ? g.roles.map((id) => <span key={id} className="chip" style={{ cursor: "default" }}>{roleName[id] || "…"}</span>) : <span className="muted" style={{ fontSize: ".85rem" }}>{tx("Geen rollen gekoppeld")}</span>}
                </span>
              </div>
              <div className="int-actions">
                {L >= 2 && <button className="btn sm" onClick={() => openEdit(g)}>{tx("Wijzig")}</button>}
                {L >= 3 && <button className="btn sm danger" onClick={() => remove(g)}>{tx("Verwijder")}</button>}
              </div>
            </div>
          ))}
          {!groups.length && <p className="muted">{tx("Nog geen groepen.")}</p>}
        </div>
      </Collapsible>

      {modal && (
        <div className="overlay" onClick={() => setModal(null)}>
          <form className="card modal form" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h2>{modal.id ? tx("Groep wijzigen") : tx("Nieuwe groep")}</h2>
            <div className="grid2">
              <label>{tx("Naam")}<input value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} required maxLength={100} placeholder={tx("bv. Redactie")} /></label>
              <label>{tx("Omschrijving")}<input value={modal.description} onChange={(e) => setModal({ ...modal, description: e.target.value })} maxLength={255} /></label>
            </div>

            <div>
              <strong style={{ fontSize: ".85rem" }}>{tx("Rollen van deze groep")}</strong>
              <div className="perm-list">
                {roles.map((r) => (
                  <label className="check" key={r.id}>
                    <input type="checkbox" checked={modal.roles.includes(r.id)} onChange={() => toggle("roles", r.id)} /> {r.name} <small className="muted">{r.description}</small>
                  </label>
                ))}
                {!roles.length && <span className="muted">{tx("Geen rollen beschikbaar.")}</span>}
              </div>
            </div>

            {user.is_staff && modules.length > 0 && (
              <div>
                <strong style={{ fontSize: ".85rem" }}>{tx("Toegang tot modules")}</strong>
                <div className="access-grid">
                  {modules.map((m) => (
                    <label key={m.key}>{m.label}
                      <select value={modal.access[m.key]?.level || 0}
                        onChange={(e) => setModal({ ...modal, access: { ...modal.access, [m.key]: { ...modal.access[m.key], level: Number(e.target.value) } } })}>
                        {LEVELS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <strong style={{ fontSize: ".85rem" }}>{tx("Leden (")}{modal.members.length})</strong>
              <input style={{ margin: ".4rem 0" }} placeholder={tx("Zoek een user…")} value={q} onChange={(e) => setQ(e.target.value)} />
              <div className="member-pick">
                {shownUsers.map((u) => (
                  <label className="check" key={u.id}>
                    <input type="checkbox" checked={modal.members.includes(u.id)} onChange={() => toggle("members", u.id)} /> {nameOf(u)} <small className="muted">{u.email}</small>
                  </label>
                ))}
                {!shownUsers.length && <span className="muted">{tx("Geen users gevonden.")}</span>}
              </div>
            </div>

            {modal.error && <div className="alert">{modal.error}</div>}
            <div className="row">
              <button type="button" className="btn" onClick={() => setModal(null)}>{tx("Annuleren")}</button>
              <button className="btn primary">{tx("Opslaan")}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
