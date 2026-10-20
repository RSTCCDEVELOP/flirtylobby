"use client";

import { tx } from "../lib/t";
import { IconEdit } from "./Icons";
import { alertDialog, confirmDialog } from "../lib/dialog";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { api, errorText, mediaUrl } from "../lib/api";
import MediaPicker from "./MediaPicker";
import { useModule } from "./Modules";
import RichEditor, { plainToHtml, toDisplay } from "./RichEditor";
import RichHtml from "./SysObjects";
import { PlaceControls, placeStyle } from "./ImagePlace";
import { pushUndo } from "../lib/undo";
import { GripContext } from "./Movable";
import { useSession } from "./Session";

const ContentContext = createContext({ blocks: {}, setBlock: () => {}, defaultLang: "nl", languages: [] });

// Editable website texts, loaded on the server and updated locally after a save
export function ContentProvider({ initial, defaultLang, languages, children }) {
  const [blocks, setBlocks] = useState(initial || {});
  useEffect(() => setBlocks(initial || {}), [initial]); // after router.refresh()
  const setBlock = (key, lang, text) => setBlocks((b) => ({ ...b, [key]: { ...b[key], [lang]: text } }));
  return <ContentContext.Provider value={{ blocks, setBlock, defaultLang, languages }}>{children}</ContentContext.Provider>;
}

// lets a component add texts it fetched itself (with the visitor's login) to the page's content
export const useSetBlock = () => useContext(ContentContext).setBlock;

function useLang() {
  const { defaultLang, languages } = useContext(ContentContext);
  const [lang, setLang] = useState(defaultLang);
  useEffect(() => {
    const sync = () => {
      let saved = null;
      try { saved = localStorage.getItem("lang"); } catch {}
      setLang(languages?.includes(saved) ? saved : defaultLang);
    };
    sync();
    window.addEventListener("langchange", sync);
    return () => window.removeEventListener("langchange", sync);
  }, [defaultLang, languages]);
  return lang;
}

// <EditableText id="home.title" as="h1" fallback="Standaardtekst" />
// Shows the stored text for the visitor's language; in edit mode the text can be changed in place.
// With `rich`, the text can also be edited in a popup WYSIWYG editor (headings, lists, links, images).
export function EditableText({ id, as: Tag = "p", fallback = "", fallbacks, className, rich = false }) {
  const { blocks, setBlock, defaultLang } = useContext(ContentContext);
  const { editing } = useSession();
  const lang = useLang();
  const ref = useRef(null);
  const [status, setStatus] = useState("");
  const [popup, setPopup] = useState(false);
  // stored text for this language, else built-in default for it, else the default language
  const text = blocks[id]?.[lang] ?? fallbacks?.[lang] ?? blocks[id]?.[defaultLang] ?? fallbacks?.[defaultLang] ?? fallback;
  const isHtml = text.startsWith("html:");

  // keep the DOM in sync when not typing
  useEffect(() => {
    if (ref.current && !isHtml && document.activeElement !== ref.current) ref.current.innerText = text;
  }, [text, editing, isHtml]);

  async function put(body) {
    const prev = blocks[id]?.[lang];
    pushUndo(tx("Tekst gewijzigd"), async () => {
      const isH = typeof prev === "string" && prev.startsWith("html:");
      const r = await api("/content/save/", { method: "PUT", body: { key: id, lang, ...(isH ? { html: true, text: prev.slice(5) } : { text: prev ?? "" }) } });
      setBlock(id, lang, prev === undefined ? "" : isH ? "html:" + r.text : r.text);
    }, { key: `text:${id}`, merge: 4000 });
    const r = await api("/content/save/", { method: "PUT", body: { key: id, lang, ...body } });
    setBlock(id, lang, body.html ? "html:" + r.text : r.text);
  }

  async function save() {
    const value = ref.current.innerText.trim();
    if (value === text) return;
    setStatus("saving");
    try {
      await put({ text: value });
      setStatus("saved");
      setTimeout(() => setStatus(""), 1500);
    } catch (e) {
      setStatus("error");
      (await alertDialog(errorText(e)));
      ref.current.innerText = text;
    }
  }

  const display = isHtml ? (
    <RichHtml className={`rich-text ${className || ""}`} html={toDisplay(text.slice(5))} />
  ) : (
    <Tag className={className}>{text}</Tag>
  );

  if (!editing) return display;
  return (
    <div className="text-edit">
      {isHtml ? <div className={`editable-rich ${className || ""}`}>{display}</div> : (
        <Tag
          ref={ref}
          className={`${className || ""} editable ${status}`}
          contentEditable
          suppressContentEditableWarning
          spellCheck
          onBlur={save}
          title={tx("Bewerken ({0})", lang)}
        />
      )}
      {rich && <button type="button" className="img-edit-btn" onClick={() => setPopup(true)}><IconEdit width={14} height={14} /> {tx("Uitgebreid")}</button>}
      {popup && (
        <RichEditor
          initialHtml={isHtml ? text.slice(5) : plainToHtml(text)}
          onSave={(html) => put({ html: true, text: html }).catch((e) => { throw new Error(errorText(e)); })}
          onPlain={(t) => put({ text: t }).catch((e) => { throw new Error(errorText(e)); })}
          onClose={() => setPopup(false)}
        />
      )}
    </div>
  );
}

export function EditModeSwitch() {
  const { canEdit, editMode, setEditMode } = useSession();
  if (!canEdit) return null;
  return (
    <label className="edit-switch" title={tx("Website in bewerkmodus zetten")}>
      <span className="switch">
        <input type="checkbox" checked={editMode} onChange={(e) => setEditMode(e.target.checked)} />
        <span />
      </span>
      <span>{tx("Bewerken")}</span>
    </label>
  );
}

export function EditBanner() {
  const { editing } = useSession();
  if (!editing) return null;
  return <div className="edit-banner">{tx("Bewerkmodus aan: klik op een tekst met stippellijn om hem te wijzigen. Opslaan gebeurt automatisch.")}</div>;
}

// Edit mode: wrap any image so a content editor can swap it from the media library.
// target: "block:<key>" | "asset:<slot>" | "photo:<id>"
export function ImageEdit({ target, children, className = "", placement, onPlace, removable = false, extra = null }) {
  const { editing } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { blocks: blocks0v } = useContext(ContentContext);
  const blocks0 = useRef(blocks0v);
  blocks0.current = blocks0v;
  const mediaOn = useModule("media");
  if (!editing || !mediaOn) return children;

  async function pick(item) {
    const bid = target.startsWith("block:") ? target.slice(6) : "";
    const prevRaw = bid ? blocks0.current?.[bid]?.["*"] : undefined;
    if (bid && /^media:\d+$/.test(String(prevRaw || "")) ) pushUndo(item ? tx("Afbeelding vervangen") : tx("Afbeelding verwijderd"), async () => { await api("/media/replace/", { method: "POST", body: { target, media_id: Number(prevRaw.slice(6)) } }); router.refresh(); });
    else if (bid && !prevRaw && item) pushUndo(tx("Afbeelding gekozen"), async () => { await api("/media/replace/", { method: "POST", body: { target, media_id: null } }); router.refresh(); });
    try {
      await api("/media/replace/", { method: "POST", body: { target, media_id: item?.id ?? null } });
      setOpen(false);
      router.refresh();
    } catch (e) { (await alertDialog(errorText(e))); }
  }
  async function remove() {
    if (!(await confirmDialog(tx("Deze afbeelding of video van de pagina verwijderen?"), { danger: true }))) return;
    await pick(null);
  }
  return (
    <span className={`img-edit ${className}`}>
      {children}
      {onPlace && <span className="img-place-bar" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}><PlaceControls compact value={placement} onChange={onPlace} /></span>}
      <button type="button" className="img-edit-btn" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }} title={tx("Afbeelding wijzigen")}><IconEdit width={14} height={14} /> {tx("Wijzig")}</button>
      {extra}
      {removable && <button type="button" className="img-edit-btn img-del-btn" onClick={(e) => { e.preventDefault(); e.stopPropagation(); remove(); }} title={tx("Afbeelding verwijderen")}>{tx("Verwijder")}</button>}
      {open && <MediaPicker onPick={pick} onClose={() => setOpen(false)} />}
    </span>
  );
}

// settings of one picture (alignment, size in px or %, transparency, rounded corners): a gear on the picture, saved with the page texts
const parseSt = (raw) => { try { const d = JSON.parse(raw || "{}"); return d && typeof d === "object" ? d : {}; } catch { return {}; } };
export const imgStyleCss = (st) => ({
  wrap: { display: "flex", width: "100%", justifyContent: { left: "flex-start", center: "center", right: "flex-end" }[st.align] || undefined },
  inner: { ...(st.w ? { width: st.w, maxWidth: "100%" } : {}), ...(st.opacity !== undefined ? { opacity: st.opacity / 100 } : {}), ...(st.radius !== undefined && st.radius !== "" ? { borderRadius: `${st.radius}px`, overflow: "hidden" } : {}) },
});

function ImageStylePanel({ st, onChange }) {
  const unit = (st.w || "").endsWith("%") ? "%" : "px";
  return (
    <div className="pb-stylebox img-style-panel" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
      <strong>{tx("Afbeeldingsinstellingen")}</strong>
      <div className="pb-stylerow"><span>{tx("Uitlijnen")}</span>
        <span className="pb-seg">{[["left", "⇤", "Links"], ["center", "↔", "Midden"], ["right", "⇥", "Rechts"]].map(([k, g, l]) => <button type="button" key={k} className={st.align === k ? "on" : ""} onClick={() => onChange({ align: st.align === k ? "" : k })}>{g} {tx(l)}</button>)}</span></div>
      <div className="pb-stylerow"><span>{tx("Grootte")}</span>
        <input type="number" min={1} max={4000} value={parseInt(st.w) || ""} placeholder={tx("Auto")} onChange={(e) => onChange({ w: e.target.value === "" ? "" : `${e.target.value}${unit}` })} style={{ width: "6rem" }} />
        <select value={unit} onChange={(e) => st.w && onChange({ w: `${parseInt(st.w)}${e.target.value}` })}><option value="px">px</option><option value="%">%</option></select>
        {[["25%", "Klein"], ["50%", "Middel"], ["75%", "Groot"], ["100%", "Volledig"]].map(([v, l]) => <button type="button" className={`btn sm${st.w === v ? " primary" : ""}`} key={v} onClick={() => onChange({ w: v })}>{tx(l)}</button>)}</div>
      <div className="pb-stylerow"><span>{tx("Doorzichtigheid")}</span>
        <input type="range" min={0} max={100} step={5} value={st.opacity ?? 100} onChange={(e) => onChange({ opacity: Number(e.target.value) })} style={{ width: 160 }} /><small className="muted">{st.opacity ?? 100}% {tx("zichtbaar")}</small></div>
      <div className="pb-stylerow"><span>{tx("Ronde hoeken")}</span>
        <input type="number" min={0} max={200} step={2} value={st.radius ?? ""} placeholder={tx("Thema")} onChange={(e) => onChange({ radius: e.target.value === "" ? "" : Number(e.target.value) })} style={{ width: "6rem" }} /><small className="muted">px</small>
        <button type="button" className="btn sm" disabled={!Object.keys(st).length} onClick={() => onChange(null)}>{tx("Terug naar standaard")}</button></div>
    </div>
  );
}

// <EditableImage id="home.hero" fallback={<Logo />} />: image stored as a content block
export function EditableImage({ id, fallback = null, alt = "", className = "" }) {
  const { blocks, setBlock, defaultLang } = useContext(ContentContext);
  const { editing } = useSession();
  const url = blocks[id]?.["*"];
  const placement = blocks[`${id}.pl`]?.[defaultLang]; // how it sits: "align:size", chosen with every picture (stored with the page texts)
  const st = parseSt(blocks[`${id}.st`]?.[defaultLang]); // own settings: {align, w, opacity, radius}
  const [panel, setPanel] = useState(false);
  const grip = useContext(GripContext);
  const save = async (key, v) => {
    const prev = blocks[key]?.[defaultLang];
    pushUndo(tx("Afbeeldingsinstelling gewijzigd"), async () => { setBlock(key, defaultLang, prev ?? ""); try { await api("/content/save/", { method: "PUT", body: { key, lang: defaultLang, text: prev ?? "" } }); } catch {} }, { key: `img:${key}`, merge: 2500 });
    setBlock(key, defaultLang, v);
    try { await api("/content/save/", { method: "PUT", body: { key, lang: defaultLang, text: v } }); } catch (e) { (await alertDialog(errorText(e))); }
  };
  const place = (v) => save(`${id}.pl`, v);
  const change = (patch) => {
    const next = patch === null ? {} : { ...st, ...patch };
    Object.keys(next).forEach((k) => { if (next[k] === "" || next[k] == null) delete next[k]; });
    save(`${id}.st`, JSON.stringify(next));
  };
  const css = imgStyleCss(st);
  const hasSt = Object.keys(st).length > 0;
  return (
    <div className={`ei-wrap${st.align ? ` al al-${st.align}` : ""}${st.w ? " sized" : ""}`}>
      <div className={`ei-inner${st.w ? " sized" : ""}`} style={hasSt ? css.inner : undefined}>
        <ImageEdit target={`block:${id}`} placement={placement} onPlace={url ? place : undefined} removable={!!url}
          extra={editing && <>{grip}<button type="button" className={`img-edit-btn img-set-btn${panel ? " on" : ""}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPanel(!panel); }} title={tx("Afbeeldingsinstellingen")} aria-label={tx("Afbeeldingsinstellingen")} aria-expanded={panel}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>
          </button></>}>
          {url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(url)} alt={alt} className={className} style={{ ...(placement && !st.w ? placeStyle(placement) : {}), ...(hasSt ? { width: "100%", height: "auto", opacity: st.opacity !== undefined ? st.opacity / 100 : undefined, borderRadius: st.radius !== undefined ? `${st.radius}px` : undefined } : {}) }} /> : fallback}
        </ImageEdit>
        {editing && panel && <ImageStylePanel st={st} onChange={change} />}
      </div>
    </div>
  );
}
