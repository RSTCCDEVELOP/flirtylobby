"use client";

import { useState } from "react";
import Collapsible from "../../../components/Collapsible";
import MyPhotos from "../../../components/MyPhotos";
import PhotoDrop from "../../../components/PhotoDrop";
import { countryOptions } from "../../../lib/countries";
import { useAuth } from "../../../components/AuthContext";
import { api, setToken, errorText, mediaUrl } from "../../../lib/api";

export default function Profile() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({
    first_name: user.first_name, last_name: user.last_name, display_name: user.display_name || "", birth_date: user.birth_date || "", gender: user.gender || "", phone: user.phone || "", address: user.address || "", postal_code: user.postal_code || "", city: user.city || "", country: user.country || "", function: user.function,
    short: user.short, description: user.description, link: user.link, link_external: user.link_external,
  });
  const [pw, setPw] = useState({ old_password: "", new_password: "" });
  const [msg, setMsg] = useState(null);
  const [pwMsg, setPwMsg] = useState(null);
  const [popup, setPopup] = useState(null); // blocking notice (age limit)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  async function save(e) {
    e.preventDefault();
    try {
      setUser(await api("/auth/me/", { method: "PATCH", body: { ...form, birth_date: form.birth_date || null } }));
      setMsg({ ok: true, text: "Profiel opgeslagen." });
    } catch (err) {
      const age = err.data?.birth_date && [].concat(err.data.birth_date).join(" ");
      if (age) setPopup({ title: "Leeftijdscontrole", text: age });
      else setMsg({ ok: false, text: errorText(err) });
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
      {popup && (
        <div className="overlay" role="alertdialog" aria-modal="true" onClick={() => setPopup(null)}>
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            <h2>{popup.title}</h2>
            <p>{popup.text}</p>
            <div className="row"><button className="btn primary" onClick={() => setPopup(null)}>OK</button></div>
          </div>
        </div>
      )}
      <h1>Mijn profiel</h1>
      <div className="profile-cols">
      <div className="profile-col">
      <Collapsible id="profile-data" title="Gegevens" className="form-card wide">
      <form className="form" onSubmit={save}>
        <div className="grid2">
          <label>Voornaam<input value={form.first_name} onChange={set("first_name")} /></label>
          <label>Achternaam<input value={form.last_name} onChange={set("last_name")} /></label>
          <label>Profielnaam<input value={form.display_name} onChange={set("display_name")} maxLength={60} placeholder="Zo zien anderen je" /></label>
          <label>E-mailadres<input value={user.email} disabled /></label>
          <label>Geboortedatum<input type="date" value={form.birth_date} max={new Date().toISOString().slice(0, 10)} onChange={set("birth_date")} /></label>
          <label>Geslacht
            <select value={form.gender} onChange={set("gender")}>
              <option value="">Niet opgegeven</option><option value="m">Man</option><option value="f">Vrouw</option><option value="x">Anders</option>
            </select>
          </label>
          <label>Telefoon<input type="tel" value={form.phone} onChange={set("phone")} maxLength={20} placeholder="+31612345678" autoComplete="tel" /></label>
          <label>Adres<input value={form.address} onChange={set("address")} maxLength={200} placeholder="Straat en huisnummer" autoComplete="street-address" /></label>
          <label>Postcode<input value={form.postal_code} onChange={set("postal_code")} maxLength={12} autoComplete="postal-code" /></label>
          <label>Plaats<input value={form.city} onChange={set("city")} maxLength={100} autoComplete="address-level2" /></label>
          <label>Land
            <select value={form.country} onChange={set("country")} autoComplete="country">
              <option value="">Niet opgegeven</option>
              {countryOptions("nl").map(([c, n]) => <option key={c} value={c}>{n}</option>)}
            </select>
          </label>
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

      <Collapsible id="profile-password" title="Wachtwoord wijzigen" className="form-card wide">
      <form className="form" onSubmit={changePassword}>
        <div className="grid2">
          <label>Huidig wachtwoord<input type="password" value={pw.old_password} onChange={(e) => setPw({ ...pw, old_password: e.target.value })} required autoComplete="current-password" /></label>
          <label>Nieuw wachtwoord<input type="password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} required autoComplete="new-password" /></label>
        </div>
        {pwMsg && <div className={pwMsg.ok ? "alert ok" : "alert"}>{pwMsg.text}</div>}
        <div><button className="btn">Wachtwoord wijzigen</button></div>
      </form>
      </Collapsible>
      </div>
      <div className="profile-col">
      <Collapsible id="profile-photos" title="Foto's" className="form-card wide" defaultOpen>
        <div className="photo-side">
          <PhotoDrop vertical
              label={user.image ? "Nieuwe foto: sleep hierheen of klik" : "Sleep een foto hierheen of klik om te kiezen"}
              preview={user.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(user.image)} alt="" className="photo-big" /> : <span className="avatar photo-big">{(user.first_name?.[0] || user.email[0]).toUpperCase()}</span>}
              onFiles={async ([f]) => {
                if (f.size > 5 * 1024 * 1024) return "Foto is te groot (maximaal 5 MB).";
                const fd = new FormData(); fd.append("image", f);
                try { setUser(await api("/auth/me/image/", { method: "POST", body: fd })); } catch (err) { return errorText(err); }
              }} />
            <small className="muted">JPG, PNG of WebP, maximaal 5 MB. Dit is je profielfoto in het menu en bij je naam.</small>
            {user.image && <button type="button" className="btn sm danger" onClick={async () => { try { setUser(await api("/auth/me/image/", { method: "DELETE" })); } catch (err) { setMsg({ ok: false, text: errorText(err) }); } }}>Foto verwijderen</button>}
            <MyPhotos />
            {user.show_public && <span className="badge ok" title="Wordt getoond op de website">Op website</span>}
        </div>
      </Collapsible>
      </div>
      </div>
    </>
  );
}
