// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useRef, useState } from "react";
import { api, apiBase, apiUpload, downloadFile, errorText, getToken } from "../lib/api";
import { confirmDialog } from "../lib/dialog";
import { tx } from "../lib/t";
import { plainToHtml, toDisplay } from "./RichEditor";
import SmallEditor from "./SmallEditor";

const ACCEPT = "image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.txt,.csv,.rtf,.md";
const size = (n) => (n >= 2 ** 20 ? `${(n / 2 ** 20).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const when = (iso) => new Date(iso).toLocaleString();
const PANEL = { background: "color-mix(in srgb, var(--blue, #2f7d5b) 6%, var(--card, #fff))", border: "1px solid color-mix(in srgb, var(--blue, #2f7d5b) 16%, var(--line, #e5e0d8))", borderRadius: "var(--radius, 12px)", padding: ".9rem 1rem" };

// A file of a note (the files are private: fetched with the login of the person, shown from memory). A picture is shown, a video starts after a click, a document is downloaded.
function NoteFile({ file, onDelete }) {
  const [url, setUrl] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true); setErr("");
    try {
      const res = await fetch(`${apiBase()}/api/notes/files/${file.id}/`, { headers: { Authorization: `Token ${getToken()}` } });
      if (!res.ok) throw new Error(tx("Het bestand is niet beschikbaar."));
      setUrl(URL.createObjectURL(await res.blob()));
    } catch (e) { setErr(e.message || tx("Het bestand is niet beschikbaar.")); }
    setBusy(false);
  };
  useEffect(() => { if (file.kind === "image") load(); return () => { if (url) URL.revokeObjectURL(url); }; }, [file.id]);  // eslint-disable-line react-hooks/exhaustive-deps
  const del = onDelete && <button type="button" className="btn sm danger" onClick={() => onDelete(file)} aria-label={`${tx("Verwijderen")}: ${file.name}`}>×</button>;
  const cap = <small className="muted" style={{ display: "flex", justifyContent: "space-between", gap: ".5rem", alignItems: "center" }}><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name} · {size(file.size)}</span>{del}</small>;
  const box = { border: "1px solid var(--line, #e5e0d8)", borderRadius: 10, padding: ".5rem", background: "var(--card, #fff)", display: "grid", gap: ".4rem", alignContent: "start" };
  if (file.kind === "image") return <figure style={{ ...box, margin: 0 }}>{url ? <img src={url} alt={file.name} style={{ width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 8 }} /> : <small className="muted">{err || tx("Laden…")}</small>}{cap}</figure>;
  if (file.kind === "video") return (
    <div style={{ ...box, gridColumn: "span 2" }}>
      {url ? <video src={url} controls preload="metadata" style={{ width: "100%", maxHeight: 260, borderRadius: 8, background: "#000" }} /> : <button type="button" className="btn" disabled={busy} onClick={load}>{busy ? tx("Bezig…") : tx("Video afspelen")}</button>}
      {err && <small className="bad">{err}</small>}{cap}
    </div>
  );
  return (
    <div style={box}>
      <button type="button" className="btn" onClick={() => downloadFile(`/notes/files/${file.id}/`, file.name).catch((e) => setErr(errorText(e)))}>{tx("Downloaden")}</button>
      {err && <small className="bad">{err}</small>}{cap}
    </div>
  );
}

export function NoteFiles({ files, onDelete }) {
  if (!files?.length) return null;
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: ".6rem" }}>{files.map((f) => <NoteFile key={f.id} file={f} onDelete={onDelete} />)}</div>;
}

export function NoteText({ body }) {
  const raw = String(body || "");
  const html = raw.startsWith("html:") ? raw.slice(5) : raw ? plainToHtml(raw) : "";
  return html ? <div className="rich-text" dangerouslySetInnerHTML={{ __html: toDisplay(html) }} /> : null;
}

// The form of a note: title, text, files, and whether the user may read it too (switch).
function NoteForm({ kind, targetId, note, onSaved, onCancel }) {
  const [f, setF] = useState({ title: note?.title || "", body: note?.body || "", visible: !!note?.visible });
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [pct, setPct] = useState(0);
  const pick = useRef(null);
  const save = async () => {
    setBusy(true); setErr(""); setPct(0);
    try {
      let n = note;
      n = note ? await api(`/notes/${note.id}/`, { method: "PATCH", body: f }) : await api("/notes/", { method: "POST", body: { kind, id: targetId, ...f } });
      if (files.length) {
        const fd = new FormData();
        files.forEach((x) => fd.append("files", x));
        const r = await apiUpload(`/notes/${n.id}/files/`, fd, setPct).catch((e) => { throw new Error(e?.data?.errors?.join(" ") || errorText(e)); });
        if (r.errors?.length) setErr(r.errors.join(" "));
      }
      onSaved();
    } catch (e) { setErr(e.message || errorText(e)); }
    setBusy(false);
  };
  return (
    <div style={{ ...PANEL, display: "grid", gap: ".7rem" }}>
      <label style={{ display: "grid", gap: ".25rem", fontWeight: 600 }}>{tx("Titel")}<input value={f.title} maxLength={200} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={tx("Bijvoorbeeld: Gesprek van 12 maart")} /></label>
      <div style={{ display: "grid", gap: ".25rem" }}><strong style={{ fontSize: ".85rem" }}>{tx("Tekst")}</strong><SmallEditor value={f.body} onChange={(v) => setF((x) => ({ ...x, body: v }))} minHeight={110} /></div>
      <div style={{ display: "grid", gap: ".4rem" }}>
        <strong style={{ fontSize: ".85rem" }}>{tx("Bestanden (foto's, video's en documenten)")}</strong>
        <div style={{ display: "flex", gap: ".6rem", alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" className="btn" onClick={() => pick.current?.click()}>{tx("Bestanden kiezen")}</button>
          <input ref={pick} type="file" multiple accept={ACCEPT} hidden onChange={(e) => { setFiles((cur) => [...cur, ...Array.from(e.target.files || [])]); e.target.value = ""; }} />
          {files.map((x, i) => <span key={i} className="badge" style={{ display: "inline-flex", gap: ".4rem", alignItems: "center" }}>{x.name} · {size(x.size)}<button type="button" className="link" aria-label={tx("Weghalen")} onClick={() => setFiles((c) => c.filter((_, j) => j !== i))}>×</button></span>)}
        </div>
        {note?.files?.length > 0 && <small className="muted">{tx("Bestanden die er al bij staan, verwijder je in de lijst van de notitie.")}</small>}
      </div>
      <label className="check sec-toggle" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: ".7rem", fontWeight: 500 }}>
        <span className="switch"><input type="checkbox" checked={f.visible} onChange={(e) => setF({ ...f, visible: e.target.checked })} /><span /></span>
        <span><strong>{kind === "user" ? tx("Zichtbaar voor de gebruiker") : tx("Zichtbaar voor de mensen van dit bedrijf")}</strong><br /><small className="muted">{f.visible ? (kind === "user" ? tx("De gebruiker leest deze notitie bij Mijn profiel → Notities.") : tx("De gekoppelde gebruikers lezen deze notitie bij Mijn profiel → Notities.")) : tx("Uit: de notitie is alleen voor intern gebruik.")}</small></span>
      </label>
      {err && <div className="alert">{err}</div>}
      {busy && files.length > 0 && <small className="muted">{tx("Uploaden")}… {pct}%</small>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: ".5rem" }}>
        {onCancel && <button type="button" className="btn" onClick={onCancel} disabled={busy}>{tx("Annuleren")}</button>}
        <button type="button" className="btn primary" onClick={save} disabled={busy || (!f.title.trim() && !f.body && !files.length && !note)}>{busy ? tx("Bezig…") : tx("Notitie opslaan")}</button>
      </div>
    </div>
  );
}

// The tab Notities of a user or a company (Admin): the notes with text, pictures, videos and documents, and whether the user may read them too.
export default function Notes({ kind, id }) {
  const [notes, setNotes] = useState(null);
  const [editing, setEditing] = useState(null);  // a note id, or "new"
  const [err, setErr] = useState("");
  const load = () => api(`/notes/?kind=${kind}&id=${id}`).then((r) => setNotes(r.notes)).catch((e) => setErr(errorText(e)));
  useEffect(() => { setNotes(null); setEditing(null); load(); }, [kind, id]);  // eslint-disable-line react-hooks/exhaustive-deps
  const remove = async (n) => { if (await confirmDialog(tx("Deze notitie met al zijn bestanden verwijderen?"), { title: tx("Notitie verwijderen"), okLabel: tx("Verwijderen"), danger: true })) { await api(`/notes/${n.id}/`, { method: "DELETE" }).catch((e) => setErr(errorText(e))); load(); } };
  const removeFile = async (f) => { if (await confirmDialog(tx("Dit bestand verwijderen?"), { title: f.name, okLabel: tx("Verwijderen"), danger: true })) { await api(`/notes/files/${f.id}/`, { method: "DELETE" }).catch((e) => setErr(errorText(e))); load(); } };
  if (err && !notes) return <div className="alert">{err}</div>;
  if (!notes) return <p className="muted">{tx("Laden…")}</p>;
  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      {err && <div className="alert">{err}</div>}
      {editing === "new" ? <NoteForm kind={kind} targetId={id} onSaved={() => { setEditing(null); load(); }} onCancel={() => setEditing(null)} />
        : <div><button type="button" className="btn primary" onClick={() => setEditing("new")}>{tx("+ Nieuwe notitie")}</button></div>}
      {!notes.length && editing !== "new" && <p className="muted" style={{ margin: 0 }}>{tx("Er zijn nog geen notities. Maak er een met tekst, foto's, video's of documenten.")}</p>}
      {notes.map((n) => editing === n.id ? <NoteForm key={n.id} kind={kind} targetId={id} note={n} onSaved={() => { setEditing(null); load(); }} onCancel={() => setEditing(null)} /> : (
        <article key={n.id} style={{ ...PANEL, display: "grid", gap: ".6rem", background: "var(--card, #fff)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: ".6rem", flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ minWidth: 0 }}>
              <strong>{n.title || tx("Notitie")}</strong><br />
              <small className="muted">{when(n.created_at)}{n.by ? ` · ${n.by}` : ""}</small>
            </div>
            <span style={{ display: "inline-flex", gap: ".4rem", alignItems: "center", flexWrap: "wrap" }}>
              <span className={`badge${n.visible ? " ok" : ""}`}>{n.visible ? (kind === "user" ? tx("Zichtbaar voor de gebruiker") : tx("Zichtbaar voor het bedrijf")) : tx("Intern")}</span>
              <button type="button" className="btn sm" onClick={() => setEditing(n.id)}>{tx("Bewerken")}</button>
              <button type="button" className="btn sm danger" onClick={() => remove(n)}>{tx("Verwijderen")}</button>
            </span>
          </div>
          <NoteText body={n.body} />
          <NoteFiles files={n.files} onDelete={removeFile} />
        </article>
      ))}
    </div>
  );
}
