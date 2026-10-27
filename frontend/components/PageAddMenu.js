// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useState } from "react";
import { tx } from "../lib/t";
import { WIDGET_NAMES } from "./PageWidget";
import Tabs from "./Tabs";

// One-colour icons (they follow the colour of the text)
const I = (d) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const ICON = {
  heading: I(<><path d="M5 5v14M19 5v14M5 12h14" /></>),
  text: I(<><path d="M4 6h16M4 11h16M4 16h10" /></>),
  image: I(<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M21 16l-5-5-8 9" /></>),
  button: I(<><rect x="3" y="8" width="18" height="8" rx="4" /><path d="M9 12h6" /></>),
  spacer: I(<><path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4" /></>),
  line: I(<><path d="M4 12h16" /></>),
  contact: I(<><path d="M21 10c0 6-9 12-9 12S3 16 3 10a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></>),
  social: I(<><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.2 11l7.6-3.8M8.2 13l7.6 3.8" /></>),
  map: I(<><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" /></>),
  video: I(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M10 9.5v5l4.5-2.5z" /></>),
  quote: I(<><path d="M5 17c0-4 1-7 5-9M13 17c0-4 1-7 5-9" /><path d="M5 17h4v-4H5zM13 17h4v-4h-4z" /></>),
  stats: I(<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>),
  logo: I(<><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5c1 1.4 2.2 2 3.5 2s2.5-.6 3.5-2" /><circle cx="9" cy="10" r=".8" /><circle cx="15" cy="10" r=".8" /></>),
  hours: I(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  object: I(<><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></>),
};
// [type, widget, label, description, icon] per tab
const GROUPS = [
  ["basis", "Basis", [["heading", "", "Kop", "Een titel of tussenkop", "heading"], ["text", "", "Tekst", "Een alinea met opmaak", "text"], ["image", "", "Afbeelding", "Een foto uit de bibliotheek", "image"], ["button", "", "Knop", "Naar een pagina of link, in alle talen", "button"], ["widget", "quote", "Citaat", "Een uitspraak met naam", "quote"]]],
  ["media", "Media", [["widget", "video", "Video", "YouTube of Vimeo", "video"], ["widget", "map", WIDGET_NAMES.map, "Waar je te vinden bent", "map"], ["widget", "logo", WIDGET_NAMES.logo, "Het logo van de website", "logo"]]],
  ["bedrijf", "Over het bedrijf", [["widget", "contact", WIDGET_NAMES.contact, "Adres, telefoon en e-mail", "contact"], ["widget", "hours", WIDGET_NAMES.hours, "Dagen en tijden", "hours"], ["widget", "social", WIDGET_NAMES.social, "Links naar je profielen", "social"], ["widget", "stats", WIDGET_NAMES.stats, "Tot vier opvallende getallen", "stats"]]],
  ["opmaak", "Opmaak", [["spacer", "", "Tussenruimte", "Lege ruimte met een eigen hoogte", "spacer"], ["line", "", "Lijn", "Een scheidingslijn", "line"]]],
];

// The pop-up of "+ Toevoegen" in a block (edit mode): tabs (basis, media, company, layout, system), each with parts with an icon and a line of explanation; search over all of them.
// onAdd(type, widget), onCols(n), onObjects(); cols = the number of columns now; objectCount = how many system objects there are (undefined = the module is off).
export default function PageAddMenu({ cols, objectCount, onAdd, onCols, onObjects, onClose }) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("basis");
  const find = q.trim().toLowerCase();
  const match = (l, d) => `${tx(l)} ${tx(d)}`.toLowerCase().includes(find);
  const tabs = [...GROUPS.map(([k, l]) => [k, l]), ...(objectCount !== undefined ? [["systeem", "Systeem"]] : [])];
  const tile = ([type, widget, label, desc, icon]) => (
    <button type="button" key={`${type}-${widget}`} className="pb-addtile" onClick={() => onAdd(type, widget)}>
      <span className="pb-addico">{ICON[icon]}</span>
      <span className="pb-addtext"><strong>{tx(label)}</strong><small>{tx(desc)}</small></span>
    </button>
  );
  const objTile = (
    <button type="button" key="obj" className="pb-addtile" onClick={onObjects}>
      <span className="pb-addico">{ICON.object}</span>
      <span className="pb-addtext"><strong>{tx("Systeemobjecten")} <small className="muted">({objectCount})</small></strong><small>{tx("Producten, formulieren, abonnementen en meer van de website")}</small></span>
    </button>
  );
  const colsRow = (
    <div className="pb-addcols-wrap">
      <h4>{tx("Raster in dit blok")}</h4>
      <div className="pb-addcols">{[1, 2, 3, 4].map((n) => <button type="button" key={n} className={cols === n ? "on" : ""} onClick={() => onCols(n)} title={n === 1 ? tx("Eén kolom") : `${n} ${tx("kolommen")}`}>{n}</button>)}<small className="muted">{tx("kolommen")}</small></div>
    </div>
  );
  const hits = find ? [...GROUPS.flatMap(([, , items]) => items.filter(([, , l, d]) => match(l, d))), ...(objectCount !== undefined && match("Systeemobjecten", "Producten, formulieren, abonnementen") ? ["obj"] : [])] : null;
  return (
    <div className="pb-addpanel" role="dialog" aria-label={tx("Onderdeel toevoegen")} onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <input type="search" className="pb-addsearch" placeholder={tx("Zoek een onderdeel…")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={tx("Zoek een onderdeel…")} />
      {!find && <Tabs tabs={tabs} value={tab} onChange={setTab} className="pb-addtabs" />}
      <div className="pb-addscroll">
        {find ? (
          hits.length ? <div className="pb-addgrid">{hits.map((h) => (h === "obj" ? objTile : tile(h)))}</div> : <p className="muted" style={{ padding: ".6rem" }}>{tx("Niets gevonden.")}</p>
        ) : (
          <>
            {GROUPS.filter(([k]) => k === tab).map(([k, , items]) => <div className="pb-addgrid" key={k}>{items.map(tile)}</div>)}
            {tab === "opmaak" && colsRow}
            {tab === "systeem" && <div className="pb-addgrid">{objTile}</div>}
          </>
        )}
      </div>
    </div>
  );
}
