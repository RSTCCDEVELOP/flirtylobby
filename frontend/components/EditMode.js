"use client";

import { tx } from "../lib/t";
import { IconEdit, IconTrash } from "./Icons";
import { alertDialog, confirmDialog } from "../lib/dialog";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { api, errorText, mediaUrl } from "../lib/api";
import MediaPicker from "./MediaPicker";
import { useModule } from "./Modules";
import RichEditor, { plainToHtml, toDisplay, toStored } from "./RichEditor";
import RichHtml from "./SysObjects";
import { PlaceControls, placeStyle } from "./ImagePlace";
import FloatPanel from "./FloatPanel";
import { pushUndo } from "../lib/undo";
import { lorem } from "../lib/lorem";
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

// A fixed element of a page (title, text, logo) can be removed with the trash icon in edit mode. It is kept as <id>.gone = "1" with the page texts, so nothing is lost:
// visitors no longer see it, and in edit mode it is gone too: the undo arrow (top right) puts it back.
function useGone(id) {
  const { blocks, setBlock, defaultLang } = useContext(ContentContext);
  const gone = blocks[`${id}.gone`]?.[defaultLang] === "1";
  const set = async (v, label) => {
    const key = `${id}.gone`, prev = blocks[key]?.[defaultLang] ?? "";
    pushUndo(label, async () => { setBlock(key, defaultLang, prev); try { await api("/content/save/", { method: "PUT", body: { key, lang: defaultLang, text: prev } }); } catch {} });
    setBlock(key, defaultLang, v);
    try { await api("/content/save/", { method: "PUT", body: { key, lang: defaultLang, text: v } }); } catch (e) { await alertDialog(errorText(e)); }
  };
  return [gone, set];
}
// Dummy text for a text block: choose how long (a number of words, or short / medium / long) and it is put in the block (undo brings the old text back).
function LoremButton({ onInsert }) {
  const [open, setOpen] = useState(false);
  const [words, setWords] = useState(40);
  const [paras, setParas] = useState(false);
  return (
    <span className="lorem-wrap" onMouseDown={(e) => e.stopPropagation()}>
      <button type="button" className="img-edit-btn lorem-btn" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }} aria-expanded={open} title={tx("Dummytekst invoegen")}>Lorem</button>
      {open && (
        <div className="lorem-pop card" onClick={(e) => e.stopPropagation()}>
          <strong>{tx("Dummytekst")}</strong>
          <div className="lorem-presets">
            {[[15, "Kort"], [40, "Middel"], [100, "Lang"], [250, "Heel lang"]].map(([n, l]) => <button type="button" key={n} className={`btn sm${words === n ? " primary" : ""}`} onClick={() => setWords(n)}>{tx(l)}</button>)}
          </div>
          <label>{tx("Aantal woorden")}
            <input type="range" min={5} max={500} step={5} value={Math.min(words, 500)} onChange={(e) => setWords(Number(e.target.value))} />
            <input type="number" min={1} max={2000} value={words} onChange={(e) => setWords(Number(e.target.value) || 1)} style={{ width: "5rem" }} />
          </label>
          <label className="check"><input type="checkbox" checked={paras} onChange={(e) => setParas(e.target.checked)} />{tx("In alinea's verdelen")}</label>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="btn sm" onClick={() => setOpen(false)}>{tx("Annuleren")}</button>
            <button type="button" className="btn sm primary" onClick={() => { onInsert(lorem(words, paras)); setOpen(false); }}>{tx("Invoegen")}</button>
          </div>
        </div>
      )}
    </span>
  );
}

// is this fixed element removed (so its handle must not stay behind)
export function useIsGone(id) {
  const { blocks, defaultLang } = useContext(ContentContext);
  return blocks[`${id}.gone`]?.[defaultLang] === "1";
}
const Trash = ({ onClick }) => (
  <button type="button" className="item-trash" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }} title={tx("Verwijderen")} aria-label={tx("Verwijderen")}><IconTrash width={22} height={22} /></button>
);

// <EditableText id="home.title" as="h1" fallback="Standaardtekst" />
// Shows the stored text for the visitor's language; in edit mode the text can be changed in place.
// With `rich`, the text can also be edited in a popup WYSIWYG editor (headings, lists, links, images).
// typed in another language only: still better than an empty place
const anyText = (b) => b && Object.values(b).find((v) => typeof v === "string" && v.trim() && !v.startsWith("media:"));

export function EditableText({ id, as: Tag = "p", fallback = "", fallbacks, className, rich = false, removable = true }) {
  const [gone, setGone] = useGone(id);
  const { blocks, setBlock, defaultLang } = useContext(ContentContext);
  const { editing } = useSession();
  const lang = useLang();
  const ref = useRef(null);
  const richRef = useRef(null);
  const [status, setStatus] = useState("");
  const [popup, setPopup] = useState(false);
  // stored text for this language, else built-in default for it, else the default language
  const text = blocks[id]?.[lang] ?? fallbacks?.[lang] ?? blocks[id]?.[defaultLang] ?? fallbacks?.[defaultLang] ?? anyText(blocks[id]) ?? fallback;
  const isHtml = text.startsWith("html:");

  // keep the DOM in sync when not typing
  useEffect(() => {
    if (ref.current && !isHtml && document.activeElement !== ref.current) ref.current.innerText = text;
  }, [text, editing, isHtml, gone]); // gone: the element is made again after an undo

  // formatted text is edited right in the field too; saved when you leave it
  useEffect(() => {
    if (richRef.current && isHtml && document.activeElement !== richRef.current) richRef.current.innerHTML = toDisplay(text.slice(5));
  }, [text, editing, isHtml, gone]);
  async function saveRich() {
    const html = toStored(richRef.current.innerHTML);
    if (html === text.slice(5)) return;
    setStatus("saving");
    try { await put({ html: true, text: html }); setStatus("saved"); setTimeout(() => setStatus(""), 1500); }
    catch (e) { setStatus("error"); (await alertDialog(errorText(e))); richRef.current.innerHTML = toDisplay(text.slice(5)); }
  }

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

  if (removable && gone) return null; // removed with the trash icon: gone from the page; only the undo arrow (top right) brings it back
  if (!editing) return display;
  return (
    <div className="text-edit">
      {removable && <Trash onClick={() => setGone("1", tx("Onderdeel verwijderd"))} />}
      <LoremButton onInsert={(t) => put(isHtml || rich ? { html: true, text: t.split("\n\n").map((x) => `<p>${x}</p>`).join("") } : { text: t })} />
      {isHtml ? <div ref={richRef} className={`editable-rich rich-text ${className || ""} ${status}`} contentEditable suppressContentEditableWarning spellCheck onBlur={saveRich} title={tx("Bewerken ({0})", lang)} /> : (
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

// Edit mode on/off: a pencil icon (no text). Used in the header of the website and of the dashboard (the private part).
export function EditModeSwitch() {
  const { canEdit, editMode, setEditMode } = useSession();
  if (!canEdit) return null;
  const label = editMode ? tx("Bewerkmodus uitzetten") : tx("Website in bewerkmodus zetten");
  return (
    <button type="button" className={`icon-btn edit-toggle${editMode ? " on" : ""}`} onClick={() => setEditMode(!editMode)} aria-pressed={editMode} aria-label={label} title={label}>
      <IconEdit width={20} height={20} />
    </button>
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
      {removable && <button type="button" className="img-edit-btn img-del-btn" onClick={(e) => { e.preventDefault(); e.stopPropagation(); remove(); }} title={tx("Afbeelding verwijderen")} aria-label={tx("Afbeelding verwijderen")}><IconTrash width={22} height={22} /></button>}
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
  const [tab, setTab] = useState("look");
  const [pick, setPick] = useState(false);
  const hv = st.hover || {};
  const setHv = (patch) => onChange({ hover: patch === null ? "" : { ...hv, ...patch } });
  return (
    <div className="pb-stylebox img-style-panel" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
      <strong>{tx("Afbeeldingsinstellingen")}</strong>
      <div className="pb-tabs" role="tablist">{[["look", "Weergave"], ["hover", "Mouse-over"]].map(([k, l]) => <button type="button" role="tab" aria-selected={tab === k} key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{tx(l)}</button>)}</div>
      {tab === "hover" && <>
        <div className="pb-stylerow"><span>{tx("Effect")}</span>
          <span className="pb-seg">{[["", "Geen"], ["opacity", "Doorzichtigheid"], ["swap", "Andere afbeelding of video"]].map(([k, l]) => <button type="button" key={k} className={(hv.mode || "") === k ? "on" : ""} onClick={() => setHv(k ? { mode: k } : null)}>{tx(l)}</button>)}</span></div>
        {hv.mode === "opacity" && <div className="pb-stylerow"><span>{tx("Doorzichtigheid")}</span>
          <input type="range" min={0} max={100} step={5} value={hv.opacity ?? 60} onChange={(e) => setHv({ opacity: Number(e.target.value) })} style={{ width: 160 }} /><small className="muted">{hv.opacity ?? 60}%</small></div>}
        {hv.mode === "swap" && <div className="pb-stylerow"><span>{tx("Bij mouse-over")}</span>
          {hv.url && (hv.kind === "video" ? <video src={mediaUrl(hv.url)} muted style={{ height: 40 }} /> : /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(hv.url)} alt="" style={{ height: 40 }} />)}
          <button type="button" className="btn sm" onClick={() => setPick("image")}>{tx("Afbeelding kiezen")}</button>
          <button type="button" className="btn sm" onClick={() => setPick("video")}>{tx("Video kiezen")}</button></div>}
        {pick && <MediaPicker kind={pick} onClose={() => setPick(false)} onPick={(i) => { setHv({ url: i.url, kind: pick }); setPick(false); }} />}
      </>}
      {tab === "look" && <>
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
      </>}
    </div>
  );
}

// hover (mouse-over): lower opacity, or show another image / video over the picture
const hoverWrap = (hv, img) => {
  if (!hv?.mode) return img;
  if (hv.mode === "opacity") return <span className="ei-hov h-opacity" style={{ "--hov-o": (hv.opacity ?? 60) / 100 }}>{img}</span>;
  if (!hv.url) return img;
  return <span className="ei-hov">{img}{hv.kind === "video"
    ? <video className="ei-over" src={mediaUrl(hv.url)} muted loop playsInline autoPlay />
    : /* eslint-disable-next-line @next/next/no-img-element */ <img className="ei-over" src={mediaUrl(hv.url)} alt="" />}</span>;
};

// <EditableImage id="home.hero" fallback={<Logo />} />: image stored as a content block
export function EditableImage({ id, fallback = null, alt = "", className = "", removable = true }) {
  const [gone, setGone] = useGone(id);
  const { blocks, setBlock, defaultLang } = useContext(ContentContext);
  const { editing } = useSession();
  const url = blocks[id]?.["*"];
  const placement = blocks[`${id}.pl`]?.[defaultLang]; // how it sits: "align:size", chosen with every picture (stored with the page texts)
  const st = parseSt(blocks[`${id}.st`]?.[defaultLang]); // own settings: {align, w, opacity, radius}
  const [panel, setPanel] = useState(false);
  const anchorRef = useRef(null);
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
  if (removable && gone) return null;
  return (
    <div ref={anchorRef} className={`ei-wrap${st.align ? ` al al-${st.align}` : ""}${st.w ? " sized" : ""}`}>
      <div className={`ei-inner${st.w ? " sized" : ""}`} style={hasSt ? css.inner : undefined}>
        <ImageEdit target={`block:${id}`} placement={placement} onPlace={url ? place : undefined} removable={!!url}
          extra={editing && <>{grip}{removable && <Trash onClick={() => setGone("1", tx("Onderdeel verwijderd"))} />}<button type="button" className={`img-edit-btn img-set-btn${panel ? " on" : ""}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPanel(!panel); }} title={tx("Afbeeldingsinstellingen")} aria-label={tx("Afbeeldingsinstellingen")} aria-expanded={panel}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>
          </button></>}>
          {url ? hoverWrap(st.hover, /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(url)} alt={alt} className={className} style={{ ...(placement && !st.w ? placeStyle(placement) : {}), ...(hasSt ? { width: "100%", height: "auto", opacity: st.opacity !== undefined ? st.opacity / 100 : undefined, borderRadius: st.radius !== undefined ? `${st.radius}px` : undefined } : {}) }} />) : fallback}
        </ImageEdit>
        {editing && panel && <FloatPanel anchor={anchorRef}><ImageStylePanel st={st} onChange={change} /></FloatPanel>}
      </div>
    </div>
  );
}
