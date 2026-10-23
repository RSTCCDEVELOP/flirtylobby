// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useState } from "react";
import { mediaUrl } from "../lib/api";
import { tx } from "../lib/t";
import MediaPicker from "./MediaPicker";

// A background (picture or video from the media library) behind a block or a hero. bg: {type, media, overlay, url} or empty.
export function BgLayer({ bg }) {
  if (!bg?.url) return null;
  const hv = bg.hover?.mode ? bg.hover : null; // mouse-over: the block gets more transparent, or another picture / video shows
  return (
    <span className={`sec-bg${hv ? ` hv-${hv.mode}` : ""}`} style={hv?.mode === "opacity" ? { "--hov-o": (hv.opacity ?? 60) / 100 } : undefined} aria-hidden="true">
      {bg.type === "video" ? <video src={mediaUrl(bg.url)} autoPlay muted loop playsInline /> : /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(bg.url)} alt="" />}
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
  const base = { type: bg?.type, media: bg?.media, url: bg?.url, overlay: bg?.overlay };
  const setHv = (patch) => onChange({ ...base, hover: patch === null ? undefined : { ...hv, ...patch } });
  return (
    <span className="sec-bg-controls">
      <strong>{tx("Achtergrond")}</strong>
      {has && <span className="pb-seg">{[["bg", "Weergave"], ["hover", "Mouse-over"]].map(([k, l]) => <button type="button" key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{tx(l)}</button>)}</span>}
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
      {(!has || tab === "bg") && <>
      <button type="button" className="btn sm" onClick={() => setPick("image")}>{tx("Afbeelding")}</button>
      <button type="button" className="btn sm" onClick={() => setPick("video")}>{tx("Video")}</button></>}
      {has && tab === "bg" && (
        <>
          <label className="sec-bg-dark">{tx("Donkerte")}
            <input type="range" min={0} max={90} step={5} value={Math.round((bg.overlay ?? 0.35) * 100)} onChange={(e) => onChange({ ...base, hover: bg.hover, overlay: Number(e.target.value) / 100 })} aria-label={tx("Donkerte")} />
            <small className="muted">{Math.round((bg.overlay ?? 0.35) * 100)}%</small>
          </label>
          <button type="button" className="btn sm danger" onClick={() => onChange({})}>{tx("Verwijder")}</button>
        </>
      )}
      {pick && <MediaPicker kind={pick.replace("hover-", "")} onClose={() => setPick(null)} onPick={(item) => {
        if (pick.startsWith("hover-")) setHv({ type: pick.slice(6), media: item.id, url: item.url });
        else onChange({ type: pick, media: item.id, url: item.url, overlay: bg?.overlay ?? 0.35, hover: bg?.hover });
        setPick(null);
      }} />}
    </span>
  );
}
