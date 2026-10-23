// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { api, errorText, mediaUrl } from "../lib/api";
import { tx } from "../lib/t";
import Tabs from "./Tabs";
import MediaView from "./MediaViews";

const TYPES = [["album", "Fotoboek"], ["carousel", "Beeldcarrousel"], ["wall", "Fotomuur"], ["slideshow", "Diavoorstelling"]];
const ABOUT = {
  album: "Een raster met foto's en een grote weergave bij een klik. Met lijstjes zoals een fotoboek (polaroid).",
  carousel: "Foto's naast elkaar die je doorschuift, met pijlen, puntjes en op wens vanzelf.",
  wall: "Een fotomuur waarin elke foto zijn eigen hoogte houdt.",
  slideshow: "Eén grote foto tegelijk met een overgang (vervagen, schuiven of inzoomen).",
};
const RATIO = [["1/1", "Vierkant"], ["4/3", "4:3"], ["3/2", "3:2"], ["16/9", "16:9"], ["3/4", "Staand"]];
const HOVER = [["none", "Geen"], ["zoom", "Inzoomen"], ["lift", "Omhoog met schaduw"], ["dim", "Lichter maken"], ["plane", "Vlak (donker/licht)"], ["caption", "Titel schuift in beeld"]];
const CAPS = [["none", "Geen"], ["below", "Onder de foto"], ["hover", "Bij mouse-over"]];
// the controls per type: [key, label, kind, options|[min,max], tab]
const CTRL = {
  album: [["columns", "Kolommen", "range", [2, 6], "look"], ["ratio", "Vorm van de foto", "select", RATIO, "look"], ["gap", "Ruimte tussen de foto's (px)", "range", [0, 40], "look"], ["radius", "Ronde hoeken (px)", "range", [0, 40], "look"],
    ["frame", "Lijst om de foto", "select", [["none", "Geen"], ["polaroid", "Polaroid"], ["border", "Rand"], ["shadow", "Schaduw"]], "look"], ["tilt", "Scheef neergelegd (bij polaroid)", "bool", null, "look"],
    ["hover", "Effect bij mouse-over", "select", HOVER, "fx"], ["plane_opacity", "Doorzichtigheid van het vlak (%)", "range", [0, 100], "fx"], ["shadow", "Schaduw", "bool", null, "fx"], ["captions", "Titel tonen", "select", CAPS, "fx"], ["lightbox", "Groot bekijken bij een klik", "bool", null, "fx"]],
  wall: [["columns", "Kolommen", "range", [2, 6], "look"], ["gap", "Ruimte tussen de foto's (px)", "range", [0, 40], "look"], ["radius", "Ronde hoeken (px)", "range", [0, 40], "look"],
    ["hover", "Effect bij mouse-over", "select", HOVER, "fx"], ["plane_opacity", "Doorzichtigheid van het vlak (%)", "range", [0, 100], "fx"], ["shadow", "Schaduw", "bool", null, "fx"], ["captions", "Titel tonen", "select", CAPS, "fx"], ["lightbox", "Groot bekijken bij een klik", "bool", null, "fx"]],
  carousel: [["visible", "Foto's tegelijk", "range", [1, 5], "look"], ["ratio", "Vorm van de foto", "select", RATIO, "look"], ["gap", "Ruimte tussen de foto's (px)", "range", [0, 40], "look"], ["radius", "Ronde hoeken (px)", "range", [0, 40], "look"],
    ["autoplay", "Schuift vanzelf door", "bool", null, "fx"], ["interval", "Seconden per stap", "range", [2, 12], "fx"], ["arrows", "Pijlen", "bool", null, "fx"], ["dots", "Puntjes", "bool", null, "fx"], ["loop", "Begint opnieuw aan het einde", "bool", null, "fx"],
    ["hover", "Effect bij mouse-over", "select", HOVER, "fx"], ["plane_opacity", "Doorzichtigheid van het vlak (%)", "range", [0, 100], "fx"], ["captions", "Titel tonen", "select", CAPS, "fx"], ["lightbox", "Groot bekijken bij een klik", "bool", null, "fx"]],
  slideshow: [["height", "Hoogte (px)", "range", [200, 900], "look"], ["radius", "Ronde hoeken (px)", "range", [0, 40], "look"], ["shadow", "Schaduw", "bool", null, "look"],
    ["transition", "Overgang", "select", [["fade", "Vervagen"], ["slide", "Schuiven"], ["zoom", "Inzoomen (Ken Burns)"]], "fx"], ["autoplay", "Gaat vanzelf door", "bool", null, "fx"], ["interval", "Seconden per foto", "range", [2, 12], "fx"],
    ["arrows", "Pijlen", "bool", null, "fx"], ["dots", "Puntjes", "bool", null, "fx"], ["captions", "Titel tonen", "select", CAPS, "fx"], ["caption_overlay", "Titel over de foto", "bool", null, "fx"], ["lightbox", "Groot bekijken bij een klik", "bool", null, "fx"]],
};
const START = {
  album: { columns: 4, ratio: "1/1", gap: 12, radius: 8, frame: "none", tilt: false, hover: "zoom", plane_opacity: 45, shadow: false, captions: "none", lightbox: true },
  wall: { columns: 4, ratio: "auto", gap: 10, radius: 8, hover: "zoom", plane_opacity: 45, shadow: false, captions: "none", lightbox: true },
  carousel: { visible: 3, ratio: "4/3", gap: 12, radius: 8, autoplay: true, interval: 4, arrows: true, dots: true, loop: true, hover: "zoom", plane_opacity: 45, captions: "none", lightbox: true },
  slideshow: { height: 480, radius: 8, shadow: false, transition: "fade", autoplay: true, interval: 5, arrows: true, dots: true, captions: "below", caption_overlay: true, lightbox: false },
};

// The editor of a media system object: name, which pictures, the look and the effects, with a live preview.
export default function MediaViewEditor({ view, onClose, onSaved }) {
  const [f, setF] = useState(() => view ? { name: view.name, type: view.type, source: { ...view.source }, settings: { ...START[view.type], ...view.settings } } : { name: "", type: "album", source: { mode: "all", ids: [], tags: [], limit: 24 }, settings: { ...START.album } });
  const [lib, setLib] = useState({ items: [], tags: [] });
  const [tab, setTab] = useState("src");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { api("/media/?kind=image").then(setLib).catch(() => {}); }, []);
  const set = (k, v) => setF((x) => ({ ...x, settings: { ...x.settings, [k]: v } }));
  const setSrc = (patch) => setF((x) => ({ ...x, source: { ...x.source, ...patch } }));
  const pickType = (t) => setF((x) => ({ ...x, type: t, settings: { ...START[t] } }));
  const items = useMemo(() => {
    const src = f.source, all = (lib.items || []).filter((i) => i.kind === "image");
    const rows = src.mode === "ids" ? src.ids.map((id) => all.find((i) => i.id === id)).filter(Boolean) : src.mode === "tags" ? all.filter((i) => (i.tags || []).some((t) => src.tags.includes(t))) : all;
    return rows.slice(0, src.limit || 24).map((i) => ({ url: i.url, name: i.name.replace(/\.[^.]+$/, ""), alt: i.name }));
  }, [f.source, lib]);
  const toggleId = (id) => setSrc({ ids: f.source.ids.includes(id) ? f.source.ids.filter((x) => x !== id) : [...f.source.ids, id] });
  const toggleTag = (t) => setSrc({ tags: f.source.tags.includes(t) ? f.source.tags.filter((x) => x !== t) : [...f.source.tags, t] });
  async function save() {
    setBusy(true); setErr("");
    try {
      const body = { name: f.name, type: f.type, source: f.source, settings: f.settings };
      const r = view ? await api(`/mediaviews/${view.id}/`, { method: "PATCH", body }) : await api("/mediaviews/", { method: "POST", body });
      onSaved?.(r); onClose();
    } catch (e) { setErr(errorText(e)); }
    setBusy(false);
  }
  const ctrl = (CTRL[f.type] || []).filter((c) => c[4] === tab);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="overlay mve-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card modal mve" role="dialog" aria-label={tx("Media-onderdeel bewerken")} onMouseDown={(e) => e.stopPropagation()}>
        <h2 style={{ margin: 0 }}>{view ? tx("Media-onderdeel bewerken") : tx("Nieuw media-onderdeel")}</h2>
        <div className="grid2">
          <label>{tx("Naam")}<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={100} placeholder={tx("Bijvoorbeeld: Vakantiefoto's")} /></label>
          <label>{tx("Soort")}<select value={f.type} disabled={!!view} onChange={(e) => pickType(e.target.value)}>{TYPES.map(([k, l]) => <option key={k} value={k}>{tx(l)}</option>)}</select></label>
        </div>
        <small className="muted">{tx(ABOUT[f.type])}</small>
        <Tabs value={tab} onChange={setTab} tabs={[["src", "Welke foto's"], ["look", "Weergave"], ["fx", "Effecten"]]} />
        {tab === "src" && (
          <div className="stack" style={{ gap: ".7rem" }}>
            <span className="pb-seg">{[["all", "Alle afbeeldingen"], ["tags", "Met een tag"], ["ids", "Zelf kiezen"]].map(([k, l]) => <button type="button" key={k} className={f.source.mode === k ? "on" : ""} onClick={() => setSrc({ mode: k })}>{tx(l)}</button>)}</span>
            {f.source.mode === "tags" && <div className="chips" style={{ margin: 0 }}>{(lib.tags || []).length ? lib.tags.map((t) => <button type="button" key={t.tag} className={`chip${f.source.tags.includes(t.tag) ? " on" : ""}`} onClick={() => toggleTag(t.tag)}>{t.tag} <small>{t.n}</small></button>) : <small className="muted">{tx("Er zijn nog geen tags. Geef bestanden een tag bij Media.")}</small>}</div>}
            {f.source.mode === "ids" && <div className="mve-pick">{(lib.items || []).filter((i) => i.kind === "image").slice(0, 300).map((i) => {
              const n = f.source.ids.indexOf(i.id);
              return <button type="button" key={i.id} className={`mve-thumb${n >= 0 ? " on" : ""}`} onClick={() => toggleId(i.id)} title={i.name}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={mediaUrl(i.url)} alt="" loading="lazy" />{n >= 0 && <b>{n + 1}</b>}</button>;
            })}</div>}
            <label>{tx("Maximaal aantal foto's")} <input type="number" min={1} max={60} value={f.source.limit} onChange={(e) => setSrc({ limit: Number(e.target.value) || 24 })} style={{ width: 90 }} /></label>
          </div>
        )}
        {tab !== "src" && (
          <div className="grid2">
            {ctrl.map(([k, label, kind, opt]) => kind === "bool"
              ? <label key={k} className="check"><input type="checkbox" checked={!!f.settings[k]} onChange={(e) => set(k, e.target.checked)} /> {tx(label)}</label>
              : kind === "range"
                ? <label key={k}>{tx(label)}<span className="row" style={{ gap: ".5rem" }}><input type="range" min={opt[0]} max={opt[1]} value={f.settings[k] ?? opt[0]} onChange={(e) => set(k, Number(e.target.value))} style={{ flex: 1 }} /><small className="muted">{f.settings[k]}</small></span></label>
                : <label key={k}>{tx(label)}<select value={f.settings[k]} onChange={(e) => set(k, e.target.value)}>{opt.map(([v, l]) => <option key={v} value={v}>{tx(l)}</option>)}</select></label>)}
          </div>
        )}
        <div><strong style={{ fontSize: ".85rem" }}>{tx("Voorbeeld (live)")}</strong> <small className="muted">{tx("Wijzig iets en kijk hier meteen; beweeg de muis over een foto voor het effect.")}</small>
          <div className="mve-preview"><MediaView type={f.type} settings={f.settings} items={items} /></div></div>
        {err && <div className="alert">{err}</div>}
        <div className="row"><button type="button" className="btn" onClick={onClose}>{tx("Annuleren")}</button><button type="button" className="btn primary" onClick={save} disabled={busy || !f.name.trim()}>{busy ? tx("Bezig…") : tx("Opslaan")}</button></div>
      </div>
    </div>, document.body);
}
