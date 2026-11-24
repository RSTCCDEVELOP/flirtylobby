// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../../../lib/t";
import SmallEditor from "../../../components/SmallEditor";
import Link from "next/link";
import { useState } from "react";
import PhoneInput from "../../../components/PhoneInput";
import VerifyBadge from "../../../components/VerifyBadge";
import MyPhotos from "../../../components/MyPhotos";
import PhotoDrop from "../../../components/PhotoDrop";
import TwoFactorProfile from "../../../components/TwoFactorProfile";
import ProfileBlock from "../../../components/ProfileBlock";
import PublicProfileBlock from "../../../components/PublicProfileBlock";
import NotificationPrefs from "../../../components/NotificationPrefs";
import { useModule } from "../../../components/Modules";
import { IconBell, IconBriefcase, IconImage, IconKey, IconLock, IconPin, IconShield, IconTrash, IconUser } from "../../../components/Icons";
import Tabs from "../../../components/Tabs";
import { countryOptions } from "../../../lib/countries";
import PostcodeSearch from "../../../components/PostcodeSearch";
import MyNotes from "../../../components/MyNotes";
import { useAuth } from "../../../components/AuthContext";
import { api, setToken, clearToken, errorText, mediaUrl } from "../../../lib/api";
import { GENDER_LABELS, useGenders } from "../../../lib/genders";
import { confirmDialog, promptDialog } from "../../../lib/dialog";
import { useAutoSave } from "../../../lib/autosave";
import SaveStatus from "../../../components/SaveStatus";
import PasskeysProfile from "../../../components/PasskeysProfile";
import SuggestPassword from "../../../components/SuggestPassword";

export default function Profile() {
  const notifyOn = useModule("notifications");
  const genders = useGenders();
  const { user, setUser } = useAuth();
  const [secTab, setSecTab] = useState("password"); // Beveiliging: password | passkeys | twofa | account
  const [form, setForm] = useState({
    first_name: user.first_name, last_name: user.last_name, display_name: user.display_name || "", birth_date: user.birth_date || "", gender: user.gender || "", phone: user.phone || "", mobile: user.mobile || "", address: user.address || "", postal_code: user.postal_code || "", city: user.city || "", country: user.country || "", function: user.function,
    short: user.short, description: user.description, link: user.link, link_external: user.link_external,
  });
  const [pw, setPw] = useState({ old_password: "", new_password: "" });
  const [msg, setMsg] = useState(null);
  const [pwMsg, setPwMsg] = useState(null);
  const [popup, setPopup] = useState(null); // blocking notice (age limit)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  async function save(e) {
    e?.preventDefault?.();
    try {
      setUser(await api("/auth/me/", { method: "PATCH", body: { ...form, birth_date: form.birth_date || null } }));
      setMsg(null);
    } catch (err) {
      const age = err.data?.birth_date && [].concat(err.data.birth_date).join(" ");
      if (age) setPopup({ title: tx("Leeftijdscontrole"), text: age });
      else setMsg({ ok: false, text: errorText(err) });
      return false;
    }
  }
  const auto = useAutoSave(form, save, { delay: 1200 }); // saves by itself, no Save button

  async function changePassword(e) {
    e.preventDefault();
    try {
      const { token } = await api("/auth/password/", { method: "POST", body: { old_password: pw.old_password, new_password: pw.new_password } });
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
        <span className="head-actions">
          {notifyOn && <Link className="btn" href="/dashboard/notifications?tab=prefs">{tx("Instellingen meldingen")}</Link>}
          <Link className="btn" href="/dashboard/community/profile">{tx("Instellingen openbaar profiel")}</Link>
        </span>
      </div>
      <div className="profile-cols">
      <div className="profile-col">
      <PublicProfileBlock />
      <MyNotes />
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
        <div className="grid2" style={{ alignItems: "start", rowGap: "1rem" }}>
          <label>{tx("Telefoon")}<PhoneInput value={form.phone || ""} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} /></label>
          <label>{tx("Mobiel")}<PhoneInput value={form.mobile || ""} onChange={(v) => setForm((f) => ({ ...f, mobile: v }))} /></label>
          <small className="muted" style={{ gridColumn: "1 / -1", marginTop: "-.5rem" }}>{tx("Mobiel")}: {tx("Hierheen gaan codes per sms (tweestapsverificatie en bevestigingen).")}</small>
          <label style={{ gridColumn: "1 / -1" }}>{tx("Adres")}<input value={form.address} onChange={set("address")} maxLength={200} placeholder={tx("Straat en huisnummer")} autoComplete="street-address" /></label>
          <label>{tx("Postcode")}
            <span style={{ display: "flex", gap: ".5rem", alignItems: "stretch", flexWrap: "wrap" }}>
              <input value={form.postal_code} onChange={set("postal_code")} maxLength={12} autoComplete="postal-code" style={{ flex: 1, minWidth: 0 }} />
              <PostcodeSearch query={`${form.postal_code || ""} ${((form.address || "").match(/(\d+\s?[A-Za-z]?)\s*$/) || [])[1] || ""}`}
                onPick={(r) => setForm((f) => {
                  const nr = r.house_number || ((f.address || "").match(/(\d+\s?[A-Za-z]?)\s*$/) || [])[1] || "";  // the house number that was already typed stays when the postcode alone was looked up
                  const country = (countryOptions("nl").find(([c, n]) => n.toLowerCase() === String(r.country || "").toLowerCase()) || [r.country === "Nederland" ? "NL" : f.country])[0] || f.country;
                  return { ...f, address: `${r.street || ""} ${nr}`.trim() || f.address, postal_code: r.postal_code || f.postal_code, city: r.city || f.city, country };
                })} />
            </span>
          </label>
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
        <div className="field"><strong style={{ fontSize: ".85rem" }}>{tx("Omschrijving")}</strong><SmallEditor value={form.description} onChange={(v) => setForm({ ...form, description: v })} minHeight={120} /></div>
      </ProfileBlock>
      <div className="profile-save">
        <SaveStatus auto={auto} />
        {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
      </div>
      </form>

      {notifyOn && (
        <ProfileBlock id="p-notify" icon={<IconBell />} title={tx("Meldingen")} hint={tx("Welke meldingen je ziet en wanneer je een e-mail krijgt.")}>
          <NotificationPrefs />
        </ProfileBlock>
      )}
      <ProfileBlock id="p-security" icon={<IconLock />} title={tx("Beveiliging")} hint={tx("Wachtwoord en inloggen met een code.")}>
        <Tabs value={secTab} onChange={setSecTab} tabs={[["password", tx("Wachtwoord"), <IconLock key="a" />], ["passkeys", tx("Passkeys"), <IconKey key="b" />], ["twofa", tx("2-staps verificatie"), <IconShield key="c" />], ["account", tx("Account"), <IconTrash key="d" />]]} />
        <div style={{ paddingTop: ".9rem", display: "grid", gap: ".9rem" }}>
          {secTab === "password" && (
          <form className="form" onSubmit={changePassword}>
          <strong style={{ fontSize: ".9rem" }}>{tx("Wachtwoord wijzigen")}</strong>
          <div className="grid2">
            <label>{tx("Huidig wachtwoord")}<input type="text" name="username" value={user?.email || ""} autoComplete="username" readOnly tabIndex={-1} aria-hidden="true" style={{ position: "absolute", width: 1, height: 1, margin: -1, padding: 0, border: 0, overflow: "hidden", clip: "rect(0 0 0 0)" }} /><input type="password" name="current-password" value={pw.old_password} onChange={(e) => setPw({ ...pw, old_password: e.target.value })} required autoComplete="current-password" /></label>
            <label>{tx("Nieuw wachtwoord")}<input type={pw.show ? "text" : "password"} value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} required autoComplete="new-password" /></label>
            <div style={{ gridColumn: "1 / -1" }}><SuggestPassword onPick={(p) => setPw({ ...pw, new_password: p, show: true })} /></div>
          </div>
          {pwMsg && <div className={pwMsg.ok ? "alert ok" : "alert"}>{pwMsg.text}</div>}
          <div><button className="btn">{tx("Wachtwoord wijzigen")}</button></div>
          </form>
          )}
          {secTab === "passkeys" && <PasskeysProfile />}
          {secTab === "twofa" && <TwoFactorProfile />}
          {secTab === "account" && (
          <div className="danger-zone">
          <strong style={{ fontSize: ".9rem" }}>{tx("Account verwijderen")}</strong>
          <p className="muted" style={{ margin: ".25rem 0 .6rem", fontSize: ".85rem" }}>{tx("Wist je profiel, foto's, berichten en bestanden definitief, en haalt je weg uit alle groepen en rechten.")}</p>
          <button type="button" className="btn danger" onClick={deleteAccount}>{tx("Account verwijderen")}</button>
        </div>
          )}
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
