"use client";

import { useRef, useState } from "react";

// Photo uploader: click to select or drop image files on it. onFiles(files) does the upload; it may return an error text.
export default function PhotoDrop({ onFiles, multiple = false, label = "Sleep een foto hierheen of klik om te kiezen", busyLabel = "Uploaden…", preview = null, vertical = false, accept = "image/*" }) {
  const input = useRef(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function take(list) {
    const files = [...list].filter((f) => f.type.startsWith("image/"));
    if (!files.length) return setError("Kies een afbeelding (JPG, PNG, WebP).");
    setError(""); setBusy(true);
    try { const err = await onFiles(multiple ? files : files.slice(0, 1)); if (err) setError(err); }
    catch (e) { setError(e.message || "Uploaden mislukt."); }
    setBusy(false);
  }

  return (
    <div>
      <div className={`dropzone ${vertical ? "vertical" : ""} ${over ? "over" : ""}`} role="button" tabIndex={0}
        onClick={() => input.current.click()} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); }}>
        {preview}
        <span>{busy ? busyLabel : label}</span>
        <input ref={input} type="file" accept={accept} multiple={multiple} hidden onChange={(e) => { const f = e.target.files; if (f?.length) take(f); e.target.value = ""; }} />
      </div>
      {error && <small style={{ color: "var(--danger, #d92d20)" }}>{error}</small>}
    </div>
  );
}
