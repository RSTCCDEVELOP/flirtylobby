// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useRef, useState } from "react";
import { mediaUrl } from "../lib/api";
import { tx } from "../lib/t";
import MediaPicker from "./MediaPicker";

// The picture that is shown now and the one that just went away (for the animation): one step every `sec` seconds. One picture: nothing runs.
function useSlide(count, sec) {
  const [st, setSt] = useState({ i: 0, prev: -1 });
  const n = useRef(count);
  n.current = count;
  useEffect(() => {
    if (count < 2) { setSt({ i: 0, prev: -1 }); return undefined; }
    const t = setInterval(() => setSt((c) => ({ i: (c.i + 1) % n.current, prev: c.i })), Math.max(2, sec) * 1000);
    return () => clearInterval(t);
  }, [count, sec]);
  return count < 2 ? { i: 0, prev: -1 } : st;
}

// A background (picture or video from the media library) behind a block or a hero. bg: {type, media, overlay, url} or empty.
export function BgLayer({ bg }) {
  const slide = useSlide(bg?.url && (bg.more || []).some((m) => m?.url) ? (bg.more || []).filter((m) => m?.url).length + 1 : 1, bg?.slide?.sec ?? 5);  // (a hook: before the early return)
  if (!bg?.url) return null;
  const hv = bg.hover?.mode ? bg.hover : null; // mouse-over: the block gets more transparent, or another picture / video shows
  const more = (bg.more || []).filter((m) => m?.url), sl = bg.slide || {}, show = more.length > 0;  // more pictures and videos take turns
  const media = (m, k) => { const cls = `sec-bg-slide${slide.i === k ? " on" : slide.prev === k ? " out" : ""}`; return m.type === "video" ? <video key={k} className={cls} src={mediaUrl(m.url)} autoPlay muted loop playsInline /> : /* eslint-disable-next-line @next/next/no-img-element */ <img key={k} className={cls} src={mediaUrl(m.url)} alt="" />; };
  return (
    <span className={`sec-bg${hv ? ` hv-${hv.mode}` : ""}${show ? ` has-slides fx-${sl.fx || "fade"}` : ""}`} style={{ ...(show ? { "--sl-ms": `${sl.ms ?? 800}ms`, "--sl-sec": sl.sec ?? 5 } : {}), ...(hv?.mode === "opacity" ? { "--hov-o": (hv.opacity ?? 60) / 100 } : {}), ...(bg.pos && bg.pos !== "center" ? { "--bg-pos": `center ${bg.pos}` } : {}), ...(bg.zoom && bg.zoom !== 100 ? { "--bg-zoom": bg.zoom / 100 } : {}) }} aria-hidden="true">
      {show ? [bg, ...more].map(media) : bg.type === "video" ? <video src={mediaUrl(bg.url)} autoPlay muted loop playsInline /> : /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(bg.url)} alt="" />}
      {hv?.mode === "swap" && hv.url && (hv.type === "video" ? <video className="sec-bg-over" src={mediaUrl(hv.url)} autoPlay muted loop playsInline /> : /* eslint-disable-next-line @next/next/no-img-element */ <img className="sec-bg-over" src={mediaUrl(hv.url)} alt="" />)}
      <span className="sec-bg-shade" style={{ opacity: bg.overlay ?? 0.35 }} />
    </span>
  );
}

// The edit-mode controls (the address of the picked file goes with the change, so it shows at once): choose a picture or video, the darkness over it, or remove it. onChange({type, media, overlay}) or onChange({}).
export function BgControls({ bg, onChange }) {
  const [pick, setPick] = useState(null); // "image" | "video"
  const [tab, setTab] = useState("bg");
  const has = !!bg?.media;
  const hv = bg?.hover || {};
  const base = { type: bg?.type, media: bg?.media, url: bg?.url, overlay: bg?.overlay, pos: bg?.pos, zoom: bg?.zoom, more: bg?.more, slide: bg?.slide };
  const more = bg?.more || [], sl = { sec: 5, fx: "fade", ms: 800, ...(bg?.slide || {}) };
  const setMore = (list, slide) => onChange({ ...base, hover: bg?.hover, more: list, slide: slide || bg?.slide });
  const move = (k, d) => { const all = [{ type: bg.type, media: bg.media, url: bg.url }, ...more], j = k + d; if (j < 0 || j >= all.length) return; [all[k], all[j]] = [all[j], all[k]]; onChange({ ...base, hover: bg?.hover, ...all[0], more: all.slice(1) }); };  // (the first one is the background itself: they swap places)
  const drop = (k) => { const all = [{ type: bg.type, media: bg.media, url: bg.url }, ...more]; all.splice(k, 1); if (!all.length) return onChange({}); onChange({ ...base, hover: bg?.hover, ...all[0], more: all.slice(1) }); };
  const setHv = (patch) => onChange({ ...base, hover: patch === null ? undefined : { ...hv, ...patch } });
  return (
    <span className="sec-bg-controls">
      <strong>{tx("Achtergrond")}</strong>
      {has && <span className="pb-seg">{[["bg", "Weergave"], ["slides", "Rouleren"], ["hover", "Mouse-over"]].map(([k, l]) => <button type="button" key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{tx(l)}</button>)}</span>}
      {has && tab === "hover" && (
        <span className="sec-bg-hover">
          <span className="pb-seg">{[["", "Geen"], ["opacity", "Doorzichtigheid"], ["swap", "Andere afbeelding of video"]].map(([k, l]) => <button type="button" key={k} className={(hv.mode || "") === k ? "on" : ""} onClick={() => setHv(k ? { mode: k } : null)}>{tx(l)}</button>)}</span>
          {hv.mode === "opacity" && <label className="sec-bg-dark">{tx("Doorzichtigheid")}
            <input type="range" min={0} max={100} step={5} value={hv.opacity ?? 60} onChange={(e) => setHv({ opacity: Number(e.target.value) })} aria-label={tx("Doorzichtigheid")} /><small className="muted">{hv.opacity ?? 60}%</small></label>}
          {hv.mode === "swap" && <>
            {hv.url && (hv.type === "video" ? <video src={mediaUrl(hv.url)} muted style={{ height: 40 }} /> : /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(hv.url)} alt="" style={{ height: 40 }} />)}
            <button type="button" className="btn sm" onClick={() => setPick("hover-image")}>{tx("Afbeelding kiezen")}</button>
            <button type="button" className="btn sm" onClick={() => setPick("hover-video")}>{tx("Video kiezen")}</button></>}
        </span>
      )}
      {has && tab === "slides" && (
        <span className="sec-bg-slides">
          <small className="muted">{tx("Kies meer afbeeldingen of video's: ze wisselen elkaar af achter dit blok.")}</small>
          <span className="sec-bg-list">
            {[{ type: bg.type, url: bg.url }, ...more].map((m, k, all) => (
              <span key={`${m.url}-${k}`} className="sec-bg-item">
                {m.type === "video" ? <video src={mediaUrl(m.url)} muted /> : /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(m.url)} alt="" />}
                <b>{k + 1}</b>
                <button type="button" className="btn sm" disabled={k === 0} onClick={() => move(k, -1)} aria-label={tx("Naar voren")}>↑</button>
                <button type="button" className="btn sm" disabled={k === all.length - 1} onClick={() => move(k, 1)} aria-label={tx("Naar achteren")}>↓</button>
                <button type="button" className="btn sm danger" onClick={() => drop(k)} aria-label={tx("Verwijder")}>×</button>
              </span>
            ))}
          </span>
          <button type="button" className="btn sm" disabled={more.length >= 11} onClick={() => setPick("slide")}>{tx("Afbeelding of video toevoegen")}</button>
          {more.length > 0 && <>
            <label className="sec-bg-dark">{tx("Tijd per beeld")}
              <input type="range" min={2} max={30} step={1} value={sl.sec} onChange={(e) => setMore(more, { ...sl, sec: Number(e.target.value) })} aria-label={tx("Tijd per beeld")} /><small className="muted">{sl.sec} {tx("sec")}</small></label>
            <span className="sec-bg-pos">{tx("Animatie")}
              <span className="pb-seg">{[["fade", "Vervagen"], ["slide", "Schuiven"], ["zoom", "Inzoomen"], ["none", "Geen"]].map(([k, l]) => <button type="button" key={k} className={sl.fx === k ? "on" : ""} aria-pressed={sl.fx === k} onClick={() => setMore(more, { ...sl, fx: k })}>{tx(l)}</button>)}</span>
            </span>
            {sl.fx !== "none" && <label className="sec-bg-dark">{tx("Snelheid van de animatie")}
              <input type="range" min={200} max={3000} step={100} value={sl.ms} onChange={(e) => setMore(more, { ...sl, ms: Number(e.target.value) })} aria-label={tx("Snelheid van de animatie")} /><small className="muted">{(sl.ms / 1000).toFixed(1)} {tx("sec")}</small></label>}
          </>}
        </span>
      )}
      {(!has || tab === "bg") && <>
      <button type="button" className="btn sm" onClick={() => setPick("image")}>{tx("Afbeelding")}</button>
      <button type="button" className="btn sm" onClick={() => setPick("video")}>{tx("Video")}</button></>}
      {has && tab === "bg" && (
        <>
          <label className="sec-bg-dark">{tx("Donkerte")}
            <input type="range" min={0} max={90} step={5} value={Math.round((bg.overlay ?? 0.35) * 100)} onChange={(e) => onChange({ ...base, hover: bg.hover, overlay: Number(e.target.value) / 100 })} aria-label={tx("Donkerte")} />
            <small className="muted">{Math.round((bg.overlay ?? 0.35) * 100)}%</small>
          </label>
          <label className="sec-bg-dark">{tx("Grootte")}
            <input type="range" min={30} max={250} step={5} value={bg.zoom ?? 100} onChange={(e) => onChange({ ...base, hover: bg.hover, zoom: Number(e.target.value) })} aria-label={tx("Grootte van de achtergrond")} />
            <small className="muted">{bg.zoom ?? 100}%</small>
            {(bg.zoom ?? 100) !== 100 && <button type="button" className="btn sm" onClick={() => onChange({ ...base, hover: bg.hover, zoom: 100 })}>{tx("Herstel")}</button>}
          </label>
          <span className="sec-bg-pos">{tx("Uitlijnen")}
            <span className="pb-seg">{[["top", "Boven"], ["center", "Midden"], ["bottom", "Onder"]].map(([k, l]) => <button type="button" key={k} className={(bg.pos || "center") === k ? "on" : ""} aria-pressed={(bg.pos || "center") === k} onClick={() => onChange({ ...base, hover: bg.hover, pos: k })}>{tx(l)}</button>)}</span>
          </span>
          <button type="button" className="btn sm danger" onClick={() => onChange({})}>{tx("Verwijder")}</button>
        </>
      )}
      {pick && <MediaPicker kind={pick === "slide" ? "all" : pick.replace("hover-", "")} onClose={() => setPick(null)} onPick={(item) => {
        if (pick === "slide") { const cur = bg?.more || []; if (cur.length < 11 && !cur.some((x) => x.media === item.id) && item.id !== bg?.media) setMore([...cur, { type: item.kind === "video" ? "video" : "image", media: item.id, url: item.url }], bg?.slide); return; }  // the picker stays open: pick as many as you want, then close it
        if (pick.startsWith("hover-")) setHv({ type: pick.slice(6), media: item.id, url: item.url });
        else onChange({ type: pick, media: item.id, url: item.url, overlay: bg?.overlay ?? 0.35, hover: bg?.hover, pos: bg?.pos, zoom: bg?.zoom, more: bg?.more, slide: bg?.slide });
        setPick(null);
      }} />}
    </span>
  );
}
