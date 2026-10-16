"use client";

import { tx } from "../../../../lib/t";
import { confirmDialog, promptDialog } from "../../../../lib/dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import { api, errorText, mediaUrl } from "../../../../lib/api";
import { lvl } from "../../../../lib/perms";

const fmt = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default function Media() {
  const { user } = useAuth();
  const L = lvl(user, "media");
  const [data, setData] = useState({ items: [], s3_available: false });
  const [filter, setFilter] = useState({ kind: "", storage: "", q: "" });
  const [selected, setSelected] = useState([]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState("");
  const input = useRef(null);

  const load = useCallback(() => {
    const p = new URLSearchParams(Object.entries(filter).filter(([, v]) => v));
    return api(`/media/?${p}`).then((d) => { setData(d); setSelected((s) => s.filter((id) => d.items.some((i) => i.id === id))); })
      .catch((e) => setMsg({ ok: false, text: errorText(e) }));
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const items = data.items;
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allSelected = items.length > 0 && selected.length === items.length;

  async function run(label, fn) {
    setBusy(label);
    setMsg(null);
    try { await fn(); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy("");
    load();
  }

  const report = (r, okText) => setMsg({ ok: !r.errors?.length, text: [okText, ...(r.errors || [])].filter(Boolean).join(" ") });

  const upload = (e) => {
    const files = [...e.target.files];
    e.target.value = "";
    if (!files.length) return;
    run("upload", async () => {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      try {
        const r = await api("/media/upload/", { method: "POST", body: fd });
        report(r, `${r.items.length} bestand(en) geüpload.`);
      } catch (err) {
        setMsg({ ok: false, text: err.data?.errors?.join(" ") || errorText(err) });
      }
    });
  };
  const move = (ids, to) => run("move", async () => report(await api("/media/move/", { method: "POST", body: { ids, to } }), `Verplaatst naar ${to === "s3" ? "S3" : "lokaal"}.`));
  const remove = async (ids) => (await confirmDialog(tx("{0} bestand(en) definitief verwijderen?", ids.length), { danger: true })) && run("delete", async () => {
    report(await api("/media/delete/", { method: "POST", body: { ids } }), tx("Verwijderd."));
    setSelected([]);
  });
  const scan = () => run("scan", async () => setMsg({ ok: true, text: tx("{0} nieuw bestand(en) gevonden.", (await api("/media/scan/", { method: "POST" })).added) }));
  const rename = async (i) => { const name = (await promptDialog(tx("Nieuwe naam"), i.name)); if (name && name !== i.name) run("rename", () => api(`/media/${i.id}/`, { method: "PATCH", body: { name } })); };
  const copy = (url) => navigator.clipboard?.writeText(url.startsWith("http") ? url : mediaUrl(url));

  const s3Hint = data.s3_available ? "" : tx("Koppel eerst S3 bij Admin → API keys.");
  const sel = selected.length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{tx("Media")}</h1>
          <p className="muted" style={{ margin: 0 }}>{tx("Alle afbeeldingen en video's. Elk bestand staat op één plek: lokaal of op S3.")} {s3Hint}</p>
        </div>
        <div className="row">
          <input ref={input} type="file" accept="image/*,video/*" multiple hidden onChange={upload} />
          {L >= 2 && <button className="btn" onClick={scan} disabled={!!busy}>{tx("Lokale bestanden zoeken")}</button>}
          {L >= 2 && <button className="btn primary" onClick={() => input.current.click()} disabled={!!busy}>{busy === "upload" ? tx("Uploaden…") : tx("+ Uploaden")}</button>}
        </div>
      </div>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}

      <div className="card media-bar">
        <input style={{ maxWidth: 260 }} placeholder={tx("Zoek op naam…")} value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
        <select style={{ width: "auto" }} value={filter.kind} onChange={(e) => setFilter({ ...filter, kind: e.target.value })}>
          <option value="">{tx("Alles")}</option><option value="image">{tx("Afbeeldingen")}</option><option value="video">{tx("Video's")}</option>
        </select>
        <select style={{ width: "auto" }} value={filter.storage} onChange={(e) => setFilter({ ...filter, storage: e.target.value })}>
          <option value="">{tx("Overal")}</option><option value="local">{tx("Lokaal")}</option><option value="s3">S3</option>
        </select>
        <label className="check"><input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? [] : items.map((i) => i.id))} /> {tx("Alles selecteren")}</label>
        <span className="media-actions">
          <span className="muted">{tx("{0} geselecteerd", sel)}</span>
          <button className="btn sm" disabled={L < 2 || !sel || !data.s3_available || !!busy} title={s3Hint} onClick={() => move(selected, "s3")}>{tx("Naar S3")}</button>
          <button className="btn sm" disabled={L < 2 || !sel || !!busy} onClick={() => move(selected, "local")}>{tx("Naar lokaal")}</button>
          <button className="btn sm danger" disabled={L < 3 || !sel || !!busy} onClick={() => remove(selected)}>{tx("Verwijderen")}</button>
        </span>
      </div>

      <div className="media-grid big">
        {items.map((i) => (
          <div key={i.id} className={`media-card card ${selected.includes(i.id) ? "selected" : ""}`}>
            <label className="media-check"><input type="checkbox" checked={selected.includes(i.id)} onChange={() => toggle(i.id)} /></label>
            <div className="media-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {i.kind === "image" ? <img src={mediaUrl(i.url)} alt={i.name} loading="lazy" /> : <video src={mediaUrl(i.url)} preload="metadata" muted />}
            </div>
            <strong title={i.name}>{i.name}</strong>
            <span className="media-meta">
              <span className={`badge ${i.storage === "s3" ? "ok" : "off"}`} style={i.storage === "s3" ? {} : { background: "var(--bg)", color: "var(--muted)" }}>{i.storage === "s3" ? "S3" : tx("Lokaal")}</span>
              <span className="muted">{i.kind === "video" ? tx("Video") : tx("Afbeelding")} · {fmt(i.size)}</span>
            </span>
            {i.used_in.length > 0 && <small className="muted" title={i.used_in.join(", ")}>{tx("In gebruik:")} {i.used_in[0]}{i.used_in.length > 1 ? ` +${i.used_in.length - 1}` : ""}</small>}
            <span className="media-card-actions">
              <button className="btn sm" onClick={() => copy(i.url)}>{tx("Kopieer URL")}</button>
              {L >= 2 && <button className="btn sm" onClick={() => rename(i)}>{tx("Hernoem")}</button>}
              <button className="btn sm" disabled={L < 2 || !!busy || (i.storage === "local" && !data.s3_available)} title={i.storage === "local" ? s3Hint : ""}
                onClick={() => move([i.id], i.storage === "local" ? "s3" : "local")}>{i.storage === "local" ? tx("Naar S3") : tx("Naar lokaal")}</button>
              {L >= 3 && <button className="btn sm danger" onClick={() => remove([i.id])}>{tx("Verwijder")}</button>}
            </span>
          </div>
        ))}
        {!items.length && <p className="muted">{tx("Geen bestanden. Upload er een, of klik op \"Lokale bestanden zoeken\".")}</p>}
      </div>
    </>
  );
}
