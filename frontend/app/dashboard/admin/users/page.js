"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../../components/AuthContext";
import { api, errorText } from "../../../../lib/api";

const EMPTY = { email: "", password: "", first_name: "", last_name: "", function: "", role: "", is_staff: false };

export default function Users() {
  const { user: me } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null); // null | form object (with id when editing)

  const load = useCallback(() => api("/users/").then(setUsers).catch((e) => setError(errorText(e))), []);

  useEffect(() => {
    if (!me.is_staff) router.replace("/dashboard");
    else load();
  }, [me, router, load]);

  async function act(fn) {
    setError("");
    try { await fn(); await load(); } catch (e) { setError(errorText(e)); }
  }

  const toggleBlock = (u) => act(() => api(`/users/${u.id}/${u.is_active ? "block" : "unblock"}/`, { method: "POST" }));
  const remove = (u) => confirm(`Gebruiker ${u.email} definitief verwijderen?`) && act(() => api(`/users/${u.id}/`, { method: "DELETE" }));

  async function save(e) {
    e.preventDefault();
    const { id, ...body } = modal;
    if (id && !body.password) delete body.password;
    try {
      await (id ? api(`/users/${id}/`, { method: "PATCH", body }) : api("/users/", { method: "POST", body }));
      setModal(null);
      setError("");
      load();
    } catch (err) {
      setModal({ ...modal, error: errorText(err) });
    }
  }

  const set = (k) => (e) => setModal({ ...modal, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  return (
    <>
      <div className="page-head">
        <h1>Gebruikers</h1>
        <button className="btn primary" onClick={() => setModal({ ...EMPTY })}>+ Nieuwe gebruiker</button>
      </div>
      {error && <div className="alert">{error}</div>}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>Naam</th><th>E-mail</th><th>Functie</th><th>Rol</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}</td>
                <td>{u.email}</td>
                <td>{u.function || "—"}</td>
                <td>{u.is_staff ? "Beheerder" : u.role || "Gebruiker"}</td>
                <td><span className={`badge ${u.is_active ? "ok" : "off"}`}>{u.is_active ? "Actief" : "Geblokkeerd"}</span></td>
                <td className="actions">
                  <button className="btn sm" onClick={() => setModal({ ...EMPTY, ...u, password: "" })}>Wijzig</button>
                  {u.id !== me.id && (
                    <>
                      <button className="btn sm" onClick={() => toggleBlock(u)}>{u.is_active ? "Blokkeer" : "Deblokkeer"}</button>
                      <button className="btn sm danger" onClick={() => remove(u)}>Verwijder</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
              <label>Rol<input value={modal.role} onChange={set("role")} /></label>
            </div>
            <label className="check">
              <input type="checkbox" checked={modal.is_staff} onChange={set("is_staff")} disabled={modal.id === me.id} /> Beheerder (toegang tot gebruikersbeheer)
            </label>
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
