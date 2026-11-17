// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { dragProps } from "../lib/panel-drag";
import { useEffect, useState } from "react";
import { api, errorText, mediaUrl } from "../lib/api";
import { tx } from "../lib/t";

import Loading from "./Loading";
// The media library inside the editor panel: search, filter on a tag and click a picture to put it on the page.
export default function MediaLibraryPanel({ onPick }) {
  const [items, setItems] = useState(null);
  const [tags, setTags] = useState([]);
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      api(`/media/?kind=image${q ? `&q=${encodeURIComponent(q)}` : ""}${tag ? `&tag=${encodeURIComponent(tag)}` : ""}`).then((d) => { setItems(d.items || []); setTags(d.tags || []); setErr(""); }).catch((e) => setErr(errorText(e)));
    }, 200);
    return () => clearTimeout(t);
  }, [q, tag]);
  return (
    <div className="pb-medialib">
      <input type="search" placeholder={tx("Zoek in de media bibliotheek…")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={tx("Zoek in de media bibliotheek…")} />
      {tags.length > 0 && (
        <select value={tag} onChange={(e) => setTag(e.target.value)} aria-label={tx("Tag")}>
          <option value="">{tx("Alle tags")}</option>
          {tags.map((t) => <option key={t.tag} value={t.tag}>{t.tag} ({t.n})</option>)}
        </select>
      )}
      {err && <div className="alert">{err}</div>}
      {items === null && !err && <small className="muted"><Loading compact /></small>}
      {items && !items.length && <small className="muted">{tx("Geen afbeeldingen gevonden.")}</small>}
      <div className="pb-medialib-grid">
        {(items || []).map((i) => (
          <button type="button" key={i.id} onClick={() => onPick(i)} title={i.name} aria-label={`${tx("Gebruik")} ${i.name}`} {...dragProps({ kind: "media", media: i })}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaUrl(i.url)} alt={i.name} loading="lazy" />
            <small>{i.name}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
