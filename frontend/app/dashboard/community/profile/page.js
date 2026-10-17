"use client";

import { tx } from "../../../../lib/t";
import { useCallback, useEffect, useState } from "react";
import VisibilityPicker from "../../../../components/VisibilityPicker";
import { FieldInput } from "../../../../components/ProfileFields";
import PhotoDrop from "../../../../components/PhotoDrop";
import ProfileBlock from "../../../../components/ProfileBlock";
import PageVisibility from "../../../../components/PageVisibility";
import { IconPhone, IconPalette, IconEdit, IconFriends, IconHeart, IconImage, IconSearch, IconSliders, IconEye } from "../../../../components/Icons";
import Tabs from "../../../../components/Tabs";
import { DESIGNS, gradient } from "../../../../lib/profile-designs";
import { useModule } from "../../../../components/Modules";
import { api, errorText, mediaUrl } from "../../../../lib/api";
import { confirmDialog } from "../../../../lib/dialog";

import { GENDER_LABELS, useGenders } from "../../../../lib/genders";

const CONTACTS = [["whatsapp", "WhatsApp", "+31 6 12345678"], ["phone", "Telefoon", "+31 6 12345678"], ["email", "E-mail", "naam@voorbeeld.nl"], ["telegram", "Telegram", "@gebruikersnaam"]];

export default function MyProfile() {
  const genders = useGenders();
  const GENDERS = [["", "Zeg ik liever niet"], ...genders.map((g) => [g, GENDER_LABELS[g]])];
  const [p, setP] = useState(null);
  const [msg, setMsg] = useState(null);
  const AIMS = [["", "Niet ingevuld"], ...(p?.profile_cfg?.aims || [])];
  const [popup, setPopup] = useState(null);
  const [testFill, setTestFill] = useState(null); // sandbox: {available, simulated}
  const [filling, setFilling] = useState(false);
  const [gtab, setGtab] = useState(""); // Profielgegevens: the open group (tab)
  const [uploadVis, setUploadVis] = useState("public");
  const [q, setQ] = useState("");
  const [found, setFound] = useState([]);
  const [modeBusy, setModeBusy] = useState(false);
  const discoverOn = useModule("discover");

  const load = useCallback(() => api("/profile/me/").then(setP).catch((e) => setMsg({ ok: false, text: errorText(e) })), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api("/profile/me/fill-test/").then(setTestFill).catch(() => setTestFill(null)); }, []);
  useEffect(() => { if (q.trim()) api(`/people/?q=${encodeURIComponent(q)}`).then(setFound).catch(() => {}); else setFound([]); }, [q]);

  if (!p) return msg ? <div className="alert">{msg.text}</div> : <p className="muted">{tx("Laden…")}</p>;
  const set = (k, v) => setP({ ...p, [k]: v });
  const bi = (k) => p.profile_cfg?.builtin?.[k] !== false; // built-in field switched on by the admin (Community -> Profielvelden)
  const setContact = (k, v) => setP((cur) => ({ ...cur, contact: { ...(cur.contact || {}), [k]: v } }));
  const setContactItem = (k, patch) => setP((cur) => ({ ...cur, contact: { ...(cur.contact || {}), [k]: { on: false, value: "", friends: false, ...(cur.contact?.[k] || {}), ...patch } } }));
  const setField = (k, v) => setP({ ...p, data: { ...(p.data || {}), [k]: v } });
  const fieldGroups = [...new Set((p.profile_cfg?.fields || []).map((x) => x.group || ""))];

  async function save() {
    try {
      const d = await api("/profile/me/", { method: "PUT", body: p });
      setP(d);
      setMsg({ ok: true, text: tx("Profiel opgeslagen.") });
    } catch (e) {
      const t = errorText(e);
      if (/jaar|geboortedatum/i.test(t)) setPopup({ title: tx("Leeftijdscontrole"), text: t }); else setMsg({ ok: false, text: t });
    }
  }
  async function upload(files) {
    const room = p.max_photos - p.photos.length;
    for (const f of files.slice(0, Math.max(room, 0))) {
      const fd = new FormData();
      fd.append("image", f);
      fd.append("visibility", uploadVis);
      try { setP(await api("/profile/me/photos/", { method: "POST", body: fd })); } catch (err) { return `${f.name}: ${errorText(err)}`; }
    }
    if (files.length > room) return `Maximaal ${p.max_photos} foto's: ${files.length - room} niet toegevoegd.`;
  }
  // sandbox only: AI fills in the whole profile for testing
  const fillTest = async () => {
    if (!(await confirmDialog(tx("Alle gegevens van je profiel worden vervangen door verzonnen testgegevens. Doorgaan?"), { title: tx("Profiel invullen met AI"), okLabel: tx("Invullen") }))) return;
    setFilling(true);
    try { await api("/profile/me/fill-test/", { method: "POST", body: {} }); await load(); setMsg({ ok: true, text: tx("Je profiel is ingevuld met testgegevens.") }); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setFilling(false);
  };
  const setDesign = async (key) => {
    const prev = p.design || "";
    setP((cur) => ({ ...cur, design: key }));
    try { await api("/profile/me/", { method: "PUT", body: { design: key } }); setMsg({ ok: true, text: tx("Design opgeslagen.") }); }
    catch (e) { setP((cur) => ({ ...cur, design: prev })); setMsg({ ok: false, text: errorText(e) }); }
  };
  const setVisibility = (ph, visibility) => api(`/profile/me/photos/${ph.id}/edit/`, { method: "PATCH", body: { visibility } }).then(setP).catch((e) => setMsg({ ok: false, text: errorText(e) }));
  const delPhoto = (id) => api(`/profile/me/photos/${id}/`, { method: "DELETE" }).then(setP);
  const move = (i, d) => {
    const ids = p.photos.map((x) => x.id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    api("/profile/me/photos/order/", { method: "POST", body: { ids } }).then(setP);
  };
  const setAllowed = (users) => api("/profile/me/allowed/", { method: "PUT", body: { users: users.map((u) => u.id) } }).then((a) => setP({ ...p, allowed: a }));
  const setMode = async (m) => {
    setModeBusy(true);
    try {
      const body = m === "off" ? { enabled: false } : { enabled: true, visibility: m };
      const d = await api("/profile/me/", { method: "PUT", body });
      setP((cur) => ({ ...cur, enabled: d.enabled, visibility: d.visibility }));
      setMsg({ ok: true, text: m === "off" ? tx("Je profielpagina staat uit.") : tx("Zichtbaarheid opgeslagen.") });
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setModeBusy(false);
  };
  const toggleLang = (l) => set("languages", p.languages.includes(l) ? p.languages.filter((x) => x !== l) : [...p.languages, l]);
  const Sw = ({ k, label, hint }) => (
    <label className="check sec-toggle">
      <span className="switch"><input type="checkbox" checked={p[k]} onChange={(e) => set(k, e.target.checked)} /><span /></span>
      <span>{label}{hint && <small className="muted"> {hint}</small>}</span>
    </label>
  );

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
        <div>
          <h1>{tx("Wijzig profiel")}</h1>
          <p className="muted" style={{ margin: 0 }}>{tx("Stel je profielpagina in en bepaal precies wie hem ziet en vindt.")}</p>
        </div>
        <div className="row">
          {testFill?.available && <button type="button" className="btn" disabled={filling} onClick={fillTest} title={testFill.simulated ? tx("Gesimuleerd (sandbox)") : tx("Met Claude (sandbox)")}>{filling ? tx("Bezig…") : tx("Vul alles in met AI (test)")}</button>}
          <a className="btn" href="/dashboard/community/mypage">{tx("Bekijk mijn profielpagina")}</a>
          <button className="btn primary" onClick={save}>{tx("Opslaan")}</button>
        </div>
      </div>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}

      <ProfileBlock id="c-visibility" icon={<IconEye />} title={tx("Zichtbaarheid")} hint={tx("Wie ziet je profielpagina? Een wijziging geldt direct.")}>
        <PageVisibility p={p} busy={modeBusy} onChange={setMode} onPreview={() => window.open(`/leden/${p.slug}?preview=1`, "_blank")} />
      </ProfileBlock>

      <ProfileBlock id="c-about" icon={<IconEdit />} title={tx("Over jou")} hint={tx("Je adres, kopregel en eigen tekst.")}>
        <div className="grid2">
          <label>{tx("Adres van je pagina")} <small className="muted">/leden/…</small><input value={p.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} /></label>
          {bi("headline") && <label>{tx("Kopregel")}<input value={p.headline} maxLength={150} onChange={(e) => set("headline", e.target.value)} placeholder={tx("Wie ben je in één zin?")} /></label>}
        </div>
        {bi("bio") && <label>{tx("Over mij")}<textarea rows={6} value={p.bio} maxLength={4000} onChange={(e) => set("bio", e.target.value)} /></label>}
        {(bi("gender") || bi("birth_date") || bi("city") || bi("interests")) && (
          <div className="theme-grid">
            {bi("gender") && <label>{tx("Ik ben")}<select value={p.gender} onChange={(e) => set("gender", e.target.value)}>{GENDERS.map(([v, l]) => <option key={v} value={v}>{tx(l)}</option>)}</select></label>}
            {bi("birth_date") && <label>{tx("Geboortedatum")}<input type="date" value={p.birth_date} onChange={(e) => set("birth_date", e.target.value)} /></label>}
            {bi("city") && <label>{tx("Plaats")}<input value={p.city} onChange={(e) => set("city", e.target.value)} /></label>}
            {bi("city") && <label>{tx("Land (code)")}<input value={p.country} maxLength={2} placeholder="NL" onChange={(e) => set("country", e.target.value.toUpperCase())} /></label>}
            {bi("interests") && <label>{tx("Interesses")} <small className="muted">{tx("gescheiden door komma's")}</small><input defaultValue={p.interests.join(", ")} onBlur={(e) => set("interests", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} /></label>}
          </div>
        )}
      </ProfileBlock>

      {(p.profile_cfg?.fields || []).length > 0 && (
        <ProfileBlock id="c-fields" icon={<IconSliders />} title={tx("Profielgegevens")} hint={tx("De velden die bij deze website horen.")}>
          {fieldGroups.length > 1 && <Tabs value={fieldGroups.includes(gtab) ? gtab : fieldGroups[0]} onChange={setGtab} tabs={fieldGroups.map((g) => [g, g || "Algemeen"])} />}
          {fieldGroups.filter((g) => g === (fieldGroups.includes(gtab) ? gtab : fieldGroups[0])).map((g) => (
            <div key={g} className="theme-grid" style={{ paddingTop: ".5rem" }}>
              {p.profile_cfg.fields.filter((x) => (x.group || "") === g).map((x) => (
                <div key={x.key} style={["multiselect", "textarea"].includes(x.type) ? { gridColumn: "1 / -1" } : undefined}>
                  <FieldInput field={x} value={(p.data || {})[x.key]} onChange={(v) => setField(x.key, v)} />
                </div>
              ))}
            </div>
          ))}
          <small className="muted">{tx("Per veld bepaalt de beheerder wie het ziet: openbaar, ingelogde leden, alleen vrienden of niemand.")}</small>
        </ProfileBlock>
      )}

      {discoverOn && (
      <ProfileBlock id="c-dating" icon={<IconHeart />} title={tx("Zoeken & matchen")} hint={tx("Wie je zoekt en hoe je gevonden wordt.")}>
        <Sw k="discover" label={tx("Doe mee aan zoeken & matchen")} hint={tx("Je kunt dan andere leden zoeken en gevonden worden. Van {0} tot {1} jaar{2}; geboortedatum is verplicht.", p.min_age, p.max_age, p.require_photo ? `, met minimaal ${p.require_photo} foto('s)` : "")} />
        {bi("aim") && <div className="theme-grid"><label>{tx("Ik zoek")}<select value={p.aim} onChange={(e) => set("aim", e.target.value)}>{AIMS.map(([v, l]) => <option key={v} value={v}>{tx(l)}</option>)}</select></label></div>}
        {bi("gender") && (
          <div>
            <strong style={{ fontSize: ".85rem" }}>{tx("Ik zoek (geslacht)")}</strong>
            <div className="perm-list">
              {GENDERS.filter(([v]) => v).map(([v, l]) => <label className="check" key={v} style={{ fontWeight: 500 }}><input type="checkbox" checked={p.looking_for_genders.includes(v)} onChange={() => set("looking_for_genders", p.looking_for_genders.includes(v) ? p.looking_for_genders.filter((x) => x !== v) : [...p.looking_for_genders, v])} /> {tx(l)}</label>)}
            </div>
            <small className="muted">{tx("Niets aangevinkt = iedereen.")}</small>
          </div>
        )}
        {bi("birth_date") && (
          <div className="theme-grid">
            <label>{tx("Leeftijd van")}<input type="number" min={18} max={99} value={p.age_min} onChange={(e) => set("age_min", Number(e.target.value))} /></label>
            <label>{tx("Leeftijd tot")}<input type="number" min={18} max={99} value={p.age_max} onChange={(e) => set("age_max", Number(e.target.value))} /></label>
          </div>
        )}
        {bi("birth_date") && <Sw k="show_age" label={tx("Mijn leeftijd tonen")} />}
        {bi("city") && p.distance_enabled && <Sw k="show_distance" label={tx("Mijn afstand tot anderen tonen")} hint={p.location_found ? tx("Je plaats is gevonden: je kunt op afstand zoeken.") : p.city ? tx("Je plaats is niet gevonden; controleer de spelling en het land.") : tx("Vul je plaats in om op afstand te kunnen zoeken.")} />}
        {bi("city") && <Sw k="show_city" label={tx("Mijn plaats tonen")} />}
      </ProfileBlock>
      )}

      <ProfileBlock id="c-design" icon={<IconPalette />} title={tx("Design")} hint={tx("Kies de kleuren van je profielpagina.")}>
        {["Gebruikelijk", "Kleuren van trots"].map((g) => (
          <div key={g} style={{ display: "flex", flexDirection: "column", gap: ".6rem" }}>
            <strong style={{ fontSize: ".8rem", textTransform: "uppercase", letterSpacing: ".04em" }} className="muted">{tx(g)}</strong>
            <div className="design-grid">
              {DESIGNS.filter((d) => d.group === g).map((d) => (
                <button type="button" key={d.key || "default"} className="design-tile" aria-pressed={(p.design || "") === d.key} onClick={() => setDesign(d.key)}>
                  <span className="design-swatch" style={{ background: gradient(d.colors) }} />
                  {tx(d.label)}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="design-preview pt-wrap" data-pt={p.design || undefined}>
          <strong style={{ display: "block", marginBottom: ".4rem" }}>{tx("Voorbeeld")}</strong>
          <div className="row" style={{ justifyContent: "flex-start" }}>
            <span className="btn primary" style={{ pointerEvents: "none" }}>{tx("Bericht sturen")}</span>
            <span className="chip" style={{ cursor: "default" }}>{tx("Interesse")}</span>
            <span style={{ color: "var(--blue)", fontWeight: 600 }}>{tx("Een link")}</span>
          </div>
        </div>
        <small className="muted">{tx("Een kleur geldt voor je profielpagina zoals anderen hem zien. Je kiest hem direct.")}</small>
      </ProfileBlock>

      <ProfileBlock id="c-photos" icon={<IconImage />} title={tx("Foto's ({0}/{1})", p.photos.length, p.max_photos)} hint={tx("Per foto bepaal je wie hem ziet.")}>
        <div className="photo-admin">
          {p.photos.map((ph, i) => (
            <div className="photo-item" key={ph.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(ph.url)} alt="" />
              <VisibilityPicker value={ph.visibility} allowPrivate={p.private_photos} onChange={(v) => setVisibility(ph, v)} />
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span><button className="btn sm" disabled={i === 0} onClick={() => move(i, -1)}>←</button>{" "}<button className="btn sm" disabled={i === p.photos.length - 1} onClick={() => move(i, 1)}>→</button></span>
                <button className="btn sm danger" onClick={() => delPhoto(ph.id)}>{tx("Verwijder")}</button>
              </div>
            </div>
          ))}
        </div>
        {p.photos.length < p.max_photos && (
          <div className="row" style={{ justifyContent: "flex-start", marginTop: ".75rem" }}>
            <div style={{ flex: 1, minWidth: 260 }}><PhotoDrop multiple onFiles={upload} label={tx("Sleep foto's hierheen of klik om te kiezen")} /></div>
            <div style={{ fontWeight: 500, fontSize: ".85rem", display: "flex", flexDirection: "column", gap: ".3rem" }}>{tx("Nieuwe foto's zichtbaar voor")}<VisibilityPicker value={uploadVis} allowPrivate={p.private_photos} onChange={setUploadVis} /></div>
          </div>
        )}
        <small className="muted" style={{ display: "block", marginTop: ".5rem" }}>
          {tx("De eerste foto is je hoofdfoto. Maximaal")} {p.max_photos} {tx("foto's")}{p.private_photos ? tx(", waarvan {0} privé (wazig)", p.max_private_photos) : ""}{tx(". Per foto kies je wie hem ziet: openbaar, alleen ingelogde leden (portal), privé of onzichtbaar.")}
          {p.private_photos && tx(" Wazige foto's zien anderen pas scherp als je een verzoek accepteert of als jullie vrienden zijn (Vrienden & verzoeken).")}
        </small>
      </ProfileBlock>

      <ProfileBlock id="c-access" icon={<IconFriends />} title={tx("Toegang & talen")} hint={tx("Geselecteerde leden en de talen waarin je pagina zichtbaar is.")}>
        {p.visibility !== "selected" && <small className="muted">{tx("Kies bij Zichtbaarheid 'Geselecteerd' om zelf leden aan te wijzen.")}</small>}
        {p.visibility === "selected" && (
          <div>
            <strong style={{ fontSize: ".85rem" }}>{tx("Geselecteerde leden (")}{p.allowed.length})</strong>
            <div className="chips" style={{ margin: ".4rem 0" }}>
              {p.allowed.map((u) => <button key={u.id} type="button" className="chip" onClick={() => setAllowed(p.allowed.filter((x) => x.id !== u.id))}>{u.name} <b>×</b></button>)}
              {!p.allowed.length && <span className="muted">{tx("Nog niemand: dan ziet alleen jijzelf je pagina.")}</span>}
            </div>
            <input placeholder={tx("Zoek een lid om toe te voegen…")} value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="suggest">
              {found.filter((u) => !p.allowed.some((a) => a.id === u.id)).map((u) => <button key={u.id} type="button" onClick={() => { setAllowed([...p.allowed, u]); setQ(""); }}>{u.name}</button>)}
            </div>
          </div>
        )}
        <div>
          <strong style={{ fontSize: ".85rem" }}>{tx("In welke talen is mijn pagina zichtbaar?")}</strong>
          <div className="perm-list">
            {p.available_languages.map((l) => (
              <label className="check" key={l} style={{ fontWeight: 500 }}><input type="checkbox" checked={p.languages.includes(l)} onChange={() => toggleLang(l)} /> {new Intl.DisplayNames(["nl"], { type: "language" }).of(l)}</label>
            ))}
          </div>
          <small className="muted">{p.languages.length ? tx("Alleen bezoekers die de site in deze talen bekijken zien je pagina.") : tx("Geen taal aangevinkt = zichtbaar in alle talen.")}</small>
        </div>
      </ProfileBlock>

      <ProfileBlock id="c-find" icon={<IconSearch />} title={tx("Gevonden worden & contact")} hint={tx("Zoeken, berichten en chat.")}>
        <Sw k="searchable_local" label={tx("Vindbaar in de ledenzoeker van dit systeem")} />
        <Sw k="searchable_public" label={tx("Vindbaar in openbare zoekmachines (Google, Bing, …)")} hint={tx("Werkt alleen als je pagina voor iedereen zichtbaar is.")} />
      </ProfileBlock>

      <ProfileBlock id="c-contact" icon={<IconPhone />} title={tx("Contact opnemen")} hint={tx("Hoe mogen anderen contact met je opnemen? Alles staat standaard uit.")}>
        <Sw k="accept_messages" label={tx("Berichten")} hint={tx("Anderen kunnen je een bericht sturen.")} />
        <Sw k="accept_chat" label={tx("Chat")} hint={tx("Anderen kunnen je chatten.")} />
        <label className="check sec-toggle">
          <span className="switch"><input type="checkbox" checked={!!p.contact?.video} onChange={(e) => setContact("video", e.target.checked)} /><span /></span>
          <span>{tx("Videochat")}<small className="muted"> {tx("Anderen kunnen je videobellen.")}</small></span>
        </label>
        <strong style={{ fontSize: ".85rem" }}>{tx("Eigen contactgegevens tonen als knop op je profielpagina")}</strong>
        {CONTACTS.map(([k, label, ph]) => {
          const it = p.contact?.[k] || { on: false, value: "", friends: false };
          return (
            <div key={k} className="contact-row">
              <label className="check sec-toggle">
                <span className="switch"><input type="checkbox" checked={!!it.on} onChange={(e) => setContactItem(k, { on: e.target.checked })} /><span /></span>
                <span>{tx(label)}</span>
              </label>
              <input value={it.value} placeholder={ph} onChange={(e) => setContactItem(k, { value: e.target.value })} aria-label={tx(label)} />
              <label className="check" style={{ fontWeight: 500 }}><input type="checkbox" checked={!!it.friends} onChange={(e) => setContactItem(k, { friends: e.target.checked })} /> {tx("Alleen vrienden")}</label>
            </div>
          );
        })}
        <small className="muted">{tx("Alleen ingelogde leden zien deze knoppen. Opslaan doe je met de knop bovenaan.")}</small>
      </ProfileBlock>
    </>
  );
}
