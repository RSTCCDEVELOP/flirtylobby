"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorText } from "../../../../lib/api";

const EMPTY = { name: "", description: "", image: null };

export default function Members() {
  const [members, setMembers] = useState([]);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);

  const load = useCallback(() => api("/members/").then(setMembers).catch((e) => setError(errorText(e))), []);
  useEffect(() => { load(); }, [load]);

  async function remove(m) {
    if (!confirm(`Member ${m.name} definitief verwijderen?`)) return;
    try { await api(`/members/${m.id}/`, { method: "DELETE" }); load(); } catch (e) { setError(errorText(e)); }
  }

  async function save(e) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("name", modal.name);
    fd.append("description", modal.description);
    if (modal.file) fd.append("image", modal.file);
    try {
      await (modal.id ? api(`/members/${modal.id}/`, { method: "PATCH", body: fd }) : api("/members/", { method: "POST", body: fd }));
      setModal(null);
      load();
    } catch (err) {
      setModal({ ...modal, error: errorText(err) });
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Members</h1>
        <button className="btn primary" onClick={() => setModal({ ...EMPTY })}>+ Nieuwe member</button>
      </div>
      {error && <div className="alert">{error}</div>}

      <div className="member-grid">
        {members.map((m) => (
          <div className="card member" key={m.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {m.image && <img src={m.image} alt={m.name} />}
            <h2>{m.name}</h2>
            <p className="muted clamp">{m.description}</p>
            <div className="row">
              <button className="btn sm" onClick={() => setModal({ ...m, file: null })}>Wijzig</button>
              <button className="btn sm danger" onClick={() => remove(m)}>Verwijder</button>
            </div>
          </div>
        ))}
        {!members.length && <p className="muted">Nog geen members.</p>}
      </div>

      {modal && (
        <div className="overlay" onClick={() => setModal(null)}>
          <form className="card modal form" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h2>{modal.id ? "Member wijzigen" : "Nieuwe member"}</h2>
            <label>Naam<input value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} maxLength={255} required /></label>
            <label>Afbeelding
              <input type="file" accept="image/*" required={!modal.id} onChange={(e) => setModal({ ...modal, file: e.target.files[0] })} />
            </label>
            <label>Omschrijving<textarea rows={6} value={modal.description} onChange={(e) => setModal({ ...modal, description: e.target.value })} required /></label>
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
