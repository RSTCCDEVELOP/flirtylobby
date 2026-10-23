// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { Busy } from "./PageLoader";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAutoSave } from "../lib/autosave";
import { api, errorText, mediaUrl } from "../lib/api";
import { tx } from "../lib/t";
import { LOADER_STYLES, LoaderArt, LoaderTest } from "./PageLoader";
import Collapsible, { CollapseAll } from "./Collapsible";
import MediaPicker from "./MediaPicker";
import SaveStatus from "./SaveStatus";

// Page loaders: lazy load, the look of the loader (in the style of the theme) and a test button. Saved by itself, with the theme.
const NAMES = { ring: "Ring", dots: "Stippen", bar: "Voortgangsbalk", pulse: "Pulserende bol", orbit: "Baantjes", squares: "Blokjes", wave: "Golf", skeleton: "Pagina-schets", logo: "Logo", image: "Eigen afbeelding" };
const ANIMS = [["pulse", "Pulseren"], ["spin", "Draaien"], ["bounce", "Springen"], ["none", "Stilstaand"]];
const WHEN = [["first", "Alleen bij het eerste laden van de site"], ["always", "Ook tussen pagina's"]];
const BACKDROP = [["page", "Achtergrond van de pagina"], ["glass", "Glas (vervaagd)"], ["dim", "Donker gedimd"]];
const TRANS = [["none", "Geen"], ["fade", "Vervagen"], ["slide", "Schuiven"], ["zoom", "Inzoomen"], ["blur", "Scherp worden"]];
const REVEAL = [["none", "Geen"], ["fade", "Vervagen"], ["up", "Omhoog schuiven"], ["zoom", "Inzoomen"], ["left", "Van links"]];
function FxTiles({ value, onChange, options, disabled }) {
  return (
    <div className="fx-tiles" role="radiogroup">
      {options.map(([k, l]) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} disabled={disabled} className={`loader-tile${value === k ? " on" : ""}`} onClick={() => onChange(k)}>
          <span className={`fx-demo fx-${k}`}>{k === "none" ? <span style={{ animation: "none", opacity: 0.5 }} /> : <span />}</span>
          <span>{tx(l)}</span>
        </button>
      ))}
    </div>
  );
}

const Sw = ({ label, hint, checked, onChange, disabled }) => (
  <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /><span /></span><span>{label}{hint && <small className="muted"> {hint}</small>}</span></label>
);

export default function LoaderAdmin({ canEdit = true }) {
  const router = useRouter();
  const [vals, setVals] = useState(null);
  const [msg, setMsg] = useState(null);
  const [pick, setPick] = useState(false);
  const [test, setTest] = useState(0); // 0 = none, otherwise the number of the preview that is showing (a new number restarts it)
  const [ms, setMs] = useState(3000);
  const show = (n = 3000) => { setMs(n); setTest((t) => t + 1); };
  useEffect(() => { api("/theme/").then((d) => setVals(d.values)).catch((e) => setMsg(errorText(e))); }, []);
  const auto = useAutoSave(vals, async () => { try { const d = await api("/theme/", { method: "PUT", body: { values: Object.fromEntries(Object.entries(vals).filter(([k]) => k !== "loader_image_url")) } }); setVals(d.values); window.dispatchEvent(new Event("theme-saved")); router.refresh(); setMsg(null); } catch (e) { setMsg(errorText(e)); return false; } }, { ready: !!vals && canEdit, delay: 800 });
  if (!vals) return msg ? <div className="alert">{msg}</div> : <Busy />;
  const set = (patch) => setVals({ ...vals, ...patch });
  const setShow = (patch) => { set(patch); show(1600); }; // a change of the loader shows the loader at once
  const on = vals.loader_on === "yes";
  return (
    <div className="form" style={{ gap: "1.2rem", maxWidth: 900 }}>
      {msg && <div className="alert">{msg}</div>}
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}><p className="muted" style={{ margin: 0 }}>{tx("Een paginaloader laat bezoekers iets zien terwijl de site laadt. De loaders hebben de kleuren, rondingen en het logo van het gekozen thema. Wijzigingen worden automatisch opgeslagen.")} <SaveStatus auto={auto} /></p><CollapseAll /></div>

      <Collapsible id="loader-lazy" title={tx("Lazy load")} defaultOpen={true}>
        <div className="form">
        <Sw label={tx("Afbeeldingen pas laden als ze in beeld komen")} hint={tx("De pagina opent sneller; afbeeldingen onder het scherm laden later.")} checked={vals.loader_lazy !== "no"} disabled={!canEdit} onChange={(v) => set({ loader_lazy: v ? "yes" : "no" })} />
        </div>
      </Collapsible>

      <Collapsible id="loader-page" title={tx("Paginaloader")} defaultOpen={true}>
        <div className="form">
        {!on && <div className="alert" style={{ background: "#fef3c7", color: "#78350f" }}>{tx("De loader staat uit: bezoekers zien hem niet. Zet Paginaloader tonen aan om hem op de site te gebruiken. Een wijziging hieronder laat de loader kort zien als voorbeeld.")}</div>}
        <Sw label={tx("Paginaloader tonen")} checked={on} disabled={!canEdit} onChange={(v) => (v ? setShow({ loader_on: "yes" }) : set({ loader_on: "no" }))} />
        <div>
          <strong className="opt-title">{tx("Soort loader")}</strong>
          <div className="loader-tiles">
            {LOADER_STYLES.map((k) => (
              <button key={k} type="button" className={`loader-tile${vals.loader_style === k ? " on" : ""}`} disabled={!canEdit} onClick={() => { if (k === "image") { setVals((v) => ({ ...v, loader_style: "image" })); setPick(true); } else setShow({ loader_style: k }); }} aria-pressed={vals.loader_style === k}>
                <LoaderArt kind={k} size={40} image={vals.loader_image_url} anim="none" />
                <span>{tx(NAMES[k])}</span>
              </button>
            ))}
          </div>
        </div>
        <Sw label={tx("Percentage tonen onder de animatie")} hint={tx("Een getal van 0 tot 100% dat meeloopt met het laden.")} checked={vals.loader_percent === "yes"} disabled={!canEdit} onChange={(v) => setShow({ loader_percent: v ? "yes" : "no" })} />
        {vals.loader_style === "image" && (
          <Collapsible id="loader-image" title={tx("Eigen afbeelding")} defaultOpen>
          <div className="form">
            <div className="row" style={{ justifyContent: "flex-start", flexWrap: "nowrap", gap: ".8rem" }}>
              {vals.loader_image_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(vals.loader_image_url)} alt="" style={{ height: 56, borderRadius: 8 }} /> : <span className="muted">{tx("Nog geen afbeelding gekozen: er verschijnt tijdelijk de ring.")}</span>}
              <button type="button" className="btn" disabled={!canEdit} onClick={() => setPick(true)}>{tx("Kies uit de media")}</button>
              {vals.loader_image_id > 0 && <button type="button" className="btn danger" disabled={!canEdit} onClick={() => setShow({ loader_image_id: 0, loader_image_url: "" })}>{tx("Verwijderen")}</button>}
            </div>
            <label style={{ maxWidth: 420 }}>{tx("Grootte van de afbeelding")} <small className="muted">{vals.loader_image_size ?? 80} px</small>
              <input type="range" min={24} max={500} step={4} disabled={!canEdit} value={vals.loader_image_size ?? 80} onChange={(e) => set({ loader_image_size: Number(e.target.value) })} onMouseUp={() => show(1600)} onTouchEnd={() => show(1600)} onKeyUp={() => show(1600)} />
            </label>
            <label style={{ maxWidth: 420 }}>{tx("Doorzichtigheid van de afbeelding")} <small className="muted">{vals.loader_image_opacity ?? 100}% {tx("zichtbaar")}</small><input type="range" min={5} max={100} step={5} disabled={!canEdit} value={vals.loader_image_opacity ?? 100} onChange={(e) => set({ loader_image_opacity: Number(e.target.value) })} onMouseUp={() => show(1600)} onKeyUp={() => show(1600)} /></label>
            <div className="theme-grid">
              <label>{tx("Ronde hoeken")} <small className="muted">{vals.loader_image_radius ?? 0} px</small><input type="range" min={0} max={250} step={2} disabled={!canEdit} value={vals.loader_image_radius ?? 0} onChange={(e) => set({ loader_image_radius: Number(e.target.value) })} onMouseUp={() => show(1600)} onKeyUp={() => show(1600)} /></label>
              <label>{tx("Rand (dikte)")} <small className="muted">{vals.loader_image_border ?? 0} px</small><input type="range" min={0} max={24} step={1} disabled={!canEdit} value={vals.loader_image_border ?? 0} onChange={(e) => set({ loader_image_border: Number(e.target.value) })} onMouseUp={() => show(1600)} onKeyUp={() => show(1600)} /></label>
              {(vals.loader_image_border ?? 0) > 0 && <label>{tx("Kleur van de rand")}<input type="color" disabled={!canEdit} value={vals.loader_image_border_color || "#f2823f"} onChange={(e) => set({ loader_image_border_color: e.target.value })} onBlur={() => show(1600)} style={{ height: "2.6rem", padding: 2 }} /></label>}
              <label>{tx("Ruimte tussen rand en afbeelding")} <small className="muted">{vals.loader_image_pad ?? 0} px</small><input type="range" min={0} max={60} step={2} disabled={!canEdit} value={vals.loader_image_pad ?? 0} onChange={(e) => set({ loader_image_pad: Number(e.target.value) })} onMouseUp={() => show(1600)} onKeyUp={() => show(1600)} /></label>
            </div>
            <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={vals.loader_image_bg_on === "yes"} disabled={!canEdit} onChange={(e) => setShow({ loader_image_bg_on: e.target.checked ? "yes" : "no" })} /><span /></span><span>{tx("Achtergrondkleur achter de afbeelding")}</span></label>
            {vals.loader_image_bg_on === "yes" && <label style={{ maxWidth: 420 }}>{tx("Doorzichtigheid van de achtergrondkleur")} <small className="muted">{vals.loader_image_bg_opacity ?? 100}% {tx("zichtbaar")}</small><input type="range" min={0} max={100} step={5} disabled={!canEdit} value={vals.loader_image_bg_opacity ?? 100} onChange={(e) => set({ loader_image_bg_opacity: Number(e.target.value) })} onMouseUp={() => show(1600)} onKeyUp={() => show(1600)} /></label>}
            {vals.loader_image_bg_on === "yes" && <label style={{ maxWidth: 200 }}>{tx("Achtergrondkleur")}<input type="color" disabled={!canEdit} value={vals.loader_image_bg || "#ffffff"} onChange={(e) => set({ loader_image_bg: e.target.value })} onBlur={() => show(1600)} style={{ height: "2.6rem", padding: 2 }} /></label>}
            <label style={{ maxWidth: 260 }}>{tx("Beweging")}<select disabled={!canEdit} value={vals.loader_image_anim || "pulse"} onChange={(e) => setShow({ loader_image_anim: e.target.value })}>{ANIMS.map(([k, l]) => <option key={k} value={k}>{tx(l)}</option>)}</select></label>
          </div>
          </Collapsible>
        )}
        <div className="theme-grid">
          <label>{tx("Wanneer")}<select disabled={!canEdit} value={vals.loader_when} onChange={(e) => set({ loader_when: e.target.value })}>{WHEN.map(([k, l]) => <option key={k} value={k}>{tx(l)}</option>)}</select></label>
          <label>{tx("Achtergrond")}<select disabled={!canEdit} value={vals.loader_backdrop} onChange={(e) => setShow({ loader_backdrop: e.target.value })}>{BACKDROP.map(([k, l]) => <option key={k} value={k}>{tx(l)}</option>)}</select></label>
          <label>{tx("Doorzichtigheid van de laag achter de loader")} <small className="muted">{vals.loader_opacity ?? 100}% {tx("dekkend")}</small><input type="range" min={10} max={100} step={5} disabled={!canEdit} value={vals.loader_opacity ?? 100} onChange={(e) => set({ loader_opacity: Number(e.target.value) })} onMouseUp={() => show(1600)} onTouchEnd={() => show(1600)} onKeyUp={() => show(1600)} /></label>
          <label>{tx("Grootte")} <small className="muted">{vals.loader_size} px</small><input type="range" min={24} max={120} step={4} disabled={!canEdit} value={vals.loader_size} onChange={(e) => set({ loader_size: Number(e.target.value) })} onMouseUp={() => show(1600)} onTouchEnd={() => show(1600)} onKeyUp={() => show(1600)} /></label>
          <label>{tx("Minimaal zichtbaar")} <small className="muted">{vals.loader_min} ms</small><input type="range" min={0} max={3000} step={50} disabled={!canEdit} value={vals.loader_min} onChange={(e) => set({ loader_min: Number(e.target.value) })} /></label>
        </div>
        <div className="row" style={{ justifyContent: "flex-start" }}>
          <button type="button" className="btn primary" onClick={() => show(3000)}>{tx("Test de loader")}</button>
          <small className="muted">{tx("Toont de loader 3 seconden over dit scherm. Klik erop om hem te sluiten.")}</small>
        </div>
        </div>
      </Collapsible>
      <Collapsible id="loader-transition" title={tx("Pagina-overgang")} defaultOpen={false}>
        <div className="form">
        <p className="muted" style={{ margin: 0 }}>{tx("Het effect als je naar een andere pagina gaat: de nieuwe pagina verschijnt op die manier.")}</p>
        <Sw label={tx("Pagina-overgang gebruiken")} checked={(vals.page_transition || "none") !== "none"} disabled={!canEdit} onChange={(v) => set({ page_transition: v ? "fade" : "none" })} />
        {(vals.page_transition || "none") !== "none" && <FxTiles value={vals.page_transition} onChange={(v) => set({ page_transition: v })} options={TRANS.filter(([k]) => k !== "none")} disabled={!canEdit} />}
        {(vals.page_transition || "none") !== "none" && <label style={{ maxWidth: 360 }}>{tx("Duur")} <small className="muted">{vals.page_transition_ms ?? 350} ms</small><input type="range" min={100} max={1000} step={50} disabled={!canEdit} value={vals.page_transition_ms ?? 350} onChange={(e) => set({ page_transition_ms: Number(e.target.value) })} /></label>}
        </div>
      </Collapsible>

      <Collapsible id="loader-scroll" title={tx("Scrolleffecten")} defaultOpen={false}>
        <div className="form">
        <p className="muted" style={{ margin: 0 }}>{tx("Onderdelen van een pagina verschijnen als ze in beeld komen. Voor mensen die minder beweging willen (instelling van hun apparaat) staat dit automatisch uit.")}</p>
        <FxTiles value={vals.scroll_reveal || "none"} onChange={(v) => set({ scroll_reveal: v })} options={REVEAL} disabled={!canEdit} />
        {(vals.scroll_reveal || "none") !== "none" && <label style={{ maxWidth: 360 }}>{tx("Duur")} <small className="muted">{vals.scroll_reveal_ms ?? 600} ms</small><input type="range" min={200} max={1500} step={50} disabled={!canEdit} value={vals.scroll_reveal_ms ?? 600} onChange={(e) => set({ scroll_reveal_ms: Number(e.target.value) })} /></label>}
        <Sw label={tx("Parallax")} hint={tx("Achtergrondafbeeldingen en -video's bewegen trager mee dan de pagina.")} checked={vals.scroll_parallax === "yes"} disabled={!canEdit} onChange={(v) => set({ scroll_parallax: v ? "yes" : "no" })} />
        <Sw label={tx("Voortgangsbalk bovenaan")} hint={tx("Een dunne balk die laat zien hoever je op de pagina bent.")} checked={vals.scroll_progress === "yes"} disabled={!canEdit} onChange={(v) => set({ scroll_progress: v ? "yes" : "no" })} />
        <Sw label={tx("Knop om terug naar boven te gaan")} checked={vals.scroll_top === "yes"} disabled={!canEdit} onChange={(v) => set({ scroll_top: v ? "yes" : "no" })} />
        </div>
      </Collapsible>
      {pick && <MediaPicker kind="image" onClose={() => { setPick(false); setVals((v) => (v.loader_style === "image" && !v.loader_image_id ? { ...v, loader_style: "ring" } : v)); }} onPick={(it) => { setPick(false); setShow({ loader_image_id: it.id, loader_image_url: it.url, loader_style: "image" }); }} />}
      {test > 0 && <LoaderTest key={test} values={vals} ms={ms} onClose={() => setTest(0)} />}
    </div>
  );
}
