// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../../../../lib/t";
import { confirmDialog } from "../../../../lib/dialog";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import { lvl } from "../../../../lib/perms";
import Collapsible from "../../../../components/Collapsible";
import { api, errorText } from "../../../../lib/api";

const EMPTY = { name: "", description: "", permissions: [] };

export default function Roles() {
  const { user } = useAuth();
  const L = lvl(user, "roles");
  const [roles, setRoles] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);

  const load = useCallback(() => api("/roles/").then(setRoles).catch((e) => setError(errorText(e))), []);
  useEffect(() => {
    load();
    api("/roles/catalog/").then(setCatalog).catch(() => {});
  }, [load]);

  const label = Object.fromEntries(catalog.flatMap((g) => g.permissions.map((p) => [p.key, p.label])));

  async function remove(r) {
    if (!(await confirmDialog(tx("Rol \"{0}\" verwijderen? {1}", r.name, r.user_count ? `${r.user_count} gebruiker(s) verliezen deze rol.` : ""), { danger: true }))) return;
    try { await api(`/roles/${r.id}/`, { method: "DELETE" }); load(); } catch (e) { setError(errorText(e)); }
  }

  async function save(e) {
    e.preventDefault();
    const { id, error: _e, user_count, slug, ...body } = modal;
    try {
      await (id ? api(`/roles/${id}/`, { method: "PATCH", body }) : api("/roles/", { method: "POST", body }));
      setModal(null);
      load();
    } catch (err) {
      setModal({ ...modal, error: errorText(err) });
    }
  }

  const toggle = (key) => setModal({ ...modal, permissions: modal.permissions.includes(key) ? modal.permissions.filter((k) => k !== key) : [...modal.permissions, key] });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{tx("Rollen")}</h1>
          <p className="muted" style={{ margin: 0 }}>{tx("Bepaal wat gebruikers mogen. Een gebruiker kan meerdere rollen hebben. Een superadmin heeft altijd alle rechten, een Admin ook maar ziet en wijzigt geen superadmins. Een rol zonder rechten geeft alleen een eigen dashboard en profiel.")}</p>
        </div>
        {L >= 3 && <button className="btn primary" onClick={() => setModal({ ...EMPTY })}>{tx("+ Nieuwe rol")}</button>}
      </div>
      {error && <div className="alert">{error}</div>}

      <Collapsible id="roles-list" title={tx("Rollen")}>
      <div className="int-list">
        <div className="card int-item">
          <div className="int-main">
            <strong>{tx("Superadmin")} <span className="badge ok" style={{ marginLeft: ".4rem" }}>{tx("ingebouwd")}</span></strong>
            <span className="muted">{tx("Alle rechten. Als enige te beheren: andere superadmins, en wie een Admin of superadmin mag zijn.")}</span>
            <span className="muted" style={{ fontSize: ".85rem" }}>{tx("Instellen via het vinkje \"Superadmin\" bij een gebruiker.")}</span>
          </div>
        </div>
        {roles.map((r) => (
          <div className="card int-item" key={r.id}>
            <div className="int-main">
              <strong>{r.name} <span className="badge ok" style={{ marginLeft: ".4rem" }}>{r.user_count} {tx("gebruiker")}{r.user_count === 1 ? "" : "s"}</span></strong>
              <span className="muted">{r.description || "—"}</span>
              <span className="chips" style={{ margin: ".4rem 0 0" }}>
                {r.all_permissions ? <span className="chip" style={{ cursor: "default" }}>{tx("Alle rechten")}</span> : r.permissions.length ? r.permissions.map((k) => <span key={k} className="chip" style={{ cursor: "default" }}>{label[k] || k}</span>) : <span className="muted" style={{ fontSize: ".85rem" }}>{tx("Geen extra rechten: alleen eigen dashboard")}</span>}
              </span>
            </div>
            {r.locked ? <span className="badge ok">{tx("ingebouwd")}</span> : (
              <div className="int-actions">
                {L >= 2 && <button className="btn sm" onClick={() => setModal({ ...r })}>{tx("Wijzig")}</button>}
                {L >= 3 && <button className="btn sm danger" onClick={() => remove(r)}>{tx("Verwijder")}</button>}
              </div>
            )}
          </div>
        ))}
      </div>
      </Collapsible>

      {modal && (
        <div className="overlay" onClick={() => setModal(null)}>
          <form className="card modal form" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h2>{modal.id ? tx("Rol wijzigen") : tx("Nieuwe rol")}</h2>
            <label>{tx("Naam")}<input value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} required maxLength={100} placeholder={tx("bv. Content manager")} /></label>
            <label>{tx("Omschrijving")}<input value={modal.description} onChange={(e) => setModal({ ...modal, description: e.target.value })} maxLength={255} /></label>
            {catalog.map((g) => (
              <div key={g.group}>
                <strong style={{ fontSize: ".85rem" }}>{tx(g.group)}</strong>
                <div className="perm-list">
                  {g.permissions.map((p) => (
                    <label className="check" key={p.key}>
                      <input type="checkbox" checked={modal.permissions.includes(p.key)} onChange={() => toggle(p.key)} /> {p.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
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
