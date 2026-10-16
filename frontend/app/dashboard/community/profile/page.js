"use client";

import { useCallback, useEffect, useState } from "react";
import { visibilityHint, visibilityOptions } from "../../../../lib/photo-visibility";
import PhotoDrop from "../../../../components/PhotoDrop";
import Collapsible from "../../../../components/Collapsible";
import { api, errorText, mediaUrl } from "../../../../lib/api";

const GENDERS = [["", "Zeg ik liever niet"], ["m", "Man"], ["f", "Vrouw"], ["x", "Anders"]];
const AIMS = [["", "Niet ingevuld"], ["dating", "Daten"], ["relationship", "Een relatie"], ["friends", "Vriendschap"], ["chat", "Gewoon chatten"]];
const VIS = [
  ["public", "Iedereen", "Ook bezoekers die niet ingelogd zijn"],
  ["members", "Alleen leden", "Alleen ingelogde leden"],
  ["selected", "Alleen geselecteerde leden", "Alleen de leden die jij hieronder aanwijst"],
];

export default function MyProfile() {
  const [p, setP] = useState(null);
  const [msg, setMsg] = useState(null);
  const [popup, setPopup] = useState(null);
  const [uploadVis, setUploadVis] = useState("public");
  const [q, setQ] = useState("");
  const [found, setFound] = useState([]);

  const load = useCallback(() => api("/profile/me/").then(setP).catch((e) => setMsg({ ok: false, text: errorText(e) })), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (q.trim()) api(`/people/?q=${encodeURIComponent(q)}`).then(setFound).catch(() => {}); else setFound([]); }, [q]);

  if (!p) return msg ? <div className="alert">{msg.text}</div> : <p className="muted">Laden…</p>;
  const set = (k, v) => setP({ ...p, [k]: v });

  async function save() {
    try {
      const d = await api("/profile/me/", { method: "PUT", body: p });
      setP(d);
      setMsg({ ok: true, text: "Profiel opgeslagen." });
    } catch (e) {
      const t = errorText(e);
      if (/jaar|geboortedatum/i.test(t)) setPopup({ title: "Leeftijdscontrole", text: t }); else setMsg({ ok: false, text: t });
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
  const setVisibility = (ph, visibility) => api(`/profile/me/photos/${ph.id}/edit/`, { method: "PATCH", body: { visibility } }).then(setP).catch((e) => setMsg({ ok: false, text: errorText(e) }));
  const delPhoto = (id) => api(`/profile/me/photos/${id}/`, { method: "DELETE" }).then(setP);
  const move = (i, d) => {
    const ids = p.photos.map((x) => x.id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    api("/profile/me/photos/order/", { method: "POST", body: { ids } }).then(setP);
  };
  const setAllowed = (users) => api("/profile/me/allowed/", { method: "PUT", body: { users: users.map((u) => u.id) } }).then((a) => setP({ ...p, allowed: a }));
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
          <h1>Mijn profielpagina</h1>
          <p className="muted" style={{ margin: 0 }}>Maak je eigen pagina en bepaal precies wie hem ziet en vindt.</p>
        </div>
        <div className="row">
          {p.enabled && <a className="btn" href={`/leden/${p.slug}`} target="_blank" rel="noreferrer">Bekijk mijn pagina</a>}
          <button className="btn primary" onClick={save}>Opslaan</button>
        </div>
      </div>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}

      <Collapsible id="prof-content" title="Inhoud">
        <Sw k="enabled" label="Mijn profielpagina is actief" hint="Uit = niemand ziet hem (alleen jijzelf)" />
        <div className="grid2">
          <label>Adres van je pagina <small className="muted">/leden/…</small><input value={p.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} /></label>
          <label>Kopregel<input value={p.headline} maxLength={150} onChange={(e) => set("headline", e.target.value)} placeholder="Wie ben je in één zin?" /></label>
        </div>
        <label>Over mij<textarea rows={6} value={p.bio} maxLength={4000} onChange={(e) => set("bio", e.target.value)} /></label>
      </Collapsible>

      <Collapsible id="prof-dating" title="Zoeken & matchen">
        <Sw k="discover" label="Doe mee aan zoeken & matchen" hint={`Je kunt dan andere leden zoeken en gevonden worden. Van ${p.min_age} tot ${p.max_age} jaar${p.require_photo ? `, met minimaal ${p.require_photo} foto('s)` : ""}; geboortedatum is verplicht.`} />
        <div className="theme-grid">
          <label>Ik ben<select value={p.gender} onChange={(e) => set("gender", e.target.value)}>{GENDERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label>Geboortedatum<input type="date" value={p.birth_date} onChange={(e) => set("birth_date", e.target.value)} /></label>
          <label>Plaats<input value={p.city} onChange={(e) => set("city", e.target.value)} /></label>
          <label>Land (code)<input value={p.country} maxLength={2} placeholder="NL" onChange={(e) => set("country", e.target.value.toUpperCase())} /></label>
          <label>Ik zoek<select value={p.aim} onChange={(e) => set("aim", e.target.value)}>{AIMS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label>Interesses <small className="muted">gescheiden door komma's</small><input defaultValue={p.interests.join(", ")} onBlur={(e) => set("interests", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} /></label>
        </div>
        <div>
          <strong style={{ fontSize: ".85rem" }}>Ik zoek (geslacht)</strong>
          <div className="perm-list">
            {GENDERS.filter(([v]) => v).map(([v, l]) => <label className="check" key={v} style={{ fontWeight: 500 }}><input type="checkbox" checked={p.looking_for_genders.includes(v)} onChange={() => set("looking_for_genders", p.looking_for_genders.includes(v) ? p.looking_for_genders.filter((x) => x !== v) : [...p.looking_for_genders, v])} /> {l}</label>)}
          </div>
          <small className="muted">Niets aangevinkt = iedereen.</small>
        </div>
        <div className="theme-grid">
          <label>Leeftijd van<input type="number" min={18} max={99} value={p.age_min} onChange={(e) => set("age_min", Number(e.target.value))} /></label>
          <label>Leeftijd tot<input type="number" min={18} max={99} value={p.age_max} onChange={(e) => set("age_max", Number(e.target.value))} /></label>
        </div>
        <Sw k="show_age" label="Mijn leeftijd tonen" />
        {p.distance_enabled && <Sw k="show_distance" label="Mijn afstand tot anderen tonen" hint={p.location_found ? "Je plaats is gevonden: je kunt op afstand zoeken." : p.city ? "Je plaats is niet gevonden; controleer de spelling en het land." : "Vul je plaats in om op afstand te kunnen zoeken."} />}
        <Sw k="show_city" label="Mijn plaats tonen" />
      </Collapsible>

      <Collapsible id="prof-photos" title={`Foto's (${p.photos.length}/${p.max_photos})`}>
        <div className="photo-admin">
          {p.photos.map((ph, i) => (
            <div className="photo-item" key={ph.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(ph.url)} alt="" />
              <select value={ph.visibility} title={visibilityHint(ph.visibility)} onChange={(e) => setVisibility(ph, e.target.value)}>
                {visibilityOptions(p.private_photos || ph.visibility === "private").map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span><button className="btn sm" disabled={i === 0} onClick={() => move(i, -1)}>←</button>{" "}<button className="btn sm" disabled={i === p.photos.length - 1} onClick={() => move(i, 1)}>→</button></span>
                <button className="btn sm danger" onClick={() => delPhoto(ph.id)}>Verwijder</button>
              </div>
            </div>
          ))}
        </div>
        {p.photos.length < p.max_photos && (
          <div className="row" style={{ justifyContent: "flex-start", marginTop: ".75rem" }}>
            <div style={{ flex: 1, minWidth: 260 }}><PhotoDrop multiple onFiles={upload} label="Sleep foto's hierheen of klik om te kiezen" /></div>
            <label style={{ fontWeight: 500, fontSize: ".85rem" }}>Nieuwe foto's zichtbaar voor <select value={uploadVis} onChange={(e) => setUploadVis(e.target.value)}>{visibilityOptions(p.private_photos).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          </div>
        )}
        <small className="muted" style={{ display: "block", marginTop: ".5rem" }}>
          De eerste foto is je hoofdfoto. Maximaal {p.max_photos} foto's{p.private_photos ? `, waarvan ${p.max_private_photos} privé (wazig)` : ""}. Per foto kies je wie hem ziet: openbaar, alleen ingelogde leden (portal), privé of onzichtbaar.
          {p.private_photos && " Wazige foto's zien anderen pas scherp als je een verzoek accepteert of als jullie vrienden zijn (Vrienden & verzoeken)."}
        </small>
      </Collapsible>

      <Collapsible id="prof-visibility" title="Wie mag mijn pagina zien?">
        <div className="vis-options">
          {VIS.map(([v, label, hint]) => (
            <label key={v} className={`card vis ${p.visibility === v ? "active" : ""}`}>
              <input type="radio" name="vis" checked={p.visibility === v} onChange={() => set("visibility", v)} />
              <span><strong>{label}</strong><small className="muted"> {hint}</small></span>
            </label>
          ))}
        </div>
        {p.visibility === "selected" && (
          <div>
            <strong style={{ fontSize: ".85rem" }}>Geselecteerde leden ({p.allowed.length})</strong>
            <div className="chips" style={{ margin: ".4rem 0" }}>
              {p.allowed.map((u) => <button key={u.id} type="button" className="chip" onClick={() => setAllowed(p.allowed.filter((x) => x.id !== u.id))}>{u.name} <b>×</b></button>)}
              {!p.allowed.length && <span className="muted">Nog niemand: dan ziet alleen jijzelf je pagina.</span>}
            </div>
            <input placeholder="Zoek een lid om toe te voegen…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="suggest">
              {found.filter((u) => !p.allowed.some((a) => a.id === u.id)).map((u) => <button key={u.id} type="button" onClick={() => { setAllowed([...p.allowed, u]); setQ(""); }}>{u.name}</button>)}
            </div>
          </div>
        )}
        <div>
          <strong style={{ fontSize: ".85rem" }}>In welke talen is mijn pagina zichtbaar?</strong>
          <div className="perm-list">
            {p.available_languages.map((l) => (
              <label className="check" key={l} style={{ fontWeight: 500 }}><input type="checkbox" checked={p.languages.includes(l)} onChange={() => toggleLang(l)} /> {new Intl.DisplayNames(["nl"], { type: "language" }).of(l)}</label>
            ))}
          </div>
          <small className="muted">{p.languages.length ? "Alleen bezoekers die de site in deze talen bekijken zien je pagina." : "Geen taal aangevinkt = zichtbaar in alle talen."}</small>
        </div>
      </Collapsible>

      <Collapsible id="prof-find" title="Gevonden worden">
        <Sw k="searchable_local" label="Vindbaar in de ledenzoeker van dit systeem" />
        <Sw k="searchable_public" label="Vindbaar in openbare zoekmachines (Google, Bing, …)" hint="Werkt alleen als je pagina voor iedereen zichtbaar is." />
        <Sw k="accept_messages" label="Andere leden mogen mij berichten sturen" />
        <Sw k="accept_chat" label="Andere leden mogen mij chatten" />
      </Collapsible>
    </>
  );
}
