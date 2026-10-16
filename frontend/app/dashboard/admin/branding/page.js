"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import Collapsible, { CollapseAll } from "../../../../components/Collapsible";
import { lvl } from "../../../../lib/perms";
import { api, errorText, mediaUrl } from "../../../../lib/api";

function AssetCard({ slot, info, url, onChange, onError, L }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);

  async function upload(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("image", file);
    try { await api(`/branding/assets/${slot}/`, { method: "PUT", body: fd }); await onChange(); } catch (err) { onError(errorText(err)); }
    setBusy(false);
  }

  async function remove() {
    if (!confirm(`${info.label} verwijderen?`)) return;
    try { await api(`/branding/assets/${slot}/`, { method: "DELETE" }); await onChange(); } catch (err) { onError(errorText(err)); }
  }

  return (
    <div className="asset">
      <div className={`asset-preview ${slot === "logo_dark" ? "on-dark" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url ? <img src={mediaUrl(url)} alt={info.label} /> : <span className="muted">Geen afbeelding</span>}
      </div>
      <strong>{info.label}</strong>
      <small className="muted">{info.hint}</small>
      <div className="row" style={{ justifyContent: "flex-start" }}>
        <input ref={input} type="file" accept="image/*" hidden onChange={upload} />
        {L >= 2 && <button className="btn sm" onClick={() => input.current.click()} disabled={busy}>{busy ? "Uploaden…" : url ? "Vervangen" : "Uploaden"}</button>}
        {url && L >= 3 && <button className="btn sm danger" onClick={remove}>Verwijder</button>}
      </div>
    </div>
  );
}

export default function Branding() {
  const router = useRouter();
  const { user } = useAuth();
  const L = lvl(user, "branding");
  const [data, setData] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const photoInput = useRef(null);

  const load = useCallback(async () => {
    try {
      const [b, p] = await Promise.all([api("/branding/"), api("/admin/home-photos/")]);
      setData(b);
      setPhotos(p);
      router.refresh(); // header logos + favicon come from the server layout
    } catch (e) { setError(errorText(e)); }
  }, [router]);
  useEffect(() => { load(); }, [load]);

  async function addPhotos(e) {
    const files = [...e.target.files];
    e.target.value = "";
    setUploading(true);
    setError("");
    for (const file of files) {
      const fd = new FormData();
      fd.append("image", file);
      try { await api("/admin/home-photos/", { method: "POST", body: fd }); } catch (err) { setError(`${file.name}: ${errorText(err)}`); }
    }
    setUploading(false);
    load();
  }

  const act = async (fn) => { try { await fn(); await load(); } catch (err) { setError(errorText(err)); } };
  const removePhoto = (p) => confirm("Foto verwijderen?") && act(() => api(`/admin/home-photos/${p.id}/`, { method: "DELETE" }));
  const caption = (p, value) => value !== p.caption && act(() => api(`/admin/home-photos/${p.id}/`, { method: "PATCH", body: { caption: value } }));
  function move(i, dir) {
    const a = photos[i], b = photos[i + dir];
    if (!b) return;
    act(async () => {
      await api(`/admin/home-photos/${a.id}/`, { method: "PATCH", body: { order: b.order } });
      await api(`/admin/home-photos/${b.id}/`, { method: "PATCH", body: { order: a.order } });
    });
  }

  if (!data) return <p className="muted">Laden…</p>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Logo's & afbeeldingen</h1>
          <p className="muted" style={{ margin: 0 }}>Logo, favicon en foto's voor de website. Zonder upload geldt het standaardlogo.</p>
        </div>
        <CollapseAll />
      </div>
      {error && <div className="alert" style={{ marginBottom: "1rem" }}>{error}</div>}

      <Collapsible id="brand-assets" title="Logo's en iconen">
        <div className="asset-grid">
          {Object.entries(data.slots).map(([slot, info]) => (
            <AssetCard key={slot} slot={slot} info={info} url={data.assets[slot]} onChange={load} onError={setError} L={L} />
          ))}
        </div>
      </Collapsible>

      <Collapsible id="brand-photos" title="Foto's voor de onderhoudspagina (homepage)">
        <p className="muted" style={{ marginTop: 0 }}>Optioneel. Deze foto's verschijnen onder de tekst op de homepage zolang de site in aanbouw is. Maximaal 12 foto's van 5 MB.</p>
        <div className="photo-admin">
          {photos.map((p, i) => (
            <div className="photo-item" key={p.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(p.url)} alt="" />
              <input defaultValue={p.caption} placeholder="Bijschrift (optioneel)" maxLength={255} onBlur={(e) => caption(p, e.target.value)} />
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span>
                  <button className="btn sm" onClick={() => move(i, -1)} disabled={L < 2 || i === 0} aria-label="Eerder">←</button>{" "}
                  <button className="btn sm" onClick={() => move(i, 1)} disabled={L < 2 || i === photos.length - 1} aria-label="Later">→</button>
                </span>
                {L >= 3 && <button className="btn sm danger" onClick={() => removePhoto(p)}>Verwijder</button>}
              </div>
            </div>
          ))}
        </div>
        <input ref={photoInput} type="file" accept="image/*" multiple hidden onChange={addPhotos} />
        {L >= 3 && <button className="btn primary" style={{ marginTop: "1rem" }} onClick={() => photoInput.current.click()} disabled={uploading}>
          {uploading ? "Uploaden…" : "+ Foto's toevoegen"}
        </button>}
      </Collapsible>
    </>
  );
}
