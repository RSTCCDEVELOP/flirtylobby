// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { dragProps } from "../lib/panel-drag";
import { useEffect, useState } from "react";
import { tx } from "../lib/t";
import { WIDGET_NAMES } from "./PageWidget";
import Tabs from "./Tabs";
import { loadKit } from "../lib/ui-kit/kitDoc";
import MediaLibraryPanel from "./MediaLibraryPanel";
import Loading from "./Loading";
import WidgetFrame from "./WidgetFrame";
import { matches } from "../lib/useView";

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
// the kinds of media objects with a single-colour icon each (the tile of a kind that is not made yet creates it)
const MEDIA_ICON = {
  carousel: I(<><rect x="7" y="6" width="10" height="12" rx="1.5" /><path d="M3 9v6M21 9v6" /></>),
  slideshow: I(<><rect x="3" y="5" width="18" height="12" rx="2" /><path d="M9 20h6" /></>),
  coverflow: I(<><rect x="8" y="6" width="8" height="12" rx="1.5" /><path d="M5 8l-2 1.5v5L5 16M19 8l2 1.5v5L19 16" /></>),
  filmstrip: I(<><rect x="3" y="4" width="18" height="11" rx="2" /><path d="M5 19h3M10.5 19h3M16 19h3" /></>),
  mosaic: I(<><rect x="3" y="3" width="10" height="10" rx="1.5" /><rect x="15" y="3" width="6" height="6" rx="1.5" /><rect x="15" y="11" width="6" height="10" rx="1.5" /><rect x="3" y="15" width="10" height="6" rx="1.5" /></>),
  stack: I(<><rect x="6" y="7" width="13" height="11" rx="1.5" /><path d="M4 16V6a1.5 1.5 0 011.5-1.5H16" /></>),
  book: I(<><path d="M12 6v14M12 6c-2-1.5-5-2-8-1.5V18c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V4.5C17 4 14 4.5 12 6z" /></>),
  album: I(<><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></>),
  wall: I(<><rect x="3" y="3" width="8" height="12" rx="1.5" /><rect x="13" y="3" width="8" height="7" rx="1.5" /><rect x="13" y="12" width="8" height="9" rx="1.5" /><rect x="3" y="17" width="8" height="4" rx="1.5" /></>),
  videogrid: I(<><rect x="3" y="4" width="8" height="7" rx="1.5" /><rect x="13" y="4" width="8" height="7" rx="1.5" /><rect x="3" y="13" width="8" height="7" rx="1.5" /><rect x="13" y="13" width="8" height="7" rx="1.5" /><path d="M6 6.5v2l2-1z" /></>),
  playlist: I(<><rect x="3" y="4" width="12" height="9" rx="1.5" /><path d="M7.5 6.5v4l3.5-2zM18 5v14M3 17h12M3 20h12" /></>),
  vcarousel: I(<><rect x="7" y="6" width="10" height="12" rx="1.5" /><path d="M3 9v6M21 9v6M11 10v4l3-2z" /></>),
};
const MEDIA_KINDS = [["carousel", "Beeldcarrousel"], ["slideshow", "Diavoorstelling"], ["coverflow", "Coverflow"], ["filmstrip", "Galerij met filmstrip"], ["mosaic", "Mozaïek"], ["stack", "Fotostapel"], ["book", "Bladerboek"], ["album", "Fotoboek"], ["wall", "Fotomuur"], ["videogrid", "Videoraster"], ["playlist", "Videolijst met speler"], ["vcarousel", "Videocarrousel"]];
const mediaIcon = (t) => MEDIA_ICON[t] || ICON.image;
// [type, widget, label, description, icon] per tab
const GROUPS = [
  ["basis", "Basis", [["heading", "", "Kop", "Een titel of tussenkop", "heading"], ["text", "", "Tekst", "Een alinea met opmaak", "text"], ["image", "", "Afbeelding", "Een foto uit de bibliotheek", "image"], ["button", "", "Knop", "Naar een pagina of link, in alle talen", "button"], ["widget", "quote", "Citaat", "Een uitspraak met naam", "quote"]]],
  ["media", "Media", [["widget", "video", "Video", "YouTube of Vimeo", "video"], ["widget", "map", WIDGET_NAMES.map, "Waar je te vinden bent", "map"], ["widget", "logo", WIDGET_NAMES.logo, "Het logo van de website", "logo"]]],
  ["bedrijf", "Over het bedrijf", [["widget", "contact", WIDGET_NAMES.contact, "Adres, telefoon en e-mail", "contact"], ["widget", "hours", WIDGET_NAMES.hours, "Dagen en tijden", "hours"], ["widget", "social", WIDGET_NAMES.social, "Links naar je profielen", "social"], ["widget", "stats", WIDGET_NAMES.stats, "Tot vier opvallende getallen", "stats"]]],
  ["opmaak", "Opmaak", [["spacer", "", "Tussenruimte", "Lege ruimte met een eigen hoogte", "spacer"], ["line", "", "Lijn", "Een scheidingslijn", "line"], ["widget", "code", WIDGET_NAMES.code, "Eigen HTML en CSS voor een lastig onderdeel", "code"]]],
];

// The pop-up of "+ Toevoegen" in a block (edit mode): tabs (basis, media, company, layout, system), each with parts with an icon and a line of explanation; search over all of them.
// onAdd(type, widget), onCols(n), onObjects(); cols = the number of columns now; objectCount = how many system objects there are (undefined = the module is off).
export default function PageAddMenu({ cols, objectCount, onAdd, onCols, onObjects, onComponents, onComponent, objectGroups = null, onObject = null, mediaOn = false, onMedia = null, onMediaKind = null, onClose }) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("basis");
  const [shut, setShut] = useState(() => { try { return JSON.parse(localStorage.getItem("pb-comp-shut") || "{}"); } catch { return {}; } });  // the groups of the components that are folded (remembered)
  const fold = (g) => setShut((o) => { const n = { ...o, [g]: !o[g] }; try { localStorage.setItem("pb-comp-shut", JSON.stringify(n)); } catch { /* no storage: it just is not remembered */ } return n; });
  const foldAll = (closed) => setShut(() => { const n = closed ? Object.fromEntries(compGroups.map((g) => [g, true])) : {}; try { localStorage.setItem("pb-comp-shut", JSON.stringify(n)); } catch { /* not remembered */ } return n; });
  const [libOpen, setLibOpen] = useState(false);  // the media library under the tile "Media bibliotheek": opens and closes with the tile
  const [kit, setKit] = useState(null);  // the components of the UI-kit (loaded when this menu opens)
  useEffect(() => { loadKit().then(setKit).catch(() => {}); }, []);
  const find = q.trim().toLowerCase();
  const match = (l, d) => matches(q, l, d);
  const widgetItems = (objectGroups || []).flatMap((g) => g.items).filter((o) => o.kind === "widget");  // the installed widgets: each with its example, to click or drag onto the page
  const tabs = [...GROUPS.map(([k, l]) => [k, l]), ["componenten", "Componenten"], ...(widgetItems.length ? [["widgets", "Widgets"]] : []), ...(objectCount !== undefined ? [["systeem", "Systeem"]] : [])];
  const tile = ([type, widget, label, desc, icon]) => (
    <button type="button" key={`${type}-${widget}`} className="pb-addtile" onClick={() => onAdd(type, widget)} {...dragProps({ kind: "basic", type, widget })}>
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
    <button type="button" key={c.easy2edit_tag} className="pb-addtile" onClick={() => onComponent(c)} title={c.easy2edit_tag} {...dragProps({ kind: "component", comp: c })}>
      <span className="pb-addico">{ICON.object}</span>
      <span className="pb-addtext"><strong>{tx(c.name)}</strong><small>{tx(c.description)}</small></span>
    </button>
  );
  const compMatch = (c) => `${c.name} ${c.description} ${c.easy2edit_tag} ${c.category} ${c.group}`.toLowerCase().includes(find);
  const compGroups = [...new Set(comps.map((c) => c.group))];
  const compList = (
    <div className="pb-compcats">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", margin: ".1rem 0 .4rem" }}>
        <small className="muted">{comps.length ? `${comps.length} ${tx("componenten in de kleuren van je thema")}` : <Loading compact />}</small>
        {onComponents && <button type="button" className="btn sm" onClick={onComponents}>{tx("Voorbeelden bekijken")}</button>}
      </div>
      {compGroups.length > 1 && (
        <div className="row" style={{ gap: ".4rem", margin: "0 0 .2rem" }}>
          <button type="button" className="btn sm" onClick={() => foldAll(true)}>{tx("Alles inklappen")}</button>
          <button type="button" className="btn sm" onClick={() => foldAll(false)}>{tx("Alles uitklappen")}</button>
        </div>
      )}
      {compGroups.map((g) => (
        <div key={g} className="pb-compcat">
          <h4 style={{ margin: ".7rem 0 .3rem" }}>
            <button type="button" className="pb-comphead" aria-expanded={!shut[g] || !!find} onClick={() => fold(g)}>
              <span>{tx(g)} <small className="muted">({comps.filter((c) => c.group === g).length})</small></span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: shut[g] && !find ? "rotate(-90deg)" : "none", transition: "transform .15s" }}><path d="m6 9 6 6 6-6" /></svg>
            </button>
          </h4>
          {(!shut[g] || !!find) && <div className="pb-addgrid">{comps.filter((c) => c.group === g).map(compTile)}</div>}
        </div>
      ))}
    </div>
  );
  const mediaObjects = (objectGroups || []).flatMap((g) => g.items).filter((o) => o.kind === "media");  // photo and video objects (carousel, slider, coverflow, mosaic, book ...): they live in the Media tab
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
              {objHits.length > 0 && onObject && <><h4 style={{ margin: ".7rem 0 .3rem" }}>{tx("Systeemobjecten")}</h4><div className="pb-addgrid">{objHits.map((o) => <button type="button" key={o.slug} className="pb-addtile" onClick={() => onObject(o.slug)} title={o.slug} {...dragProps({ kind: "object", slug: o.slug })}><span className="pb-addico">{ICON.object}</span><span className="pb-addtext"><strong>{o.name}</strong><small>{tx(o.label)}</small></span></button>)}</div></>}
              {comps.some(compMatch) && <><h4 style={{ margin: ".7rem 0 .3rem" }}>{tx("Componenten")}</h4><div className="pb-addgrid">{comps.filter(compMatch).map(compTile)}</div></>}
            </>
          ) : <p className="muted" style={{ padding: ".6rem" }}>{tx("Niets gevonden.")}</p>
        ) : (
          <>
            {GROUPS.filter(([k]) => k === tab).map(([k, , items]) => <div className="pb-addgrid" key={k}>{items.map(tile)}</div>)}
            {tab === "opmaak" && colsRow}
            {tab === "componenten" && compList}
            {tab === "widgets" && (
              <div className="pb-widgetgrid">
                {widgetItems.map((o) => (
                  <button type="button" key={o.slug} className="pb-widgettile" onClick={() => onObject && onObject(o.slug)} title={o.desc || o.name} {...dragProps({ kind: "object", slug: o.slug })}>
                    <span className="pb-widgetprev"><WidgetFrame doc={o.doc} height={Math.min(o.height || 160, 190)} inert title={o.name} /></span>
                    <span className="pb-addtext"><strong>{o.name}</strong>{o.desc && <small>{o.desc}</small>}</span>
                  </button>
                ))}
              </div>
            )}
            {tab === "media" && objectGroups && onObject && (
              <div className="pb-mediaobjs">
                <h4 style={{ margin: ".9rem 0 .3rem" }}>
                  <button type="button" className="pb-comphead" aria-expanded={!shut.__media || !!find} onClick={() => fold("__media")}>
                    <span>{tx("Presentaties, sliders en carrousels")} <small className="muted">({mediaObjects.length})</small></span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: shut.__media ? "rotate(-90deg)" : "none", transition: "transform .15s" }}><path d="m6 9 6 6 6-6" /></svg>
                  </button>
                </h4>
                {!shut.__media && <div className="pb-addgrid">
                  {mediaObjects.map((o) => (
                    <button type="button" key={o.slug} className="pb-addtile" onClick={() => onObject(o.slug)} title={o.slug} {...dragProps({ kind: "object", slug: o.slug })}>
                      <span className="pb-addico">{mediaIcon(o.mtype)}</span>
                      <span className="pb-addtext"><strong>{o.name}</strong><small>{tx(o.typeLabel || "Media")}</small></span>
                    </button>
                  ))}
                  {onMediaKind && MEDIA_KINDS.filter(([k]) => !mediaObjects.some((o) => o.mtype === k)).map(([k, l]) => (
                    <button type="button" key={`new-${k}`} className="pb-addtile" onClick={() => onMediaKind(k, tx(l))} title={tx("Maakt dit onderdeel met de afbeeldingen van je bibliotheek")}>
                      <span className="pb-addico">{mediaIcon(k)}</span>
                      <span className="pb-addtext"><strong>{tx(l)}</strong><small>{tx("Toevoegen en instellen")}</small></span>
                    </button>
                  ))}
                </div>}
              </div>
            )}
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
                {objectGroups.filter((g) => !g.items.every((o) => o.kind === "media")).map((g) => (
                  <details key={g.key} className="pb-sysgroup">
                    <summary><strong>{tx(g.label)}</strong> <small className="muted">({g.items.length})</small></summary>
                    <div className="pb-addgrid">{g.items.map((o) => (
                      <button type="button" key={o.slug} className="pb-addtile" onClick={() => onObject(o.slug)} title={o.slug} {...dragProps({ kind: "object", slug: o.slug })}>
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
