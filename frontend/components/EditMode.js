"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { api, errorText, mediaUrl } from "../lib/api";
import MediaPicker from "./MediaPicker";
import { useModule } from "./Modules";
import RichEditor, { plainToHtml, toDisplay } from "./RichEditor";
import { useSession } from "./Session";

const ContentContext = createContext({ blocks: {}, setBlock: () => {}, defaultLang: "nl", languages: [] });

// Editable website texts, loaded on the server and updated locally after a save
export function ContentProvider({ initial, defaultLang, languages, children }) {
  const [blocks, setBlocks] = useState(initial || {});
  useEffect(() => setBlocks(initial || {}), [initial]); // after router.refresh()
  const setBlock = (key, lang, text) => setBlocks((b) => ({ ...b, [key]: { ...b[key], [lang]: text } }));
  return <ContentContext.Provider value={{ blocks, setBlock, defaultLang, languages }}>{children}</ContentContext.Provider>;
}

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
      alert(errorText(e));
      ref.current.innerText = text;
    }
  }

  const display = isHtml ? (
    <div className={`rich-text ${className || ""}`} dangerouslySetInnerHTML={{ __html: toDisplay(text.slice(5)) }} />
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
          title={`Bewerken (${lang})`}
        />
      )}
      {rich && <button type="button" className="img-edit-btn" onClick={() => setPopup(true)}>✎ Uitgebreid</button>}
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
    <label className="edit-switch" title="Website in bewerkmodus zetten">
      <span className="switch">
        <input type="checkbox" checked={editMode} onChange={(e) => setEditMode(e.target.checked)} />
        <span />
      </span>
      <span>Bewerken</span>
    </label>
  );
}

export function EditBanner() {
  const { editing } = useSession();
  if (!editing) return null;
  return <div className="edit-banner">Bewerkmodus aan: klik op een tekst met stippellijn om hem te wijzigen. Opslaan gebeurt automatisch.</div>;
}

// Edit mode: wrap any image so a content editor can swap it from the media library.
// target: "block:<key>" | "asset:<slot>" | "photo:<id>"
export function ImageEdit({ target, children, className = "" }) {
  const { editing } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const mediaOn = useModule("media");
  if (!editing || !mediaOn) return children;

  async function pick(item) {
    try {
      await api("/media/replace/", { method: "POST", body: { target, media_id: item?.id ?? null } });
      setOpen(false);
      router.refresh();
    } catch (e) { alert(errorText(e)); }
  }
  return (
    <span className={`img-edit ${className}`}>
      {children}
      <button type="button" className="img-edit-btn" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }} title="Afbeelding wijzigen">✎ Wijzig</button>
      {open && <MediaPicker onPick={pick} onClose={() => setOpen(false)} />}
    </span>
  );
}

// <EditableImage id="home.hero" fallback={<Logo />} />: image stored as a content block
export function EditableImage({ id, fallback = null, alt = "", className = "" }) {
  const { blocks } = useContext(ContentContext);
  const url = blocks[id]?.["*"];
  return (
    <ImageEdit target={`block:${id}`}>
      {url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(url)} alt={alt} className={className} /> : fallback}
    </ImageEdit>
  );
}
