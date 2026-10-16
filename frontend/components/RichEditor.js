"use client";

import { useEffect, useRef, useState } from "react";
import { mediaUrl } from "../lib/api";
import MediaPicker from "./MediaPicker";
import { useModule } from "./Modules";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
// images are stored with relative /media/ paths; show them via the API origin while editing
export const toDisplay = (html) => html.replaceAll('src="/media/', `src="${API}/media/`);
const toStored = (html) => html.replaceAll(`src="${API}/media/`, 'src="/media/');

const escapeHtml = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const plainToHtml = (t) => t.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");

// WYSIWYG editor in a popup. onSave(html) must return a promise; onPlain(text) saves as plain text.
export default function RichEditor({ initialHtml, title = "Tekst bewerken", onSave, onPlain, onClose }) {
  const area = useRef(null);
  const saved = useRef(null);
  const [link, setLink] = useState(null); // null | url string while the link field is open
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const mediaOn = useModule("media");
  const [error, setError] = useState("");

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
      setError(e.message || "Opslaan mislukt.");
      setBusy(false);
    }
  }

  const B = ({ c, v, label, title: t }) => <button type="button" className="rt-btn" onMouseDown={keep} onClick={() => cmd(c, v)} title={t || label}>{label}</button>;

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="card modal rich-modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <div className="rt-toolbar" onMouseDown={keep}>
          <select onChange={(e) => { cmd("formatBlock", e.target.value); e.target.value = ""; }} defaultValue="" aria-label="Opmaak">
            <option value="" disabled>Opmaak</option>
            <option value="p">Alinea</option><option value="h2">Kop 1</option><option value="h3">Kop 2</option>
            <option value="h4">Kop 3</option><option value="blockquote">Citaat</option>
          </select>
          <B c="bold" label={<b>B</b>} title="Vet" />
          <B c="italic" label={<i>I</i>} title="Cursief" />
          <B c="underline" label={<u>U</u>} title="Onderstreept" />
          <B c="strikeThrough" label={<s>S</s>} title="Doorgestreept" />
          <span className="rt-sep" />
          <B c="insertUnorderedList" label="• Lijst" />
          <B c="insertOrderedList" label="1. Lijst" />
          <span className="rt-sep" />
          <B c="justifyLeft" label="Links" /><B c="justifyCenter" label="Midden" /><B c="justifyRight" label="Rechts" />
          <span className="rt-sep" />
          <button type="button" className="rt-btn" onMouseDown={keep} onClick={() => { saveSel(); setLink(""); }}>Link</button>
          {mediaOn && <button type="button" className="rt-btn" onMouseDown={keep} onClick={() => { saveSel(); setPicker(true); }}>Afbeelding</button>}
          <B c="insertHorizontalRule" label="Lijn" />
          <span className="rt-sep" />
          <B c="undo" label="↶" title="Ongedaan maken" /><B c="redo" label="↷" title="Opnieuw" />
          <B c="removeFormat" label="Opmaak wissen" />
        </div>
        {link !== null && (
          <div className="rt-link">
            <input autoFocus placeholder="https://… (leeg laten om de link te verwijderen)" value={link} onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyLink()} />
            <button type="button" className="btn primary" onClick={applyLink}>Toepassen</button>
            <button type="button" className="btn" onClick={() => setLink(null)}>Annuleren</button>
          </div>
        )}
        <div ref={area} className="rt-area rich-text" contentEditable suppressContentEditableWarning spellCheck />
        {error && <div className="alert">{error}</div>}
        <div className="row" style={{ justifyContent: "space-between" }}>
          <button type="button" className="btn" disabled={busy} onClick={() => confirm("Alle opmaak verwijderen en als gewone tekst opslaan?") && save(true)}>Opslaan als gewone tekst</button>
          <span className="row">
            <button type="button" className="btn" onClick={onClose}>Annuleren</button>
            <button type="button" className="btn primary" disabled={busy} onClick={() => save(false)}>{busy ? "Opslaan…" : "Opslaan"}</button>
          </span>
        </div>
        {picker && <MediaPicker onPick={insertImage} onClose={() => setPicker(false)} title="Afbeelding invoegen" />}
      </div>
    </div>
  );
}
