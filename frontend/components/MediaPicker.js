"use client";

import { tx } from "../lib/t";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorText, mediaUrl } from "../lib/api";

// Modal to choose an image from the media library, or upload a new one
export default function MediaPicker({ onPick, onClose, onFiles = null, library = true, kind = "image", title = kind === "video" ? tx("Kies een video") : tx("Kies een afbeelding") }) {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  const [over, setOver] = useState(false);

  const load = useCallback(() => {
    api(`/media/?kind=${kind}${q ? `&q=${encodeURIComponent(q)}` : ""}`).then((d) => setItems(d.items)).catch((e) => setError(errorText(e)));
  }, [q, kind]);
  useEffect(() => { if (library) load(); }, [load, library]);

  async function upload(e, dropped) {
    const files = dropped || [...e.target.files];
    if (e) e.target.value = "";
    if (!files.length) return;
    if (onFiles) return onFiles(files); // the screen takes the files itself (no stop in the library)
    setBusy(true);
    setError("");
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    try {
      const r = await api("/media/upload/", { method: "POST", body: fd });
      if (r.errors?.length) setError(r.errors.join(" "));
      if (r.items.length === 1 && !r.errors?.length) return onPick(r.items[0]); // single upload: use it right away
      load();
    } catch (err) { setError(errorText(err)); }
    setBusy(false);
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className={`card modal picker ${over ? "drop-over" : ""}`} onClick={(e) => e.stopPropagation()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false); }}
        onDrop={(e) => { e.preventDefault(); setOver(false); upload(null, [...e.dataTransfer.files].filter((f) => f.type.startsWith(kind === "video" ? "video/" : "image/") || /\.ico$/i.test(f.name))); }}>
        <div className="page-head" style={{ marginBottom: ".5rem" }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <div className="row">
            <input ref={input} type="file" accept={kind === "video" ? "video/*" : "image/*"} multiple hidden onChange={upload} />
            <button className="btn primary" onClick={() => input.current.click()} disabled={busy}>{busy ? tx("Uploaden…") : tx("Uploaden")}</button>
            <button className="btn" onClick={onClose}>{tx("Sluiten")}</button>
          </div>
        </div>
        <div className="dropzone" role="button" tabIndex={0} onClick={() => input.current.click()} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current.click()}>
          <span>{kind === "video" ? tx("Sleep een video hierheen of klik om te uploaden") : tx("Sleep een bestand hierheen of klik om te uploaden")}</span>
        </div>
        {library && <input placeholder={tx("Of kies uit de bibliotheek: zoek op naam…")} value={q} onChange={(e) => setQ(e.target.value)} />}
        {error && <div className="alert">{error}</div>}
        {library && <div className="media-grid">
          {items.map((i) => (
            <button key={i.id} className="media-tile" onClick={() => onPick(i)} title={i.name}>
              {kind === "video"
                ? <video src={mediaUrl(i.url)} muted preload="metadata" />
                : /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(i.url)} alt={i.name} loading="lazy" />}
              <span>{i.name}</span>
            </button>
          ))}
          {!items.length && <p className="muted">{kind === "video" ? tx("Geen video's gevonden.") : tx("Geen afbeeldingen gevonden.")}</p>}
        </div>}
      </div>
    </div>
  );
}
