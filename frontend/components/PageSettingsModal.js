"use client";

import { tx } from "../lib/t";
import { useEffect, useState } from "react";
import { api, errorText, mediaUrl } from "../lib/api";
import { IconImage, IconSearch, IconSliders } from "./Icons";
import MediaPicker from "./MediaPicker";
import Tabs from "./Tabs";

const AUDIENCE = { all: "Iedereen", members: "Alleen ingelogde users", guests: "Alleen bezoekers (niet ingelogd)" };
const BG = [["none", "Geen"], ["image", "Afbeelding"], ["video", "Video"]];
const emptySeo = { title: "", description: "", og_media: null, og_image: null, noindex: false, canonical: "" };

// Pop-up with the basics of one page: name, audience, SEO per language and a background (picture or video) from the media library.
export default function PageSettingsModal({ page, languages, defaultLang, onClose, onSaved, canSeo }) {
  const langs = languages.length ? languages : [{ code: "nl", native_name: "Nederlands" }];
  const [tab, setTab] = useState("general");
  const [form, setForm] = useState({ title: { ...page.title }, audience: page.audience, new_tab: !!page.new_tab, url: page.url || "" });
  const [bg, setBg] = useState(page.background?.type ? { ...page.background } : { type: "none", overlay: 0.35 });
  const [seoLang, setSeoLang] = useState(defaultLang || langs[0].code);
  const [seo, setSeo] = useState({}); // lang -> fields
  const [seoIds, setSeoIds] = useState({}); // lang -> id of an existing record
  const [seoStart, setSeoStart] = useState("{}");
  const [seoNote, setSeoNote] = useState("");
  const [picker, setPicker] = useState(null); // "bg" | "og"
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const hasPath = page.path?.startsWith("/");

  useEffect(() => {
    if (!canSeo || !hasPath) return;
    api("/seo/pages/").then((rows) => {
      const s = {}, ids = {};
      rows.filter((r) => r.path === page.path).forEach((r) => { s[r.lang] = { title: r.title, description: r.description, og_media: r.og_media, og_image: r.og_image, noindex: r.noindex, canonical: r.canonical }; ids[r.lang] = r.id; });
      setSeo(s); setSeoIds(ids); setSeoStart(JSON.stringify(s));
    }).catch(() => setSeoNote(tx("SEO-instellingen zijn niet beschikbaar (module uit of geen rechten).")));
  }, [canSeo, hasPath, page.path]);

  const cur = { ...emptySeo, ...(seo[seoLang] || {}) };
  const setCur = (patch) => setSeo({ ...seo, [seoLang]: { ...cur, ...patch } });
  const isEmpty = (s) => !s || (!s.title && !s.description && !s.og_media && !s.noindex && !s.canonical);

  async function save(e) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const body = { title: form.title, background: bg.type === "none" || !bg.media ? {} : { type: bg.type, media: bg.media, overlay: bg.overlay } };
      if (page.kind !== "system") { body.audience = form.audience; body.new_tab = form.new_tab; }
      if (page.kind === "link") body.url = form.url;
      await api(`/pages/${page.id}/`, { method: "PATCH", body });
      if (canSeo && hasPath && !seoNote) {
        const start = JSON.parse(seoStart);
        for (const l of langs) {
          const now = seo[l.code], before = start[l.code];
          if (JSON.stringify(now || null) === JSON.stringify(before || null)) continue;
          if (isEmpty(now)) { if (seoIds[l.code]) await api(`/seo/pages/?id=${seoIds[l.code]}`, { method: "DELETE" }); continue; }
          await api("/seo/pages/", { method: "PUT", body: { path: page.path, lang: l.code, title: now.title, description: now.description, noindex: now.noindex, canonical: now.canonical, og_media: now.og_media } });
        }
      }
      onSaved();
    } catch (err) { setError(errorText(err)); setBusy(false); }
  }

  const tabs = [["general", "Algemeen", <IconSliders key="g" />], ["seo", "SEO", <IconSearch key="s" />], ["background", "Achtergrond", <IconImage key="b" />]];
  return (
    <div className="overlay" onClick={onClose}>
      <form className="card modal pgs form" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2 style={{ margin: 0 }}>{tx("Pagina-instellingen")}: {form.title[defaultLang] || page.key}</h2>
        <Tabs tabs={tabs} value={tab} onChange={setTab} />

        <div className="pgs-body">
          {tab === "general" && (
            <>
              <strong style={{ fontSize: ".85rem" }}>{tx("Naam per taal")}</strong>
              <div className="theme-grid">
                {langs.map((l) => (
                  <label key={l.code}>{l.native_name}
                    <input value={form.title?.[l.code] || ""} maxLength={80} required={l.code === defaultLang} onChange={(e) => setForm({ ...form, title: { ...form.title, [l.code]: e.target.value } })} />
                  </label>
                ))}
              </div>
              {page.kind === "link" && <label>{tx("Link")}<input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://… of /pad" required /></label>}
              {page.kind !== "system" && (
                <div className="theme-grid">
                  <label>{tx("Voor wie")}
                    <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>{Object.entries(AUDIENCE).map(([k, v]) => <option key={k} value={k}>{tx(v)}</option>)}</select>
                  </label>
                  <label className="check sec-toggle">
                    <span className="switch"><input type="checkbox" checked={form.new_tab} onChange={(e) => setForm({ ...form, new_tab: e.target.checked })} /><span /></span>
                    <span>{tx("Opent in een nieuw tabblad")}</span>
                  </label>
                </div>
              )}
              <small className="muted">{tx("Adres")}: <code>{page.path}</code></small>
            </>
          )}

          {tab === "seo" && (
            !hasPath ? <p className="muted">{tx("Een externe link heeft geen eigen SEO-instellingen.")}</p>
            : seoNote ? <p className="muted">{seoNote}</p>
            : (
              <>
                <div className="tabs tabset" style={{ marginTop: 0 }}>
                  {langs.map((l) => <button key={l.code} type="button" className={`btn sm ${seoLang === l.code ? "primary" : ""}`} onClick={() => setSeoLang(l.code)}>{l.native_name}</button>)}
                </div>
                <label>{tx("SEO-titel")} <small className="muted">{cur.title.length}/60</small>
                  <input value={cur.title} maxLength={200} onChange={(e) => setCur({ title: e.target.value })} placeholder={form.title?.[seoLang] || ""} />
                </label>
                <label>{tx("Omschrijving voor zoekmachines")} <small className="muted">{cur.description.length}/160</small>
                  <textarea rows={3} value={cur.description} maxLength={400} onChange={(e) => setCur({ description: e.target.value })} />
                </label>
                <div>
                  <strong style={{ fontSize: ".85rem" }}>{tx("Afbeelding bij delen (social media)")}</strong>
                  <div className="row" style={{ justifyContent: "flex-start", flexWrap: "nowrap", marginTop: ".4rem" }}>
                    {cur.og_image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(cur.og_image)} alt="" style={{ height: 64, borderRadius: 8 }} />}
                    <button type="button" className="btn" onClick={() => setPicker("og")}>{cur.og_media ? tx("Andere afbeelding") : tx("Kies uit mediabibliotheek")}</button>
                    {cur.og_media && <button type="button" className="btn danger" onClick={() => setCur({ og_media: null, og_image: null })}>{tx("Verwijderen")}</button>}
                  </div>
                </div>
                <div className="theme-grid">
                  <label>{tx("Canonical-adres")}<input value={cur.canonical} onChange={(e) => setCur({ canonical: e.target.value })} placeholder="https://…" /></label>
                  <label className="check sec-toggle">
                    <span className="switch"><input type="checkbox" checked={cur.noindex} onChange={(e) => setCur({ noindex: e.target.checked })} /><span /></span>
                    <span>{tx("Niet in zoekmachines tonen (noindex)")}</span>
                  </label>
                </div>
              </>
            )
          )}

          {tab === "background" && (
            <>
              <p className="muted" style={{ margin: 0 }}>{tx("Een afbeelding of video uit de mediabibliotheek als achtergrond van deze pagina. Uploaden kan in het kiesvenster.")}</p>
              <div className="tabs tabset" style={{ marginTop: 0 }}>
                {BG.map(([k, l]) => <button key={k} type="button" className={`btn ${bg.type === k ? "primary" : ""}`} onClick={() => setBg(k === "none" ? { type: "none", overlay: bg.overlay ?? 0.35 } : { ...bg, type: k, ...(bg.type !== k ? { media: null, url: null } : {}) })}>{tx(l)}</button>)}
              </div>
              {bg.type !== "none" && (
                <>
                  <div className="pgs-bgprev">
                    {bg.url
                      ? (bg.type === "video" ? <video src={mediaUrl(bg.url)} autoPlay muted loop playsInline /> : /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(bg.url)} alt="" />)
                      : <div className="muted" style={{ display: "grid", placeItems: "center", height: "100%", color: "#fff" }}>{tx("Nog niets gekozen")}</div>}
                    <div className="page-bg-shade" style={{ opacity: bg.overlay }} />
                  </div>
                  <div className="row" style={{ justifyContent: "flex-start", flexWrap: "nowrap" }}>
                    <button type="button" className="btn primary" onClick={() => setPicker("bg")}>{bg.url ? tx("Andere kiezen") : tx("Kies uit mediabibliotheek")}</button>
                    {bg.url && <button type="button" className="btn danger" onClick={() => setBg({ type: "none", overlay: bg.overlay })}>{tx("Verwijderen")}</button>}
                  </div>
                  <label>{tx("Donkerte over de achtergrond")} <small className="muted">{Math.round((bg.overlay ?? 0.35) * 100)}%</small>
                    <input type="range" min={0} max={0.9} step={0.05} value={bg.overlay ?? 0.35} onChange={(e) => setBg({ ...bg, overlay: Number(e.target.value) })} />
                  </label>
                </>
              )}
            </>
          )}
        </div>

        {error && <div className="alert">{error}</div>}
        <div className="row"><button type="button" className="btn" onClick={onClose}>{tx("Annuleren")}</button><button className="btn primary" disabled={busy}>{busy ? tx("Bezig…") : tx("Opslaan")}</button></div>
      </form>
      {picker && (
        <div onClick={(e) => e.stopPropagation()}>
          <MediaPicker kind={picker === "bg" && bg.type === "video" ? "video" : "image"} onClose={() => setPicker(null)}
            onPick={(i) => { if (picker === "bg") setBg({ ...bg, media: i.id, url: i.url, name: i.name }); else setCur({ og_media: i.id, og_image: i.url }); setPicker(null); }} />
        </div>
      )}
    </div>
  );
}
