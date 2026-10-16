"use client";

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
    if (!confirm(`Rol "${r.name}" verwijderen? ${r.user_count ? `${r.user_count} gebruiker(s) verliezen deze rol.` : ""}`)) return;
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
          <h1>Rollen</h1>
          <p className="muted" style={{ margin: 0 }}>Bepaal wat gebruikers mogen. Een gebruiker kan meerdere rollen hebben. Een superadmin heeft altijd alle rechten, een Admin ook maar ziet en wijzigt geen superadmins. Een rol zonder rechten geeft alleen een eigen dashboard en profiel.</p>
        </div>
        {L >= 3 && <button className="btn primary" onClick={() => setModal({ ...EMPTY })}>+ Nieuwe rol</button>}
      </div>
      {error && <div className="alert">{error}</div>}

      <Collapsible id="roles-list" title="Rollen">
      <div className="int-list">
        <div className="card int-item">
          <div className="int-main">
            <strong>Superadmin <span className="badge ok" style={{ marginLeft: ".4rem" }}>ingebouwd</span></strong>
            <span className="muted">Alle rechten. Als enige te beheren: andere superadmins, en wie een Admin of superadmin mag zijn.</span>
            <span className="muted" style={{ fontSize: ".85rem" }}>Instellen via het vinkje "Superadmin" bij een gebruiker.</span>
          </div>
        </div>
        {roles.map((r) => (
          <div className="card int-item" key={r.id}>
            <div className="int-main">
              <strong>{r.name} <span className="badge ok" style={{ marginLeft: ".4rem" }}>{r.user_count} gebruiker{r.user_count === 1 ? "" : "s"}</span></strong>
              <span className="muted">{r.description || "—"}</span>
              <span className="chips" style={{ margin: ".4rem 0 0" }}>
                {r.all_permissions ? <span className="chip" style={{ cursor: "default" }}>Alle rechten</span> : r.permissions.length ? r.permissions.map((k) => <span key={k} className="chip" style={{ cursor: "default" }}>{label[k] || k}</span>) : <span className="muted" style={{ fontSize: ".85rem" }}>Geen extra rechten: alleen eigen dashboard</span>}
              </span>
            </div>
            {r.locked ? <span className="badge ok">ingebouwd</span> : (
              <div className="int-actions">
                {L >= 2 && <button className="btn sm" onClick={() => setModal({ ...r })}>Wijzig</button>}
                {L >= 3 && <button className="btn sm danger" onClick={() => remove(r)}>Verwijder</button>}
              </div>
            )}
          </div>
        ))}
      </div>
      </Collapsible>

      {modal && (
        <div className="overlay" onClick={() => setModal(null)}>
          <form className="card modal form" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h2>{modal.id ? "Rol wijzigen" : "Nieuwe rol"}</h2>
            <label>Naam<input value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} required maxLength={100} placeholder="bv. Content manager" /></label>
            <label>Omschrijving<input value={modal.description} onChange={(e) => setModal({ ...modal, description: e.target.value })} maxLength={255} /></label>
            {catalog.map((g) => (
              <div key={g.group}>
                <strong style={{ fontSize: ".85rem" }}>{g.group}</strong>
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
              <button type="button" className="btn" onClick={() => setModal(null)}>Annuleren</button>
              <button className="btn primary">Opslaan</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
