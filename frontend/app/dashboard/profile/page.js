"use client";

import { useState } from "react";
import Collapsible from "../../../components/Collapsible";
import { useAuth } from "../../../components/AuthContext";
import { api, setToken, errorText, mediaUrl } from "../../../lib/api";

export default function Profile() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({
    first_name: user.first_name, last_name: user.last_name, function: user.function,
    short: user.short, description: user.description, link: user.link, link_external: user.link_external,
  });
  const [pw, setPw] = useState({ old_password: "", new_password: "" });
  const [msg, setMsg] = useState(null);
  const [pwMsg, setPwMsg] = useState(null);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  async function save(e) {
    e.preventDefault();
    try {
      setUser(await api("/auth/me/", { method: "PATCH", body: form }));
      setMsg({ ok: true, text: "Profiel opgeslagen." });
    } catch (err) {
      setMsg({ ok: false, text: errorText(err) });
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    try {
      const { token } = await api("/auth/password/", { method: "POST", body: pw });
      setToken(token);
      setPw({ old_password: "", new_password: "" });
      setPwMsg({ ok: true, text: "Wachtwoord gewijzigd." });
    } catch (err) {
      setPwMsg({ ok: false, text: errorText(err) });
    }
  }

  return (
    <>
      <h1>Mijn profiel</h1>
      <Collapsible id="profile-data" title="Gegevens" className="form-card">
      <form className="form" onSubmit={save}>
        <div className="photo-row">
          {user.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(user.image)} alt="" className="photo-preview" /> : <span className="avatar photo-preview">{(user.first_name?.[0] || user.email[0]).toUpperCase()}</span>}
          <span className="row" style={{ justifyContent: "flex-start" }}>
            <label className="btn sm" style={{ cursor: "pointer" }}>
              {user.image ? "Foto vervangen" : "Foto uploaden"}
              <input type="file" accept="image/*" hidden onChange={async (e) => {
                const f = e.target.files[0]; e.target.value = "";
                if (!f) return;
                const fd = new FormData(); fd.append("image", f);
                try { setUser(await api("/auth/me/image/", { method: "POST", body: fd })); } catch (err) { setMsg({ ok: false, text: errorText(err) }); }
              }} />
            </label>
            {user.image && <button type="button" className="btn sm danger" onClick={async () => { try { setUser(await api("/auth/me/image/", { method: "DELETE" })); } catch (err) { setMsg({ ok: false, text: errorText(err) }); } }}>Foto verwijderen</button>}
          </span>
        </div>
        <div className="grid2">
          <label>Voornaam<input value={form.first_name} onChange={set("first_name")} /></label>
          <label>Achternaam<input value={form.last_name} onChange={set("last_name")} /></label>
          <label>E-mailadres<input value={user.email} disabled /></label>
          <label>Functie<input value={form.function} onChange={set("function")} maxLength={255} /></label>
          <label>Korte tekst<input value={form.short} onChange={set("short")} maxLength={255} /></label>
          <label>Link<input value={form.link} onChange={set("link")} maxLength={255} /></label>
        </div>
        <label className="check"><input type="checkbox" checked={form.link_external} onChange={set("link_external")} /> Link opent extern</label>
        <label>Omschrijving<textarea rows={5} value={form.description} onChange={set("description")} /></label>
        {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
        <div><button className="btn primary">Opslaan</button></div>
      </form>
      </Collapsible>

      <Collapsible id="profile-password" title="Wachtwoord wijzigen" className="form-card">
      <form className="form" onSubmit={changePassword}>
        <div className="grid2">
          <label>Huidig wachtwoord<input type="password" value={pw.old_password} onChange={(e) => setPw({ ...pw, old_password: e.target.value })} required autoComplete="current-password" /></label>
          <label>Nieuw wachtwoord<input type="password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} required autoComplete="new-password" /></label>
        </div>
        {pwMsg && <div className={pwMsg.ok ? "alert ok" : "alert"}>{pwMsg.text}</div>}
        <div><button className="btn">Wachtwoord wijzigen</button></div>
      </form>
      </Collapsible>
    </>
  );
}
