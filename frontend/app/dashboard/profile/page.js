"use client";

import { tx } from "../../../lib/t";
import Link from "next/link";
import { useState } from "react";
import VerifyBadge from "../../../components/VerifyBadge";
import MyPhotos from "../../../components/MyPhotos";
import PhotoDrop from "../../../components/PhotoDrop";
import TwoFactorProfile from "../../../components/TwoFactorProfile";
import ProfileBlock from "../../../components/ProfileBlock";
import PublicProfileBlock from "../../../components/PublicProfileBlock";
import { IconBriefcase, IconImage, IconLock, IconPin, IconUser } from "../../../components/Icons";
import { countryOptions } from "../../../lib/countries";
import { useAuth } from "../../../components/AuthContext";
import { api, setToken, clearToken, errorText, mediaUrl } from "../../../lib/api";
import { GENDER_LABELS, useGenders } from "../../../lib/genders";
import { confirmDialog, promptDialog } from "../../../lib/dialog";

export default function Profile() {
  const genders = useGenders();
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
      setMsg({ ok: true, text: tx("Profiel opgeslagen.") });
    } catch (err) {
      const age = err.data?.birth_date && [].concat(err.data.birth_date).join(" ");
      if (age) setPopup({ title: tx("Leeftijdscontrole"), text: age });
      else setMsg({ ok: false, text: errorText(err) });
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    try {
      const { token } = await api("/auth/password/", { method: "POST", body: pw });
      setToken(token);
      setPw({ old_password: "", new_password: "" });
      setPwMsg({ ok: true, text: tx("Wachtwoord gewijzigd.") });
    } catch (err) {
      setPwMsg({ ok: false, text: errorText(err) });
    }
  }

  async function deleteAccount() {
    if (!(await confirmDialog(tx("Je account verwijderen? Al je bestanden en gegevens worden definitief gewist. Dit kan niet ongedaan worden gemaakt."), { danger: true }))) return;
    const password = await promptDialog(tx("Typ ter bevestiging je wachtwoord"), "", { password: true });
    if (!password) return;
    try {
      await api("/auth/delete/", { method: "POST", body: { password } });
      clearToken();
      window.location.href = "/";
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
      <div className="page-head">
        <h1 style={{ margin: 0 }}>{tx("Mijn profiel")} <VerifyBadge status={user.verification} size={26} label /></h1>
        <Link className="btn" href="/dashboard/community/profile">{tx("Instellingen openbaar profiel")}</Link>
      </div>
      <div className="profile-cols">
      <div className="profile-col">
      <PublicProfileBlock />
      <form onSubmit={save}>
      <ProfileBlock id="p-personal" icon={<IconUser />} title={tx("Persoonlijk")} hint={tx("Zo ben je bekend op de website.")}>
        <div className="grid2">
          <label>{tx("Voornaam")}<input value={form.first_name} onChange={set("first_name")} /></label>
          <label>{tx("Achternaam")}<input value={form.last_name} onChange={set("last_name")} /></label>
          <label>{tx("Profielnaam")}<input value={form.display_name} onChange={set("display_name")} maxLength={60} placeholder={tx("Zo zien anderen je")} /></label>
          <label>{tx("E-mailadres")}<input value={user.email} disabled /></label>
          <label>{tx("Geboortedatum")}<input type="date" value={form.birth_date} max={new Date().toISOString().slice(0, 10)} onChange={set("birth_date")} /></label>
          <label>{tx("Geslacht")}
            <select value={form.gender} onChange={set("gender")}>
              <option value="">{tx("Niet opgegeven")}</option>{genders.map((g) => <option key={g} value={g}>{tx(GENDER_LABELS[g])}</option>)}
            </select>
          </label>
        </div>
      </ProfileBlock>

      <ProfileBlock id="p-contact" icon={<IconPin />} title={tx("Contact & adres")} hint={tx("Telefoon en woonplaats.")}>
        <div className="grid2">
          <label>{tx("Telefoon")}<input type="tel" value={form.phone} onChange={set("phone")} maxLength={20} placeholder="+31612345678" autoComplete="tel" /></label>
          <label>{tx("Adres")}<input value={form.address} onChange={set("address")} maxLength={200} placeholder={tx("Straat en huisnummer")} autoComplete="street-address" /></label>
          <label>{tx("Postcode")}<input value={form.postal_code} onChange={set("postal_code")} maxLength={12} autoComplete="postal-code" /></label>
          <label>{tx("Plaats")}<input value={form.city} onChange={set("city")} maxLength={100} autoComplete="address-level2" /></label>
          <label>{tx("Land")}
            <select value={form.country} onChange={set("country")} autoComplete="country">
              <option value="">{tx("Niet opgegeven")}</option>
              {countryOptions("nl").map(([c, n]) => <option key={c} value={c}>{n}</option>)}
            </select>
          </label>
        </div>
      </ProfileBlock>

      <ProfileBlock id="p-work" icon={<IconBriefcase />} title={tx("Werk & over mij")} hint={tx("Functie, link en een korte omschrijving.")}>
        <div className="grid2">
          <label>{tx("Functie")}<input value={form.function} onChange={set("function")} maxLength={255} /></label>
          <label>{tx("Korte tekst")}<input value={form.short} onChange={set("short")} maxLength={255} /></label>
          <label>{tx("Link")}<input value={form.link} onChange={set("link")} maxLength={255} /></label>
        </div>
        <label className="check"><input type="checkbox" checked={form.link_external} onChange={set("link_external")} /> {tx("Link opent extern")}</label>
        <label>{tx("Omschrijving")}<textarea rows={5} value={form.description} onChange={set("description")} /></label>
      </ProfileBlock>
      <div className="profile-save">
        <button className="btn primary">{tx("Opslaan")}</button>
        {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
      </div>
      </form>

      <ProfileBlock id="p-security" icon={<IconLock />} title={tx("Beveiliging")} hint={tx("Wachtwoord en inloggen met een code.")}>
        <form className="form" onSubmit={changePassword}>
          <strong style={{ fontSize: ".9rem" }}>{tx("Wachtwoord wijzigen")}</strong>
          <div className="grid2">
            <label>{tx("Huidig wachtwoord")}<input type="password" value={pw.old_password} onChange={(e) => setPw({ ...pw, old_password: e.target.value })} required autoComplete="current-password" /></label>
            <label>{tx("Nieuw wachtwoord")}<input type="password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} required autoComplete="new-password" /></label>
          </div>
          {pwMsg && <div className={pwMsg.ok ? "alert ok" : "alert"}>{pwMsg.text}</div>}
          <div><button className="btn">{tx("Wachtwoord wijzigen")}</button></div>
        </form>
        <TwoFactorProfile />
        <div className="danger-zone">
          <strong style={{ fontSize: ".9rem" }}>{tx("Account verwijderen")}</strong>
          <p className="muted" style={{ margin: ".25rem 0 .6rem", fontSize: ".85rem" }}>{tx("Wist je profiel, foto's, berichten en bestanden definitief, en haalt je weg uit alle groepen en rechten.")}</p>
          <button type="button" className="btn danger" onClick={deleteAccount}>{tx("Account verwijderen")}</button>
        </div>
      </ProfileBlock>
      </div>
      <div className="profile-col">
      <ProfileBlock id="p-photos" icon={<IconImage />} title={tx("Foto's")} hint={tx("Profielfoto en je fotoalbum.")}>
        <div className="photo-side">
          <PhotoDrop vertical
              label={user.image ? tx("Nieuwe foto: sleep hierheen of klik") : tx("Sleep een foto hierheen of klik om te kiezen")}
              preview={user.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(user.image)} alt="" className="photo-big" /> : <span className="avatar photo-big">{(user.first_name?.[0] || user.email[0]).toUpperCase()}</span>}
              onFiles={async ([f]) => {
                if (f.size > 5 * 1024 * 1024) return tx("Foto is te groot (maximaal 5 MB).");
                const fd = new FormData(); fd.append("image", f);
                try { setUser(await api("/auth/me/image/", { method: "POST", body: fd })); } catch (err) { return errorText(err); }
              }} />
            <small className="muted">{tx("JPG, PNG of WebP, maximaal 5 MB. Dit is je profielfoto in het menu en bij je naam.")}</small>
            {user.image && <button type="button" className="btn sm danger" onClick={async () => { try { setUser(await api("/auth/me/image/", { method: "DELETE" })); } catch (err) { setMsg({ ok: false, text: errorText(err) }); } }}>{tx("Foto verwijderen")}</button>}
            <MyPhotos />
            {user.show_public && <span className="badge ok" title={tx("Wordt getoond op de website")}>{tx("Op website")}</span>}
        </div>
      </ProfileBlock>
      </div>
      </div>
    </>
  );
}
