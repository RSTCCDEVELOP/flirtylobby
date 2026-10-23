// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useRef, useState } from "react";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";
import { IconGrid, IconImage, IconSettings } from "./Icons";
const IconAi = () => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></svg>;
import Tabs from "./Tabs";
import ThemeLayout from "./ThemeLayout";

// A theme from a website address: 1. address, 2. progress while it is made, 3. check it with examples, 4. save as a theme package.
const SLOTS = [["logo", "Logo"], ["logo_dark", "Logo (donker)"], ["favicon", "Favicon"], ["icon", "App-icoon"], ["og_image", "Deelafbeelding"]];

// the theme css is made for the whole page: here it applies to the example block only
const scoped = (css) => css.replace(/html:root,html:root\[data-theme="light"\]/g, ".draft-scope").replace(/html:root\[data-theme="dark"\]/g, ".draft-scope.dark").replace(/html:root/g, ".draft-scope");

export default function ThemeImport({ ai, onClose, onSaved }) {
  const [step, setStep] = useState("url"); // url | busy | review
  const [url, setUrl] = useState("");
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");
  const [css, setCss] = useState("");
  const [dark, setDark] = useState(false);
  const [meta, setMeta] = useState({ name: "", description: "" });
  const [useAssets, setUseAssets] = useState([]);
  const [useHome, setUseHome] = useState([]);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("data");
  const [usePhotos, setUsePhotos] = useState([]); // photos of the site that go into the media library
  const [slide, setSlide] = useState(0);
  const [ask, setAsk] = useState(""); // what Claude has to change
  const [aiBusy, setAiBusy] = useState(false);
  const [note, setNote] = useState("");
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function begin(e) {
    e.preventDefault(); setError("");
    try { const j = await api("/theme/import/", { method: "POST", body: { url } }); setJob(j); setStep("busy"); poll(j.id); } catch (err) { setError(errorText(err)); }
  }
  function poll(id) {
    timer.current = setTimeout(async () => {
      try {
        const j = await api(`/theme/import/${id}/`);
        setJob(j);
        if (j.status === "running") return poll(id);
        if (j.status === "error") { setError(j.error); setStep("url"); return; }
        const d = j.draft;
        setMeta({ name: d.name, description: d.description });
        // light or dark: the start mode of the theme when it has one, else what you are looking at now (the setting or choice of the site)
        setDark(d.values.default_mode === "dark" || (d.values.default_mode !== "light" && document.documentElement.dataset.theme === "dark"));
        setUsePhotos([]); setSlide(0);
        setUseAssets(Object.keys(d.assets)); setUseHome(d.home.map((_, i) => i));
        const r = await api("/theme/preview/", { method: "POST", body: { values: d.values } });
        setCss(scoped(r.css));
        if (r.fonts_url && !document.querySelector(`link[href="${r.fonts_url}"]`)) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = r.fonts_url; document.head.appendChild(l); }
        setStep("review");
      } catch (err) { setError(errorText(err)); setStep("url"); }
    }, 1200);
  }
  async function loadCss(values) {
    const r = await api("/theme/preview/", { method: "POST", body: { values } });
    setCss(scoped(r.css));
    if (r.fonts_url && !document.querySelector(`link[href="${r.fonts_url}"]`)) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = r.fonts_url; document.head.appendChild(l); }
  }
  // import the same address again (a fresh reading of the site; the draft you have now is thrown away)
  async function again() {
    clearTimeout(timer.current);
    const old = job; setError(""); setNote("");
    try {
      const j = await api("/theme/import/", { method: "POST", body: { url: old.url } });
      api(`/theme/import/${old.id}/`, { method: "DELETE" }).catch(() => {});
      setJob(j); setStep("busy"); poll(j.id);
    } catch (err) { setError(errorText(err)); }
  }
  // Claude changes the draft after the text the user writes
  async function improve(undo = false) {
    setAiBusy(true); setError(""); setNote("");
    try {
      const j = await api(`/theme/import/${job.id}/refine/`, { method: "POST", body: undo ? { undo: true } : { prompt: ask } });
      setJob(j); setMeta({ name: j.draft.name, description: j.draft.description });
      await loadCss(j.draft.values);
      setNote(undo ? tx("De vorige versie is teruggezet.") : j.summary); if (!undo) setAsk("");
    } catch (err) { setError(errorText(err)); }
    setAiBusy(false);
  }
  async function discard() {
    clearTimeout(timer.current);
    if (job) api(`/theme/import/${job.id}/`, { method: "DELETE" }).catch(() => {});
    onClose();
  }
  async function save() {
    setSaving(true); setError("");
    try { const r = await api(`/theme/import/${job.id}/save/`, { method: "POST", body: { ...meta, assets: useAssets, home: useHome, photos: usePhotos } }); onSaved(r.packs, r.key, r.photos); } catch (err) { setError(errorText(err)); setSaving(false); }
  }
  const toggle = (list, setList, v) => setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const d = job?.draft;

  return (
    <div className="overlay" onClick={step === "url" ? onClose : undefined}>
      <div className="card modal form" style={{ maxWidth: step === "review" ? 1000 : 560 }} onClick={(e) => e.stopPropagation()}>
        <h2>{tx("Thema maken van een website")}</h2>
        {error && <div className="alert">{error}</div>}

        {step === "url" && (
          <form className="form" onSubmit={begin}>
            <label>{tx("Webadres van de website")}<input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.voorbeeld.nl" required autoFocus /></label>
            <p className="muted" style={{ margin: 0 }}>
              {ai ? tx("Claude is gekoppeld: de kleuren, lettertypen, vormen, logo's en afbeeldingen van de website worden uitgelezen en Claude ontwerpt daaruit een compleet thema.") : tx("Claude is niet gekoppeld of staat uit: het thema wordt afgeleid uit de kleuren, lettertypen en vormen van de website. Koppel Claude bij API keys voor een completer resultaat.")}
            </p>
            <small className="muted">{tx("Er wordt nog niets opgeslagen. Eerst bekijk je het resultaat met voorbeelden.")}</small>
            <div className="row" style={{ justifyContent: "flex-end" }}><button type="button" className="btn" onClick={onClose}>{tx("Annuleren")}</button><button className="btn primary">{tx("Thema maken")}</button></div>
          </form>
        )}

        {step === "busy" && (
          <div className="stack-sm">
            <p style={{ margin: 0 }}><strong>{tx(job?.step || "Bezig…")}</strong></p>
            <div className="imp-bar" role="progressbar" aria-valuenow={job?.progress || 0} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${job?.progress || 0}%` }} /></div>
            <small className="muted">{job?.progress || 0}% · {ai ? tx("Dit duurt ongeveer een halve minuut.") : tx("Dit duurt maar even.")}</small>
            <div className="row" style={{ justifyContent: "flex-end" }}><button type="button" className="btn" onClick={discard}>{tx("Stoppen")}</button></div>
          </div>
        )}

        {step === "review" && d && (
          <div className="stack-sm">
            <p className="muted" style={{ margin: 0 }}>
              {d.ai ? tx("Claude heeft dit thema ontworpen op basis van {0}.", job.url) : tx("Dit thema is afgeleid uit de kleuren en lettertypen van {0}.", job.url)} {tx("Controleer de voorbeelden; pas daarna wordt het opgeslagen als themapakket.")}
            </p>
            {d.notes.map((n) => <div key={n} className="alert">{n}</div>)}
            <Tabs value={tab} onChange={setTab} tabs={[["data", "Gegevens", <IconSettings key="d" />], ["ai", "AI", <IconAi key="a" />],
              ["images", "Afbeeldingen", <IconImage key="i" />, `${useAssets.length + useHome.length}/${Object.keys(d.assets).length + d.home.length}`], ["photos", "Foto's", <IconImage key="f" />, `${usePhotos.length}/${d.photos.length}`], ["pages", "Pagina's", <IconGrid key="p" />], ["popups", "Popups", <IconGrid key="q" />]]} />

            {tab === "data" && (
              <>
                <div className="grid2">
                  <label>{tx("Naam")}<input value={meta.name} maxLength={60} onChange={(e) => setMeta({ ...meta, name: e.target.value })} /></label>
                  <label>{tx("Omschrijving")}<input value={meta.description} maxLength={300} onChange={(e) => setMeta({ ...meta, description: e.target.value })} /></label>
                </div>
                <div className="row" style={{ justifyContent: "flex-start" }}>
                  <strong>{tx("Kleuren")}:</strong>
                  {["primary", "secondary", "light_bg", "light_card", "dark_bg", "dark_card"].map((k) => <i key={k} title={k} style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid var(--line)", background: d.values[k], display: "inline-block" }} />)}
                  <small className="muted">{d.values.font_heading} / {d.values.font_body}</small>
                </div>
              </>
            )}

            {tab === "ai" && (
              <div className="stack-sm">
                  <strong>{tx("Verbeter layout en kleuren met AI")}</strong>
                  {job.ai ? (
                    <>
                      <label>{tx("Wat moet er anders?")}
                        <textarea rows={3} value={ask} maxLength={800} disabled={aiBusy} onChange={(e) => setAsk(e.target.value)} placeholder={tx("Bijvoorbeeld: maak de kleuren warmer, de hoeken rond en de popups rustiger.")} />
                      </label>
                      <div className="row" style={{ justifyContent: "flex-start" }}>
                        {["Warmere kleuren", "Meer contrast", "Rondere vormen", "Strakker en zakelijker", "Rustiger popups", "Donkerder thema"].map((x) => <button key={x} type="button" className="chip" disabled={aiBusy} onClick={() => setAsk(tx(x))}>{tx(x)}</button>)}
                      </div>
                      {aiBusy && <div className="imp-bar imp-wait" role="progressbar"><span /></div>}
                      <div className="row" style={{ justifyContent: "flex-start" }}>
                        <button type="button" className="btn primary" disabled={aiBusy || ask.trim().length < 3} onClick={() => improve()}>{aiBusy ? tx("Claude past het thema aan…") : tx("Verbeter met AI")}</button>
                        {d.can_undo && <button type="button" className="btn" disabled={aiBusy} onClick={() => improve(true)}>{tx("Ongedaan maken")}</button>}
                      </div>
                      {note && <div className="alert ok">{note}</div>}
                    </>
                  ) : <small className="muted">{tx("Koppel Claude bij Admin → API keys om het thema met AI te laten verbeteren.")}</small>}
                </div>
            )}

            {tab === "images" && (
              <div className="row" style={{ justifyContent: "flex-start", alignItems: "stretch" }}>
                {SLOTS.filter(([k]) => d.assets[k]).map(([k, label]) => (
                  <label key={k} className="check card" style={{ padding: ".5rem .7rem", flexDirection: "column", alignItems: "flex-start" }}>
                    <span style={{ width: 120, height: 64, display: "block", background: "var(--bg)", borderRadius: 8, overflow: "hidden" }}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={d.assets[k].url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} /></span>
                    <span><input type="checkbox" checked={useAssets.includes(k)} onChange={() => toggle(useAssets, setUseAssets, k)} /> {tx(label)}</span>
                  </label>
                ))}
                {d.home.map((h, i) => (
                  <label key={i} className="check card" style={{ padding: ".5rem .7rem", flexDirection: "column", alignItems: "flex-start" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}<img src={h.url} alt="" style={{ width: 120, height: 64, objectFit: "cover", borderRadius: 8 }} />
                    <span><input type="checkbox" checked={useHome.includes(i)} onChange={() => toggle(useHome, setUseHome, i)} /> {tx("Homepagefoto {0}", i + 1)}</span>
                  </label>
                ))}
                {!Object.keys(d.assets).length && !d.home.length && <small className="muted">{tx("Er zijn geen logo's of afbeeldingen gevonden.")}</small>}
              </div>
            )}

            {tab === "photos" && (
              <div className="stack-sm">
                {!d.photos.length ? <p className="muted" style={{ margin: 0 }}>{tx("Er zijn geen foto's gevonden op de website.")}</p> : (
                  <>
                    <p className="muted" style={{ margin: 0 }}>{tx("Dit zijn de foto's van de website. Kies welke je in de mediabibliotheek wilt zetten; ze krijgen de label import en de naam van het thema.")}</p>
                    <div className="slider" tabIndex={0} onKeyDown={(e) => { if (e.key === "ArrowLeft") setSlide((slide + d.photos.length - 1) % d.photos.length); if (e.key === "ArrowRight") setSlide((slide + 1) % d.photos.length); }}>
                      <button type="button" className="btn slider-nav" aria-label={tx("Vorige foto")} onClick={() => setSlide((slide + d.photos.length - 1) % d.photos.length)}>‹</button>
                      <div className="slider-main">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={d.photos[slide].url} alt={d.photos[slide].name} />
                      </div>
                      <button type="button" className="btn slider-nav" aria-label={tx("Volgende foto")} onClick={() => setSlide((slide + 1) % d.photos.length)}>›</button>
                    </div>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <label className="check"><input type="checkbox" checked={usePhotos.includes(slide)} onChange={() => toggle(usePhotos, setUsePhotos, slide)} /> <strong>{tx("In de mediabibliotheek zetten")}</strong></label>
                      <small className="muted">{slide + 1} / {d.photos.length} · {d.photos[slide].name} · {d.photos[slide].w}×{d.photos[slide].h} · {Math.max(1, Math.round(d.photos[slide].size / 1024))} KB</small>
                    </div>
                    <div className="slider-strip">
                      {d.photos.map((p, i) => (
                        <button key={i} type="button" className={`slider-thumb ${i === slide ? "on" : ""} ${usePhotos.includes(i) ? "picked" : ""}`} onClick={() => setSlide(i)} aria-label={p.name}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}<img src={p.url} alt="" />
                          {usePhotos.includes(i) && <span className="slider-check">✓</span>}
                        </button>
                      ))}
                    </div>
                    <div className="row" style={{ justifyContent: "flex-start" }}>
                      <button type="button" className="btn sm" onClick={() => setUsePhotos(d.photos.map((_, i) => i))}>{tx("Alles selecteren")}</button>
                      <button type="button" className="btn sm" onClick={() => setUsePhotos([])}>{tx("Niets selecteren")}</button>
                    </div>
                  </>
                )}
              </div>
            )}

            {(tab === "pages" || tab === "popups") && (
              <>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <strong>{tab === "pages" ? tx("Pagina-indelingen met dit thema") : tx("Popups met dit thema")}</strong>
                  <span className="row" style={{ gap: ".4rem" }}>
                    <button type="button" className={`btn sm ${!dark ? "primary" : ""}`} onClick={() => setDark(false)}>{tx("Licht")}</button>
                    <button type="button" className={`btn sm ${dark ? "primary" : ""}`} onClick={() => setDark(true)}>{tx("Donker")}</button>
                  </span>
                </div>
                <style>{css}</style>
                <div className={`draft-scope ${dark ? "dark" : ""}`} style={{ maxHeight: "48vh", overflow: "auto" }}>
                  <ThemeLayout draft={{ logo: d.assets.logo?.url || null, show: tab, values: d.values }} />
                </div>
              </>
            )}

            <div className="row" style={{ justifyContent: "space-between" }}>
              <button type="button" className="btn" disabled={saving || aiBusy} onClick={again}>{tx("Opnieuw importeren")}</button>
              <span className="row">
              <button type="button" className="btn" disabled={saving} onClick={discard}>{tx("Weggooien")}</button>
              <button type="button" className="btn primary" disabled={saving || !meta.name.trim()} onClick={save}>{saving ? tx("Bezig…") : tx("Opslaan als thema")}</button>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
