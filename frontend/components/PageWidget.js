// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../lib/api";
import { tx } from "../lib/t";
import { anchorStyle } from "../lib/anchor";
import { Logo } from "./BrandingContext";
import DesignFrame from "./DesignFrame";
import CodeEditor from "./CodeEditor";

// Ready-made parts for a page: contact data, social media, map, video, quote, figures, logo and opening hours.
// The data of the website itself (address, phone, social media) comes from Admin → Systeem → Basisgegevens.
export const WIDGET_NAMES = { contact: "Contactgegevens", social: "Sociale media", map: "Kaart", video: "Video", quote: "Citaat", stats: "Cijfers", logo: "Logo", hours: "Openingstijden", code: "HTML / CSS-code" };
export const WIDGET_DEFAULTS = {
  contact: { address: true, phone: true, email: true }, social: {}, map: { query: "", height: 320 }, video: { url: "" },
  quote: { text: "Een mooi citaat van een klant of van jezelf.", author: "Naam" },
  stats: { items: [{ value: "10+", label: "jaar ervaring" }, { value: "500", label: "klanten" }, { value: "24/7", label: "bereikbaar" }] },
  code: { html: "", css: "" }, logo: { width: 160 }, hours: { lines: [{ day: "Maandag - vrijdag", time: "09:00 - 17:30" }, { day: "Zaterdag", time: "10:00 - 16:00" }, { day: "Zondag", time: "Gesloten" }] },
};
const SOCIAL = { facebook: "Facebook", instagram: "Instagram", x: "X", linkedin: "LinkedIn", youtube: "YouTube", tiktok: "TikTok" };

function embedOf(url) { // a YouTube or Vimeo address as an address that can be shown in a frame
  try {
    const u = new URL(url);
    if (/youtu\.be$/.test(u.hostname)) return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
    if (/youtube(-nocookie)?\.com$/.test(u.hostname.replace(/^www\.|^m\./, ""))) return u.pathname.startsWith("/embed/") ? url : `https://www.youtube-nocookie.com/embed/${u.searchParams.get("v") || ""}`;
    if (/vimeo\.com$/.test(u.hostname)) return u.hostname.startsWith("player.") ? url : `https://player.vimeo.com/video/${u.pathname.split("/").filter(Boolean).pop()}`;
  } catch {}
  return "";
}

export function PbWidget({ it, editing }) {
  const w = it.widget, d = it.data || {};
  const [site, setSite] = useState(null);
  useEffect(() => { if (["contact", "social", "map"].includes(w)) api("/site/").then(setSite).catch(() => {}); }, [w]);
  const [font, setFont] = useState("sans-serif");
  useEffect(() => { if (w === "code") setFont(getComputedStyle(document.body).fontFamily.replace(/"/g, "'")); }, [w]); // the frame has its own page: it gets the font of this website
  const empty = (text) => <div className="pb-widget-empty">{editing ? text : null}</div>;
  if (w === "contact") {
    if (!site) return null;
    const street = [site.street, site.house_number].filter(Boolean).join(" "), place = [site.postal_code, site.city].filter(Boolean).join(" ");
    const has = (d.address !== false && (street || place)) || (d.phone !== false && site.phone) || (d.email !== false && site.contact_email);
    if (!has) return empty(tx("Vul de contactgegevens in bij Admin → Systeem → Basisgegevens."));
    return (
      <address className="pb-w pb-w-contact">
        {site.company_name && <strong>{site.company_name}</strong>}
        {d.address !== false && street && <span>{street}</span>}
        {d.address !== false && place && <span>{place}</span>}
        {d.phone !== false && site.phone && <a href={`tel:${site.phone.replace(/\s/g, "")}`}>{site.phone}</a>}
        {d.email !== false && site.contact_email && <a href={`mailto:${site.contact_email}`}>{site.contact_email}</a>}
      </address>
    );
  }
  if (w === "social") {
    const list = Object.entries(site?.social || {});
    if (!list.length) return site ? empty(tx("Vul de sociale media in bij Admin → Systeem → Basisgegevens.")) : null;
    return <div className="pb-w pb-w-social">{list.map(([k, url]) => <a key={k} className="btn sm" href={url} target="_blank" rel="noopener noreferrer">{SOCIAL[k] || k}</a>)}</div>;
  }
  if (w === "map") {
    const q = d.query || (site ? [site.street, site.house_number, site.postal_code, site.city].filter(Boolean).join(" ") : "");
    if (!q) return site ? empty(tx("Geen adres: vul het in bij Basisgegevens of in de instellingen van de kaart.")) : null;
    return <iframe className="pb-w pb-w-map" title={tx("Kaart")} loading="lazy" referrerPolicy="no-referrer-when-downgrade" style={{ height: d.height || 320 }} src={`https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`} />;
  }
  if (w === "video") {
    const src = embedOf(d.url || "");
    return src ? <div className="pb-w pb-w-video"><iframe title={tx("Video")} loading="lazy" src={src} allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen /></div> : empty(tx("Geef een YouTube- of Vimeo-link op."));
  }
  if (w === "quote") return <figure className="pb-w pb-w-quote"><blockquote>{d.text}</blockquote>{d.author && <figcaption>{d.author}</figcaption>}</figure>;
  if (w === "stats") return <div className="pb-w pb-w-stats">{(d.items || []).map((s, i) => <div key={i}><strong>{s.value}</strong><span>{s.label}</span></div>)}</div>;
  if (w === "logo") return <div className="pb-w pb-w-logo" style={{ "--wl-w": `${d.width || 160}px` }}><Logo /></div>;
  if (w === "code") return d.html || d.css ? <div className="pb-w pb-w-code"><DesignFrame title={tx("HTML / CSS-code")} html={`<!doctype html><meta charset="utf-8"><base target="_top"><style>body{margin:0;font-family:${font};line-height:1.5}${d.css || ""}</style>${d.html || ""}`} /></div> : empty(tx("Vul de HTML of CSS in bij de instellingen van dit blok."));
  if (w === "hours") return <dl className="pb-w pb-w-hours">{(d.lines || []).map((l, i) => <div key={i}><dt>{l.day}</dt><dd>{l.time}</dd></div>)}</dl>;
  return null;
}

// The settings of a ready-made part (edit mode). data = what the item holds; onChange(data) after every change.
export function WidgetPopup({ widget, data = {}, onChange, onClose, anchor }) {
  if (widget === "code") return <CodeEditor data={data} onChange={onChange} onClose={onClose} />;
  const set = (patch) => onChange({ ...data, ...patch });
  const rows = widget === "stats" ? data.items || [] : data.lines || [];
  const setRow = (i, patch) => set(widget === "stats" ? { items: rows.map((r, n) => (n === i ? { ...r, ...patch } : r)) } : { lines: rows.map((r, n) => (n === i ? { ...r, ...patch } : r)) });
  const addRow = () => set(widget === "stats" ? { items: [...rows, { value: "", label: "" }] } : { lines: [...rows, { day: "", time: "" }] });
  const delRow = (i) => set(widget === "stats" ? { items: rows.filter((_, n) => n !== i) } : { lines: rows.filter((_, n) => n !== i) });
  const body = (
    <div className={anchor ? "pb-anchorback" : "overlay"} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card modal form" role="dialog" aria-label={tx(WIDGET_NAMES[widget] || "")} style={{ maxWidth: 560, ...anchorStyle(anchor, 560) }} onMouseDown={(e) => e.stopPropagation()}>
        <h2>{tx(WIDGET_NAMES[widget] || "")}</h2>
        {widget === "contact" && ["address", "phone", "email"].map((k) => (
          <label key={k} className="check"><span className="switch"><input type="checkbox" checked={data[k] !== false} onChange={(e) => set({ [k]: e.target.checked })} /><span /></span><span>{tx({ address: "Adres tonen", phone: "Telefoon tonen", email: "E-mailadres tonen" }[k])}</span></label>
        ))}
        {(widget === "contact" || widget === "social") && <p className="muted">{tx("De gegevens komen uit Admin → Systeem → Basisgegevens.")}</p>}
        {widget === "map" && (<>
          <label>{tx("Adres op de kaart")}<input value={data.query || ""} placeholder={tx("Leeg: het adres van de website")} onChange={(e) => set({ query: e.target.value })} /></label>
          <label>{tx("Hoogte")}: {data.height || 320} px<input type="range" min={150} max={800} step={10} value={data.height || 320} onChange={(e) => set({ height: Number(e.target.value) })} /></label>
        </>)}
        {widget === "video" && <label>{tx("Link naar een YouTube- of Vimeo-video")}<input value={data.url || ""} placeholder="https://www.youtube.com/watch?v=…" onChange={(e) => set({ url: e.target.value })} /></label>}
        {widget === "quote" && (<>
          <label>{tx("Citaat")}<textarea rows={4} maxLength={500} value={data.text || ""} onChange={(e) => set({ text: e.target.value })} /></label>
          <label>{tx("Van wie")}<input maxLength={80} value={data.author || ""} onChange={(e) => set({ author: e.target.value })} /></label>
        </>)}
        {widget === "code" && (<>
          <label>HTML<textarea rows={8} spellCheck={false} style={{ fontFamily: "monospace" }} maxLength={60000} value={data.html || ""} onChange={(e) => set({ html: e.target.value })} /></label>
          <label>CSS<textarea rows={6} spellCheck={false} style={{ fontFamily: "monospace" }} maxLength={30000} value={data.css || ""} onChange={(e) => set({ css: e.target.value })} /></label>
          <p className="muted">{tx("De code draait in een afgeschermd kader: geen toegang tot de inlog of de rest van de website.")}</p>
        </>)}
        {widget === "logo" && <label>{tx("Breedte")}: {data.width || 160} px<input type="range" min={40} max={400} step={10} value={data.width || 160} onChange={(e) => set({ width: Number(e.target.value) })} /></label>}
        {(widget === "stats" || widget === "hours") && (<>
          {rows.map((r, i) => (
            <div className="row" key={i} style={{ justifyContent: "flex-start", gap: ".5rem" }}>
              <input value={widget === "stats" ? r.value : r.day} maxLength={widget === "stats" ? 12 : 30} placeholder={tx(widget === "stats" ? "Cijfer" : "Dag")} onChange={(e) => setRow(i, widget === "stats" ? { value: e.target.value } : { day: e.target.value })} style={{ width: "40%" }} />
              <input value={widget === "stats" ? r.label : r.time} maxLength={widget === "stats" ? 40 : 30} placeholder={tx(widget === "stats" ? "Omschrijving" : "Tijden")} onChange={(e) => setRow(i, widget === "stats" ? { label: e.target.value } : { time: e.target.value })} style={{ flex: 1 }} />
              <button type="button" className="btn sm danger" onClick={() => delRow(i)} aria-label={tx("Verwijder")}>×</button>
            </div>
          ))}
          {rows.length < (widget === "stats" ? 4 : 10) && <div><button type="button" className="btn sm" onClick={addRow}>+ {tx("Regel toevoegen")}</button></div>}
        </>)}
        <div className="row" style={{ justifyContent: "flex-end" }}><button type="button" className="btn primary" onClick={onClose}>{tx("Klaar")}</button></div>
      </div>
    </div>
  );
  return typeof document === "undefined" ? null : createPortal(body, document.body);
}
