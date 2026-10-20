"use client";

import { useState } from "react";
import { mediaUrl } from "../lib/api";
import { tx } from "../lib/t";
import MediaPicker from "./MediaPicker";

// A background (picture or video from the media library) behind a block or a hero. bg: {type, media, overlay, url} or empty.
export function BgLayer({ bg }) {
  if (!bg?.url) return null;
  return (
    <span className="sec-bg" aria-hidden="true">
      {bg.type === "video" ? <video src={mediaUrl(bg.url)} autoPlay muted loop playsInline /> : /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(bg.url)} alt="" />}
      <span className="sec-bg-shade" style={{ opacity: bg.overlay ?? 0.35 }} />
    </span>
  );
}

// The edit-mode controls: choose a picture or video, the darkness over it, or remove it. onChange({type, media, overlay}) or onChange({}).
export function BgControls({ bg, onChange }) {
  const [pick, setPick] = useState(null); // "image" | "video"
  const has = !!bg?.media;
  return (
    <span className="sec-bg-controls">
      <strong>{tx("Achtergrond")}</strong>
      <button type="button" className="btn sm" onClick={() => setPick("image")}>{tx("Afbeelding")}</button>
      <button type="button" className="btn sm" onClick={() => setPick("video")}>{tx("Video")}</button>
      {has && (
        <>
          <label>{tx("Donkerte")}<select value={String(bg.overlay ?? 0.35)} onChange={(e) => onChange({ type: bg.type, media: bg.media, overlay: Number(e.target.value) })}>{[0, 0.15, 0.35, 0.5, 0.65, 0.8].map((v) => <option key={v} value={v}>{Math.round(v * 100)}%</option>)}</select></label>
          <button type="button" className="btn sm danger" onClick={() => onChange({})}>{tx("Verwijder")}</button>
        </>
      )}
      {pick && <MediaPicker kind={pick} onClose={() => setPick(null)} onPick={(item) => { onChange({ type: pick, media: item.id, overlay: bg?.overlay ?? 0.35 }); setPick(null); }} />}
    </span>
  );
}
