"use client";

import { tx } from "../lib/t";
import { confirmDialog } from "../lib/dialog";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { mediaUrl } from "../lib/api";
import MediaPicker from "./MediaPicker";
import { api } from "../lib/api";
import { useModule } from "./Modules";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
// images are stored with relative /media/ paths; show them via the API origin while editing
export const toDisplay = (html) => html.replaceAll('src="/media/', `src="${API}/media/`);
export const toStored = (html) => html.replaceAll(`src="${API}/media/`, 'src="/media/');

const escapeHtml = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const plainToHtml = (t) => t.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");

// WYSIWYG editor in a popup. onSave(html) must return a promise; onPlain(text) saves as plain text.
function RichEditorInner({ initialHtml, title = tx("Tekst bewerken"), onSave, onPlain, onClose }) {
  const area = useRef(null);
  const saved = useRef(null);
  const [link, setLink] = useState(null); // null | url string while the link field is open
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const mediaOn = useModule("media");
  const [error, setError] = useState("");
  const objOn = useModule("sysobjects");
  const [objects, setObjects] = useState(null); // null = picker closed

  async function openObjects() {
    saveSel();
    try { setObjects(await api("/sysobjects/")); } catch { setObjects([]); }
  }
  function insertObject(o) {
    setObjects(null);
    area.current.focus();
    restoreSel();
    document.execCommand("insertHTML", false, `<div data-sysobject="${o.slug}"></div><p><br></p>`);
  }

  useEffect(() => {
    area.current.innerHTML = toDisplay(initialHtml || "<p><br></p>");
    document.execCommand("defaultParagraphSeparator", false, "p");
    area.current.focus();
  }, [initialHtml]);

  const cmd = (name, value = null) => { area.current.focus(); document.execCommand(name, false, value); };
  const keep = (e) => e.preventDefault(); // toolbar clicks must not steal the selection
  const saveSel = () => { const s = window.getSelection(); if (s.rangeCount) saved.current = s.getRangeAt(0).cloneRange(); };
  const restoreSel = () => { const s = window.getSelection(); s.removeAllRanges(); if (saved.current) s.addRange(saved.current); };

  function applyLink() {
    area.current.focus();
    restoreSel();
    if (link) {
      const url = /^(https?:\/\/|mailto:|tel:|\/)/i.test(link) ? link : `https://${link}`;
      document.execCommand("createLink", false, url);
      area.current.querySelectorAll(`a[href="${url}"]`).forEach((a) => a.setAttribute("target", "_blank"));
    } else document.execCommand("unlink");
    setLink(null);
  }

  function insertImage(item) {
    setPicker(false);
    area.current.focus();
    restoreSel();
    document.execCommand("insertHTML", false, `<img src="${mediaUrl(item.url)}" alt="${escapeHtml(item.name)}" data-media="${item.id}" style="max-width:100%">`);
  }

  async function save(plain) {
    setBusy(true);
    setError("");
    try {
      if (plain) await onPlain(area.current.innerText.trim());
      else await onSave(toStored(area.current.innerHTML));
      onClose();
    } catch (e) {
      setError(e.message || tx("Opslaan mislukt."));
      setBusy(false);
    }
  }

  const B = ({ c, v, label, title: t }) => <button type="button" className="rt-btn" onMouseDown={keep} onClick={() => cmd(c, v)} title={t || label}>{label}</button>;

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="card modal rich-modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <div className="rt-toolbar" onMouseDown={keep}>
          <select onChange={(e) => { cmd("formatBlock", e.target.value); e.target.value = ""; }} defaultValue="" aria-label={tx("Opmaak")}>
            <option value="" disabled>{tx("Opmaak")}</option>
            <option value="p">{tx("Alinea")}</option><option value="h2">{tx("Kop 1")}</option><option value="h3">{tx("Kop 2")}</option><option value="h4">{tx("Kop 3")}</option><option value="h5">{tx("Kop 4")}</option>
            <option value="h4">{tx("Kop 3")}</option><option value="blockquote">{tx("Citaat")}</option>
          </select>
          <B c="bold" label={<b>B</b>} title={tx("Vet")} />
          <B c="italic" label={<i>I</i>} title={tx("Cursief")} />
          <B c="underline" label={<u>U</u>} title={tx("Onderstreept")} />
          <B c="strikeThrough" label={<s>S</s>} title={tx("Doorgestreept")} />
          <span className="rt-sep" />
          <B c="insertUnorderedList" label={tx("• Lijst")} />
          <B c="insertOrderedList" label={tx("1. Lijst")} />
          <span className="rt-sep" />
          <B c="justifyLeft" label={tx("Links")} /><B c="justifyCenter" label={tx("Midden")} /><B c="justifyRight" label={tx("Rechts")} />
          <span className="rt-sep" />
          <button type="button" className="rt-btn" onMouseDown={keep} onClick={() => { saveSel(); setLink(""); }}>{tx("Link")}</button>
          {mediaOn && <button type="button" className="rt-btn" onMouseDown={keep} onClick={() => { saveSel(); setPicker(true); }}>{tx("Media")}</button>}
          {objOn && <button type="button" className="rt-btn" onMouseDown={keep} onClick={openObjects}>{tx("Systeemobject")}</button>}
          <B c="insertHorizontalRule" label={tx("Lijn")} />
          <span className="rt-sep" />
          <B c="undo" label="↶" title={tx("Ongedaan maken")} /><B c="redo" label="↷" title={tx("Opnieuw")} />
          <B c="removeFormat" label={tx("Opmaak wissen")} />
        </div>
        {link !== null && (
          <div className="rt-link">
            <input autoFocus placeholder="https://… (leeg laten om de link te verwijderen)" value={link} onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyLink()} />
            <button type="button" className="btn primary" onClick={applyLink}>{tx("Toepassen")}</button>
            <button type="button" className="btn" onClick={() => setLink(null)}>{tx("Annuleren")}</button>
          </div>
        )}
        <div ref={area} className="rt-area rich-text" contentEditable suppressContentEditableWarning spellCheck />
        {error && <div className="alert">{error}</div>}
        <div className="row" style={{ justifyContent: "space-between" }}>
          <button type="button" className="btn" disabled={busy} onClick={async () => (await confirmDialog(tx("Alle opmaak verwijderen en als gewone tekst opslaan?"), { danger: true })) && save(true)}>{tx("Opslaan als gewone tekst")}</button>
          <span className="row">
            <button type="button" className="btn" onClick={onClose}>{tx("Annuleren")}</button>
            <button type="button" className="btn primary" disabled={busy} onClick={() => save(false)}>{busy ? tx("Opslaan…") : tx("Opslaan")}</button>
          </span>
        </div>
        {objects && (
          <div className="overlay" onMouseDown={() => setObjects(null)}>
            <div className="card modal" onMouseDown={(e) => e.stopPropagation()}>
              <h2 style={{ margin: 0 }}>{tx("Systeemobject invoegen")}</h2>
              <div className="obj-pick">
                {objects.map((o) => (
                  <button type="button" key={o.slug} className="btn" onClick={() => insertObject(o)}>
                    <strong>{o.names?.[Object.keys(o.names || {})[0]] || o.data?.name || o.slug}</strong> <small className="muted">{o.kind === "donation" ? tx("Donatie") : (o.kind === "plugin" || o.kind === "plugin_item") ? tx("Plugin") : tx("Abonnement")}</small>
                  </button>
                ))}
                {!objects.length && <p className="muted">{tx("Er zijn nog geen systeemobjecten. Zet bij een donatie-actie of abonnement het vinkje Systeemobject aan.")}</p>}
              </div>
              <div className="row"><button type="button" className="btn" onClick={() => setObjects(null)}>{tx("Annuleren")}</button></div>
            </div>
          </div>
        )}
        {picker && <MediaPicker onPick={insertImage} onClose={() => setPicker(false)} title={tx("Afbeelding invoegen")} />}
      </div>
    </div>
  );
}

// shown straight in the page body, so no block with its own stacking (a hero, a settings panel) can cover it
export default function RichEditor(props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(<RichEditorInner {...props} />, document.body) : null;
}
