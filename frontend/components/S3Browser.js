"use client";

import { Busy } from "./PageLoader";
import { tx } from "../lib/t";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorText } from "../lib/api";
import { confirmDialog, promptDialog } from "../lib/dialog";
import { IconBack, IconFolder } from "./Icons";

const size = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`);
const when = (d) => { try { return new Date(d).toLocaleString(); } catch { return ""; } };

// Popup file browser for the S3 link: look around, upload (drop files), make folders, open/download, delete.
export default function S3Browser({ integration, onClose }) {
  const base = `/admin/integrations/${integration.id}/s3`;
  const [path, setPath] = useState("");
  const [data, setData] = useState(null);
  const [sel, setSel] = useState([]); // paths of the ticked rows
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState("");
  const [over, setOver] = useState(false);
  const input = useRef(null);

  const load = useCallback(async (p = path, more = false) => {
    try {
      const r = await api(`${base}/list/?path=${encodeURIComponent(p)}${more && data?.next ? `&next=${encodeURIComponent(data.next)}` : ""}`);
      setData(more ? { ...r, folders: [...data.folders, ...r.folders], files: [...data.files, ...r.files] } : r);
      if (!more) setSel([]);
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  }, [base, path, data]);

  useEffect(() => { load(path); /* eslint-disable-next-line */ }, [path]);

  const run = async (label, fn) => {
    setBusy(label); setMsg(null);
    try { await fn(); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy("");
  };

  const upload = (files) => run("upload", async () => {
    if (!files?.length) return;
    const fd = new FormData();
    fd.append("path", path);
    [...files].forEach((f) => fd.append("files", f));
    const r = await api(`${base}/upload/`, { method: "POST", body: fd });
    setMsg({ ok: true, text: `${r.uploaded.length} ${tx("bestand(en) geüpload.")}` });
    await load(path);
  });
  const mkdir = async () => {
    const name = await promptDialog(tx("Naam van de nieuwe map"), "");
    if (!name) return;
    run("mkdir", async () => { await api(`${base}/mkdir/`, { method: "POST", body: { path, name } }); await load(path); });
  };
  const remove = async () => {
    if (!(await confirmDialog(tx("{0} onderdeel/onderdelen definitief verwijderen van S3? Mappen worden met alles erin gewist.", sel.length), { danger: true }))) return;
    const folders = (data?.folders || []).filter((f) => sel.includes(f.path)).map((f) => f.path);
    run("delete", async () => { await api(`${base}/delete/`, { method: "POST", body: { paths: sel, folders } }); await load(path); });
  };
  const open = (f, download) => run("open", async () => {
    const r = await api(`${base}/url/?path=${encodeURIComponent(f.path)}${download ? "&download=1" : ""}`);
    window.open(r.url, "_blank", "noopener");
  });
  const toggle = (p) => setSel((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]));
  const crumbs = path ? path.split("/") : [];

  return (
    <div className="overlay" onClick={onClose}>
      <div className="card modal s3b" onClick={(e) => e.stopPropagation()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files); }}>
        <div className="s3b-head">
          <h2>{tx("S3-bestanden")}: {integration.name}</h2>
          <button type="button" className="btn" onClick={onClose}>{tx("Sluiten")}</button>
        </div>
        <div className="s3b-bar">
          <div className="s3b-crumbs">
            {path && <button type="button" className="btn sm" onClick={() => setPath(crumbs.slice(0, -1).join("/"))} aria-label={tx("Omhoog")}><IconBack /></button>}
            <button type="button" className="s3b-crumb" onClick={() => setPath("")}>{data?.base ? `/${data.base}` : "/"}</button>
            {crumbs.map((c, i) => <span key={i}>/<button type="button" className="s3b-crumb" onClick={() => setPath(crumbs.slice(0, i + 1).join("/"))}>{c}</button></span>)}
          </div>
          <div className="s3b-actions">
            <button type="button" className="btn sm" onClick={mkdir} disabled={!!busy}>{tx("Nieuwe map")}</button>
            <button type="button" className="btn sm primary" onClick={() => input.current?.click()} disabled={!!busy}>{busy === "upload" ? tx("Uploaden…") : tx("Uploaden")}</button>
            <button type="button" className="btn sm danger" onClick={remove} disabled={!sel.length || !!busy}>{tx("Verwijderen")}{sel.length ? ` (${sel.length})` : ""}</button>
            <input ref={input} type="file" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
          </div>
        </div>
        {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
        <div className={`s3b-list${over ? " over" : ""}`}>
          {!data && <Busy />}
          {data && !data.folders.length && !data.files.length && <p className="muted s3b-empty">{tx("Deze map is leeg. Sleep bestanden hierheen om te uploaden.")}</p>}
          {data?.folders.map((f) => (
            <div className="s3b-row" key={f.path}>
              <input type="checkbox" checked={sel.includes(f.path)} onChange={() => toggle(f.path)} aria-label={f.name} />
              <button type="button" className="s3b-name" onClick={() => setPath(f.path)}><span className="s3b-ico"><IconFolder /></span>{f.name}</button>
              <span className="muted s3b-meta">{tx("map")}</span>
            </div>
          ))}
          {data?.files.map((f) => (
            <div className="s3b-row" key={f.path}>
              <input type="checkbox" checked={sel.includes(f.path)} onChange={() => toggle(f.path)} disabled={f.in_library} title={f.in_library ? tx("Staat in de mediabibliotheek: verwijder via Media") : ""} aria-label={f.name} />
              <button type="button" className="s3b-name" onClick={() => open(f)}>
                <span className="s3b-ico">{f.thumb ? <img src={f.thumb} alt="" loading="lazy" /> : <span className="s3b-file" />}</span>
                <span className="s3b-fn">{f.name}</span>{f.in_library && <span className="badge">{tx("bibliotheek")}</span>}
              </button>
              <span className="muted s3b-meta">{size(f.size)} · {when(f.modified)}</span>
              <button type="button" className="btn sm" onClick={() => open(f, true)}>{tx("Download")}</button>
            </div>
          ))}
          {data?.next && <div style={{ textAlign: "center", padding: ".6rem" }}><button type="button" className="btn sm" onClick={() => load(path, true)}>{tx("Meer laden")}</button></div>}
        </div>
        <p className="muted" style={{ margin: 0, fontSize: ".8rem" }}>{tx("Je ziet de map van de koppeling. Bestanden die de mediabibliotheek gebruikt zijn beveiligd tegen verwijderen.")}</p>
      </div>
    </div>
  );
}
