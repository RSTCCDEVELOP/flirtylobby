"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorText, mediaUrl } from "../lib/api";

// Modal to choose an image from the media library, or upload a new one
export default function MediaPicker({ onPick, onClose, title = "Kies een afbeelding" }) {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef(null);

  const load = useCallback(() => {
    api(`/media/?kind=image${q ? `&q=${encodeURIComponent(q)}` : ""}`).then((d) => setItems(d.items)).catch((e) => setError(errorText(e)));
  }, [q]);
  useEffect(() => { load(); }, [load]);

  async function upload(e) {
    const files = [...e.target.files];
    e.target.value = "";
    if (!files.length) return;
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
      <div className="card modal picker" onClick={(e) => e.stopPropagation()}>
        <div className="page-head" style={{ marginBottom: ".5rem" }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <div className="row">
            <input ref={input} type="file" accept="image/*" multiple hidden onChange={upload} />
            <button className="btn primary" onClick={() => input.current.click()} disabled={busy}>{busy ? "Uploaden…" : "Nieuwe uploaden"}</button>
            <button className="btn" onClick={onClose}>Sluiten</button>
          </div>
        </div>
        <input placeholder="Zoek op naam…" value={q} onChange={(e) => setQ(e.target.value)} />
        {error && <div className="alert">{error}</div>}
        <div className="media-grid">
          {items.map((i) => (
            <button key={i.id} className="media-tile" onClick={() => onPick(i)} title={i.name}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(i.url)} alt={i.name} loading="lazy" />
              <span>{i.name}</span>
            </button>
          ))}
          {!items.length && <p className="muted">Geen afbeeldingen gevonden.</p>}
        </div>
      </div>
    </div>
  );
}
