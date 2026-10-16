"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorText, mediaUrl } from "../lib/api";
import { useAuth } from "./AuthContext";
import { useModule } from "./Modules";
import PhotoDrop from "./PhotoDrop";
import { visibilityHint, visibilityOptions } from "../lib/photo-visibility";

// Own profile-page photos: add (select or drop), blur for others, reorder and delete. Used next to the account data.
export default function MyPhotos() {
  const on = useModule("profiles");
  const { setUser } = useAuth();
  const [p, setP] = useState(null);
  const [vis, setVis] = useState("public");
  const [error, setError] = useState("");
  const load = useCallback(() => api("/profile/me/").then(setP).catch(() => setP(false)), []);
  useEffect(() => { if (on) load(); }, [on, load]);
  if (!on || !p) return null;

  const run = (fn) => fn().then(setP).catch((e) => setError(errorText(e)));
  const upload = async (files) => {
    const room = p.max_photos - p.photos.length;
    for (const f of files.slice(0, Math.max(room, 0))) {
      const fd = new FormData();
      fd.append("image", f);
      fd.append("visibility", vis);
      try { setP(await api("/profile/me/photos/", { method: "POST", body: fd })); } catch (e) { return `${f.name}: ${errorText(e)}`; }
    }
    if (files.length > room) return `Maximaal ${p.max_photos} foto's: ${files.length - room} niet toegevoegd.`;
  };
  const del = (ph) => confirm("Deze foto verwijderen?") && run(() => api(`/profile/me/photos/${ph.id}/`, { method: "DELETE" }));
  const setVisibility = (ph, visibility) => run(() => api(`/profile/me/photos/${ph.id}/edit/`, { method: "PATCH", body: { visibility } }));
  const makeAvatar = async (ph) => {
    setError("");
    try { setP(await api(`/profile/me/photos/${ph.id}/avatar/`, { method: "POST" })); setUser(await api("/auth/me/")); }
    catch (e) { setError(errorText(e)); }
  };

  return (
    <section className="my-photos">
      <strong style={{ fontSize: ".85rem" }}>Mijn foto&apos;s <span className="muted">({p.photos.length}/{p.max_photos})</span></strong>
      {error && <small style={{ color: "var(--danger, #d92d20)" }}>{error}</small>}
      <div className="thumb-grid">
        {p.photos.map((ph, i) => (
          <div key={ph.id} className="thumb-card">
            <div className="thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(ph.url)} alt="" />
              {i === 0 && <span className="badge ok thumb-main">Profielfoto</span>}
              {ph.visibility !== "public" && <span className="thumb-lock" title={visibilityHint(ph.visibility)}>{ph.visibility === "private" ? "🔒" : ph.visibility === "hidden" ? "🚫" : "👥"}</span>}
              <button type="button" className="thumb-del" title="Verwijderen" onClick={() => del(ph)}>✕</button>
            </div>
            <select className="thumb-vis" value={ph.visibility} title={visibilityHint(ph.visibility)} onChange={(e) => setVisibility(ph, e.target.value)}>
              {visibilityOptions(p.private_photos || ph.visibility === "private").map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button type="button" className="btn sm" disabled={i === 0} onClick={() => makeAvatar(ph)}>{i === 0 ? "✓ Profielfoto" : "Maak profielfoto"}</button>
          </div>
        ))}
      </div>
      {p.photos.length < p.max_photos && (
        <>
          <PhotoDrop multiple vertical onFiles={upload} label="Sleep foto's hierheen of klik" />
          <label style={{ fontWeight: 500, fontSize: ".85rem" }}>Nieuwe foto&apos;s zichtbaar voor
            <select value={vis} onChange={(e) => setVis(e.target.value)}>{visibilityOptions(p.private_photos).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
        </>
      )}
    </section>
  );
}
