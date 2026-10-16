"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../../components/AuthContext";
import Collapsible from "../../../../components/Collapsible";
import { api, errorText, mediaUrl } from "../../../../lib/api";
import { lvl } from "../../../../lib/perms";

const EMPTY = { user_groups: [], email: "", password: "", first_name: "", last_name: "", function: "", short: "", description: "", link: "", link_external: false, show_public: false, roles: [], is_staff: false, file: null };
const initials = (u) => (u.first_name?.[0] || u.email[0]).toUpperCase();

export default function Users() {
  const { user: me } = useAuth();
  const router = useRouter();
  const L = lvl(me, "users"); // 1 gebruik, 2 bewerken, 3 beheer
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [groups, setGroups] = useState([]);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null); // null | form object (with id when editing)

  const load = useCallback(() => api("/users/").then(setUsers).catch((e) => setError(errorText(e))), []);

  useEffect(() => {
    if (lvl(me, "users") < 1) router.replace("/dashboard");
    else { load(); api("/roles/").then(setRoles).catch(() => {}); api("/user-groups/").then(setGroups).catch(() => {}); }
  }, [me, router, load]);

  async function act(fn) {
    setError("");
    try { await fn(); await load(); } catch (e) { setError(errorText(e)); }
  }

  const toggleBlock = (u) => act(() => api(`/users/${u.id}/${u.is_active ? "block" : "unblock"}/`, { method: "POST" }));
  const remove = (u) => confirm(`Gebruiker ${u.email} definitief verwijderen?`) && act(() => api(`/users/${u.id}/`, { method: "DELETE" }));

  async function save(e) {
    e.preventDefault();
    const { id, file, error: _e, image, ...body } = modal;
    if (id && !body.password) delete body.password;
    try {
      const saved = await (id ? api(`/users/${id}/`, { method: "PATCH", body }) : api("/users/", { method: "POST", body }));
      if (file) { // photo chosen while creating
        const fd = new FormData();
        fd.append("image", file);
        await api(`/users/${saved.id}/image/`, { method: "POST", body: fd });
      }
      setModal(null);
      setError("");
      load();
    } catch (err) {
      setModal({ ...modal, error: errorText(err) });
    }
  }

  // photo of an existing user: uploaded / removed straight away
  async function photo(file) {
    if (!modal.id) return setModal({ ...modal, file, preview: file ? URL.createObjectURL(file) : null });
    try {
      let r;
      if (file) { const fd = new FormData(); fd.append("image", file); r = await api(`/users/${modal.id}/image/`, { method: "POST", body: fd }); }
      else r = await api(`/users/${modal.id}/image/`, { method: "DELETE" });
      setModal({ ...modal, image: r.image, file: null });
      load();
    } catch (err) { setModal({ ...modal, error: errorText(err) }); }
  }

  const set = (k) => (e) => setModal({ ...modal, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  return (
    <>
      <div className="page-head">
        <h1>Users</h1>
        {L >= 3 && <button className="btn primary" onClick={() => setModal({ ...EMPTY })}>+ Nieuwe gebruiker</button>}
      </div>
      {error && <div className="alert">{error}</div>}

      <Collapsible id="users-list" title="Gebruikers">
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Naam</th><th>E-mail</th><th>Functie</th><th>Rol</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <span className="user-cell">
                    {u.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(u.image)} alt="" className="avatar-img" /> : <span className="avatar">{initials(u)}</span>}
                    {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
                    {u.show_public && <span className="badge ok" title="Wordt getoond op de website">Op website</span>}
                  </span>
                </td>
                <td>{u.email}</td>
                <td>{u.function || "—"}</td>
                <td>
                  {u.is_staff && <span className="badge ok" style={{ marginRight: ".3rem" }}>Superadmin</span>}
                  {u.roles.map((id) => <span key={id} className="chip" style={{ cursor: "default", marginRight: ".3rem" }}>{roles.find((r) => r.id === id)?.name || "…"}</span>)}
                  {u.user_groups.map((id) => <span key={id} className="chip" style={{ cursor: "default", marginRight: ".3rem" }}>{groups.find((g) => g.id === id)?.name || "…"}</span>)}
                  {!u.is_staff && !u.roles.length && !u.user_groups.length && <span className="muted">User</span>}
                </td>
                <td><span className={`badge ${u.is_active ? "ok" : "off"}`}>{u.is_active ? "Actief" : "Geblokkeerd"}</span></td>
                <td className="actions">
                  {L >= 2 && <button className="btn sm" onClick={() => setModal({ ...EMPTY, ...u, password: "" })}>Wijzig</button>}
                  {u.id !== me.id && (
                    <>
                      {L >= 2 && <button className="btn sm" onClick={() => toggleBlock(u)}>{u.is_active ? "Blokkeer" : "Deblokkeer"}</button>}
                      {L >= 3 && <button className="btn sm danger" onClick={() => remove(u)}>Verwijder</button>}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </Collapsible>

      {modal && (
        <div className="overlay" onClick={() => setModal(null)}>
          <form className="card modal form" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h2>{modal.id ? "Gebruiker wijzigen" : "Nieuwe gebruiker"}</h2>
            <div className="grid2">
              <label>Voornaam<input value={modal.first_name} onChange={set("first_name")} /></label>
              <label>Achternaam<input value={modal.last_name} onChange={set("last_name")} /></label>
              <label>E-mailadres<input type="email" value={modal.email} onChange={set("email")} required /></label>
              <label>{modal.id ? "Nieuw wachtwoord (optioneel)" : "Wachtwoord"}
                <input type="password" value={modal.password} onChange={set("password")} required={!modal.id} autoComplete="new-password" />
              </label>
              <label>Functie<input value={modal.function} onChange={set("function")} /></label>
              <label>Korte tekst<input value={modal.short} onChange={set("short")} maxLength={255} /></label>
            </div>
            <label>Omschrijving / biografie<textarea rows={4} value={modal.description} onChange={set("description")} /></label>
            <div className="grid2">
              <label>Link<input value={modal.link} onChange={set("link")} maxLength={255} placeholder="https://…" /></label>
              <label className="check" style={{ alignSelf: "end" }}><input type="checkbox" checked={modal.link_external} onChange={set("link_external")} /> Link opent extern</label>
            </div>
            <div className="photo-row">
              {modal.preview || modal.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={modal.preview || mediaUrl(modal.image)} alt="" className="photo-preview" /> : <span className="avatar photo-preview">{initials(modal)}</span>}
              <span className="row" style={{ justifyContent: "flex-start" }}>
                <label className="btn sm" style={{ cursor: "pointer" }}>
                  {modal.preview || modal.image ? "Foto vervangen" : "Foto uploaden"}
                  <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files[0]; e.target.value = ""; if (f) photo(f); }} />
                </label>
                {(modal.image || modal.preview) && <button type="button" className="btn sm danger" onClick={() => photo(null)}>Foto verwijderen</button>}
              </span>
            </div>
            <label className="check"><input type="checkbox" checked={modal.show_public} onChange={set("show_public")} /> Tonen op de website als member (foto, functie en omschrijving)</label>
            <div>
              <strong style={{ fontSize: ".85rem" }}>Rollen</strong>
              <div className="perm-list">
                {roles.map((r) => (
                  <label className="check" key={r.id}>
                    <input type="checkbox" checked={modal.roles.includes(r.id)}
                      onChange={() => setModal({ ...modal, roles: modal.roles.includes(r.id) ? modal.roles.filter((x) => x !== r.id) : [...modal.roles, r.id] })} />
                    {r.name} <small className="muted">{r.description}</small>
                  </label>
                ))}
                {!roles.length && <span className="muted">Geen rollen beschikbaar.</span>}
              </div>
            </div>
            <div>
              <strong style={{ fontSize: ".85rem" }}>User groups</strong>
              <div className="perm-list">
                {groups.map((g) => (
                  <label className="check" key={g.id}>
                    <input type="checkbox" checked={modal.user_groups.includes(g.id)}
                      onChange={() => setModal({ ...modal, user_groups: modal.user_groups.includes(g.id) ? modal.user_groups.filter((x) => x !== g.id) : [...modal.user_groups, g.id] })} />
                    {g.name} <small className="muted">{g.description}</small>
                  </label>
                ))}
                {!groups.length && <span className="muted">Nog geen groepen.</span>}
              </div>
            </div>
            {me.is_staff && <label className="check">
              <input type="checkbox" checked={modal.is_staff} onChange={set("is_staff")} disabled={modal.id === me.id} /> Superadmin (alle rechten, beheert ook admins en superadmins)
            </label>}
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
