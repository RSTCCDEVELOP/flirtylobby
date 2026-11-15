// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { tx } from "../lib/t";
import { WIDGET_NAMES } from "./PageWidget";
import Tabs from "./Tabs";
import { loadKit } from "../lib/ui-kit/kitDoc";
import MediaLibraryPanel from "./MediaLibraryPanel";

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
  code: I(<><path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" /></>),
  object: I(<><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></>),
};
// [type, widget, label, description, icon] per tab
const GROUPS = [
  ["basis", "Basis", [["heading", "", "Kop", "Een titel of tussenkop", "heading"], ["text", "", "Tekst", "Een alinea met opmaak", "text"], ["image", "", "Afbeelding", "Een foto uit de bibliotheek", "image"], ["button", "", "Knop", "Naar een pagina of link, in alle talen", "button"], ["widget", "quote", "Citaat", "Een uitspraak met naam", "quote"]]],
  ["media", "Media", [["widget", "video", "Video", "YouTube of Vimeo", "video"], ["widget", "map", WIDGET_NAMES.map, "Waar je te vinden bent", "map"], ["widget", "logo", WIDGET_NAMES.logo, "Het logo van de website", "logo"]]],
  ["bedrijf", "Over het bedrijf", [["widget", "contact", WIDGET_NAMES.contact, "Adres, telefoon en e-mail", "contact"], ["widget", "hours", WIDGET_NAMES.hours, "Dagen en tijden", "hours"], ["widget", "social", WIDGET_NAMES.social, "Links naar je profielen", "social"], ["widget", "stats", WIDGET_NAMES.stats, "Tot vier opvallende getallen", "stats"]]],
  ["opmaak", "Opmaak", [["spacer", "", "Tussenruimte", "Lege ruimte met een eigen hoogte", "spacer"], ["line", "", "Lijn", "Een scheidingslijn", "line"], ["widget", "code", WIDGET_NAMES.code, "Eigen HTML en CSS voor een lastig onderdeel", "code"]]],
];

// The pop-up of "+ Toevoegen" in a block (edit mode): tabs (basis, media, company, layout, system), each with parts with an icon and a line of explanation; search over all of them.
// onAdd(type, widget), onCols(n), onObjects(); cols = the number of columns now; objectCount = how many system objects there are (undefined = the module is off).
export default function PageAddMenu({ cols, objectCount, onAdd, onCols, onObjects, onComponents, onComponent, objectGroups = null, onObject = null, mediaOn = false, onMedia = null, onClose }) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("basis");
  const [libOpen, setLibOpen] = useState(false);  // the media library under the tile "Media bibliotheek": opens and closes with the tile
  const [kit, setKit] = useState(null);  // the components of the UI-kit (loaded when this menu opens)
  useEffect(() => { loadKit().then(setKit).catch(() => {}); }, []);
  const find = q.trim().toLowerCase();
  const match = (l, d) => `${tx(l)} ${tx(d)}`.toLowerCase().includes(find);
  const tabs = [...GROUPS.map(([k, l]) => [k, l]), ["componenten", "Componenten"], ...(objectCount !== undefined ? [["systeem", "Systeem"]] : [])];
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
  const comps = kit?.KIT_COMPONENTS || [];
  const compTile = (c) => (
    <button type="button" key={c.easy2edit_tag} className="pb-addtile" onClick={() => onComponent(c)} title={c.easy2edit_tag}>
      <span className="pb-addico">{ICON.object}</span>
      <span className="pb-addtext"><strong>{tx(c.name)}</strong><small>{tx(c.description)}</small></span>
    </button>
  );
  const compMatch = (c) => `${c.name} ${c.description} ${c.easy2edit_tag} ${c.category} ${c.group}`.toLowerCase().includes(find);
  const compGroups = [...new Set(comps.map((c) => c.group))];
  const compList = (
    <div className="pb-compcats">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", margin: ".1rem 0 .4rem" }}>
        <small className="muted">{comps.length ? `${comps.length} ${tx("componenten in de kleuren van je thema")}` : tx("Laden…")}</small>
        {onComponents && <button type="button" className="btn sm" onClick={onComponents}>{tx("Voorbeelden bekijken")}</button>}
      </div>
      {compGroups.map((g) => (
        <div key={g} className="pb-compcat">
          <h4 style={{ margin: ".7rem 0 .3rem" }}>{tx(g)}</h4>
          <div className="pb-addgrid">{comps.filter((c) => c.group === g).map(compTile)}</div>
        </div>
      ))}
    </div>
  );
  const objHits = find && objectGroups ? objectGroups.flatMap((g) => g.items.filter((o) => `${o.name} ${g.label} ${o.slug}`.toLowerCase().includes(find)).map((o) => ({ ...o, label: g.label }))) : [];
  const hits = find ? [...GROUPS.flatMap(([, , items]) => items.filter(([, , l, d]) => match(l, d))), ...(objectCount !== undefined && match("Systeemobjecten", "Producten, formulieren, abonnementen") ? ["obj"] : [])] : null;
  return (
    <div className="pb-addpanel" role="dialog" aria-label={tx("Onderdeel toevoegen")} onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <input type="search" className="pb-addsearch" placeholder={tx("Zoek een onderdeel…")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={tx("Zoek een onderdeel…")} />
      {!find && <Tabs tabs={tabs} value={tab} onChange={setTab} className="pb-addtabs" />}
      <div className="pb-addscroll">
        {find ? (
          hits.length || comps.some(compMatch) || objHits.length ? (
            <>
              {hits.length > 0 && <div className="pb-addgrid">{hits.map((h) => (h === "obj" ? objTile : tile(h)))}</div>}
              {objHits.length > 0 && onObject && <><h4 style={{ margin: ".7rem 0 .3rem" }}>{tx("Systeemobjecten")}</h4><div className="pb-addgrid">{objHits.map((o) => <button type="button" key={o.slug} className="pb-addtile" onClick={() => onObject(o.slug)} title={o.slug}><span className="pb-addico">{ICON.object}</span><span className="pb-addtext"><strong>{o.name}</strong><small>{tx(o.label)}</small></span></button>)}</div></>}
              {comps.some(compMatch) && <><h4 style={{ margin: ".7rem 0 .3rem" }}>{tx("Componenten")}</h4><div className="pb-addgrid">{comps.filter(compMatch).map(compTile)}</div></>}
            </>
          ) : <p className="muted" style={{ padding: ".6rem" }}>{tx("Niets gevonden.")}</p>
        ) : (
          <>
            {GROUPS.filter(([k]) => k === tab).map(([k, , items]) => <div className="pb-addgrid" key={k}>{items.map(tile)}</div>)}
            {tab === "opmaak" && colsRow}
            {tab === "componenten" && compList}
            {tab === "media" && mediaOn && onMedia && (
              <div className="pb-medialib-part">
                <button type="button" className={`pb-addtile${libOpen ? " on" : ""}`} aria-expanded={libOpen} onClick={() => setLibOpen(!libOpen)}>
                  <span className="pb-addico">{ICON.image}</span>
                  <span className="pb-addtext"><strong>{tx("Media bibliotheek")}</strong><small>{tx("Een afbeelding uit je bibliotheek")}</small></span>
                  <span className="pb-addchev" aria-hidden="true">{libOpen ? "▾" : "▸"}</span>
                </button>
                {libOpen && <div style={{ marginTop: ".5rem" }}><MediaLibraryPanel onPick={onMedia} /></div>}
              </div>
            )}
            {tab === "systeem" && (objectGroups && onObject ? (
              <div className="pb-sysgroups">
                <small className="muted">{objectCount} {tx("systeemobjecten, per module of plugin")}</small>
                {objectGroups.map((g) => (
                  <details key={g.key} className="pb-sysgroup">
                    <summary><strong>{tx(g.label)}</strong> <small className="muted">({g.items.length})</small></summary>
                    <div className="pb-addgrid">{g.items.map((o) => (
                      <button type="button" key={o.slug} className="pb-addtile" onClick={() => onObject(o.slug)} title={o.slug}>
                        <span className="pb-addico">{ICON.object}</span>
                        <span className="pb-addtext"><strong>{o.name}</strong><small>{tx(g.label)}</small></span>
                      </button>
                    ))}</div>
                  </details>
                ))}
              </div>
            ) : <div className="pb-addgrid">{objTile}</div>)}
          </>
        )}
      </div>
    </div>
  );
}
