// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../../../../lib/t";
import { confirmDialog, promptDialog } from "../../../../lib/dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import { api, errorText, mediaUrl } from "../../../../lib/api";
import { lvl } from "../../../../lib/perms";
import TagModal from "../../../../components/TagModal";
import { IconImage, IconGrid } from "../../../../components/Icons";
import Tabs from "../../../../components/Tabs";
import MediaViewEditor from "../../../../components/MediaViewEditor";

const fmt = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

// The media system objects (photo book, carousel, photo wall, slideshow): blocks for a page that show pictures of the library, with effects.
function MediaObjects({ canEdit, canManage, setMsg }) {
  const [views, setViews] = useState(null);
  const [used, setUsed] = useState({});
  const [edit, setEdit] = useState(undefined); // undefined = closed, null = new, object = editing
  const [busy, setBusy] = useState("");
  const [hasDemoImages, setHasDemoImages] = useState(false);
  const load = useCallback(() => {
    api("/mediaviews/demo/").then((c) => setHasDemoImages(c.images > 0 || c.views > 0)).catch(() => {});
    api("/mediaviews/").then(setViews).catch((e) => { setViews([]); setMsg({ ok: false, text: errorText(e) }); });
    api("/sysobjects/admin/").then((rows) => setUsed(Object.fromEntries(rows.filter((o) => o.kind === "media").map((o) => [o.data?.name, o.used_on || []])))).catch(() => {});
  }, [setMsg]);
  useEffect(() => { load(); }, [load]);
  const [make, setMake] = useState(null); // the question "how many example pictures": {count}
  async function demo(count) {
    setBusy("demo");
    try { const r = await api("/mediaviews/demo/", { method: "POST", body: { replace: true, count } }); setMsg({ ok: true, text: tx("{0} voorbeelden gemaakt: fotoboek, beeldcarrousel, fotomuur en diavoorstelling.", r.made) }); load(); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(""); setMake(null);
  }
  const [ask, setAsk] = useState(null); // the question "what to remove": {counts, pick}
  async function removeDemo() {
    try { const counts = await api("/mediaviews/demo/"); setAsk({ counts, pick: { views: counts.views > 0, images: counts.images > 0 } }); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  }
  async function doRemove() {
    const what = Object.keys(ask.pick).filter((k) => ask.pick[k]);
    if (!what.length) return;
    try {
      const r = await api("/mediaviews/demo/", { method: "POST", body: { remove: true, what } });
      setMsg({ ok: true, text: `${tx("Verwijderd")}: ${what.map((k) => `${k === "views" ? tx("voorbeeld-onderdelen") : tx("voorbeeldfoto's")} ${r.removed[k] ?? 0}`).join(", ")}.` });
      setAsk(null); load();
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); setAsk(null); }
  }
  async function remove(v) {
    if (!(await confirmDialog(tx("\"{0}\" verwijderen? Pagina's waar het op staat tonen het niet meer.", v.name), { danger: true }))) return;
    try { await api(`/mediaviews/${v.id}/`, { method: "DELETE" }); load(); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  }
  if (views === null) return <p className="muted">{tx("Laden…")}</p>;
  return (
    <>
      <p className="muted" style={{ margin: "0 0 1rem" }}>{tx("Blokken met foto's uit je bibliotheek die je in de bewerkmodus op een pagina zet: een fotoboek, een beeldcarrousel, een fotomuur of een diavoorstelling, elk met eigen effecten en instellingen.")}</p>
      {canEdit && <div className="row" style={{ marginBottom: "1rem" }}>
        <button className="btn primary" onClick={() => setEdit(null)}>{tx("+ Nieuw media-onderdeel")}</button>
      </div>}
      {!views.length && <p className="muted">{tx("Nog geen media-onderdelen. Maak er een, of maak demo-gegevens bij Standaard installaties.")}</p>}
      <div className="int-list">
        {views.map((v) => (
          <div className="card int-item" key={v.id}>
            <div style={{ display: "flex", gap: ".3rem" }}>{v.items.slice(0, 3).map((i, k) => /* eslint-disable-next-line @next/next/no-img-element */ <img key={k} src={mediaUrl(i.url)} alt="" style={{ width: 54, height: 54, objectFit: "cover", borderRadius: 8 }} />)}</div>
            <div className="int-main">
              <strong>{v.name} <span className="badge">{tx(v.type_label)}</span></strong>
              <span className="muted">{v.items.length} {tx("foto's")} · {tx("effect")}: {v.settings.hover || v.settings.transition} · {used[v.name]?.length ? `${tx("Op pagina")}: ${used[v.name].join(", ")}` : tx("Nog op geen enkele pagina")}</span>
            </div>
            <div className="int-actions">
              {canEdit && <button className="btn sm" onClick={() => setEdit(v)}>{tx("Bewerk")}</button>}
              {canManage && <button className="btn sm danger" onClick={() => remove(v)}>{tx("Verwijder")}</button>}
            </div>
          </div>
        ))}
      </div>
      {make && (
        <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setMake(null); }}>
          <div className="card modal" role="dialog" aria-label={tx("Voorbeelden maken")}>
            <h2 style={{ margin: 0 }}>{tx("Voorbeelden maken")}</h2>
            <p className="muted" style={{ margin: 0 }}>{tx("Je krijgt een fotoboek, een beeldcarrousel, een fotomuur en een diavoorstelling. Hoeveel voorbeeldfoto's moeten er gemaakt worden? De foto's komen in je mediabibliotheek met de tag demo.")}</p>
            <label>{tx("Aantal voorbeeldfoto's")}
              <span className="row" style={{ gap: ".6rem" }}><input type="range" min={4} max={48} step={4} value={make.count} onChange={(e) => setMake({ count: Number(e.target.value) })} style={{ flex: 1 }} disabled={!!busy} /><strong>{make.count}</strong></span>
            </label>
            <small className="muted">{tx("Er zijn 16 verschillende taferelen; daarna komen dezelfde in een andere kleur.")}</small>
            {busy && <div className="prog-wrap"><div className="prog-label">{tx("Foto's tekenen…")}</div><div className="prog ind"><div className="bar" /></div></div>}
            <div className="row"><button className="btn" onClick={() => setMake(null)} disabled={!!busy}>{tx("Annuleren")}</button><button className="btn primary" onClick={() => demo(make.count)} disabled={!!busy}>{busy ? tx("Bezig…") : tx("Maken")}</button></div>
          </div>
        </div>
      )}
      {ask && (
        <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setAsk(null); }}>
          <div className="card modal" role="dialog" aria-label={tx("Wat wil je verwijderen?")}>
            <h2 style={{ margin: 0 }}>{tx("Wat wil je verwijderen?")}</h2>
            {[["views", "Voorbeeld-onderdelen (fotoboek, carrousel ...)"], ["images", "Voorbeeldfoto's"]].map(([k, l]) => (
              <label key={k} className="check"><input type="checkbox" checked={!!ask.pick[k]} disabled={!ask.counts[k]} onChange={(e) => setAsk({ ...ask, pick: { ...ask.pick, [k]: e.target.checked } })} /> {tx(l)} <small className="muted">({ask.counts[k] || 0})</small></label>
            ))}
            <small className="muted">{tx("Je eigen foto's en media-onderdelen blijven altijd staan: alleen wat de voorbeelden hebben gemaakt kan worden verwijderd.")}</small>
            <div className="row"><button className="btn" onClick={() => setAsk(null)}>{tx("Annuleren")}</button><button className="btn danger" onClick={doRemove} disabled={!Object.values(ask.pick).some(Boolean)}>{tx("Verwijderen")}</button></div>
          </div>
        </div>
      )}
      {edit !== undefined && <MediaViewEditor view={edit} onClose={() => setEdit(undefined)} onSaved={load} />}
    </>
  );
}

export default function Media() {
  const { user } = useAuth();
  const L = lvl(user, "media");
  const [data, setData] = useState({ items: [], s3_available: false });
  const [area, setArea] = useState("library"); // tab: "library" (the files) | "system" (the system objects: blocks for pages such as the product overviews of the webshop)
  const [objCount, setObjCount] = useState(undefined);
  useEffect(() => { api("/mediaviews/").then((r) => setObjCount(r.length)).catch(() => setObjCount(undefined)); }, [area]);
  const [filter, setFilter] = useState({ kind: "", storage: "", q: "", tag: "" });
  const [userData, setUserData] = useState(false); // superuser only: also show files of members (profile photos, chat)
  const [tagFor, setTagFor] = useState(null); // ids whose tags are being edited
  const [queue, setQueue] = useState([]); // upload queue: {name, state: wait|busy|ok|err, text}
  const [uploadTags, setUploadTags] = useState("");
  const [over, setOver] = useState(false);
  const [selected, setSelected] = useState([]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState("");
  const input = useRef(null);

  const load = useCallback(() => {
    const p = new URLSearchParams(Object.entries({ ...filter, user_data: userData ? "1" : "" }).filter(([, v]) => v));
    return api(`/media/?${p}`).then((d) => { setData(d); setSelected((s) => s.filter((id) => d.items.some((i) => i.id === id))); })
      .catch((e) => setMsg({ ok: false, text: errorText(e) }));
  }, [filter, userData]);
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

  // Multi upload: files from the file picker or dropped anywhere on the page. Three at a time, each with its own status.
  const uploadFiles = async (list) => {
    const files = [...list];
    if (!files.length || L < 2) return;
    const start = queue.length;
    setQueue((q) => [...q, ...files.map((f) => ({ name: f.name, state: "wait", text: "" }))]);
    const mark = (n, patch) => setQueue((q) => q.map((x, k) => (k === start + n ? { ...x, ...patch } : x)));
    let next = 0;
    const worker = async () => {
      while (next < files.length) {
        const n = next++, f = files[n];
        if (!/^(image|video)\//.test(f.type)) { mark(n, { state: "err", text: tx("Alleen afbeeldingen en video's.") }); continue; }
        mark(n, { state: "busy" });
        const fd = new FormData();
        fd.append("files", f); fd.append("tags", uploadTags);
        try { const r = await api("/media/upload/", { method: "POST", body: fd }); mark(n, r.errors?.length ? { state: "err", text: r.errors.join(" ") } : { state: "ok" }); }
        catch (err) { mark(n, { state: "err", text: err.data?.errors?.join(" ") || errorText(err) }); }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    load();
  };
  const upload = (e) => { const files = [...e.target.files]; e.target.value = ""; uploadFiles(files); };
  const applyTags = async ({ add, remove }) => {
    const ids = tagFor; setTagFor(null);
    run("tags", async () => { const r = await api("/media/tags/", { method: "POST", body: { ids, add, remove } }); setMsg({ ok: true, text: tx("Tags bijgewerkt bij {0} bestand(en).", r.changed) }); });
  };
  const move = (ids, to) => run("move", async () => report(await api("/media/move/", { method: "POST", body: { ids, to } }), `Verplaatst naar ${to === "s3" ? "S3" : "lokaal"}.`));
  const remove = async (ids) => (await confirmDialog(tx("{0} bestand(en) definitief verwijderen?", ids.length), { danger: true })) && run("delete", async () => {
    report(await api("/media/delete/", { method: "POST", body: { ids } }), tx("Verwijderd."));
    setSelected([]);
  });
  const scan = () => run("scan", async () => setMsg({ ok: true, text: tx("{0} nieuw bestand(en) gevonden.", (await api("/media/scan/", { method: "POST" })).added) }));
  const rename = async (i) => { const name = (await promptDialog(tx("Nieuwe naam"), i.name)); if (name && name !== i.name) run("rename", () => api(`/media/${i.id}/`, { method: "PATCH", body: { name } })); };
  const copy = (url) => navigator.clipboard?.writeText(url.startsWith("http") ? url : mediaUrl(url));

  // S3 only exists for the system when it is linked and on (Admin -> API keys); otherwise nothing about S3 is shown
  const s3On = data.s3_available || data.items.some((i) => i.storage === "s3");
  const s3Hint = data.s3_available ? "" : tx("Koppel eerst S3 bij Admin → API keys.");
  const sel = selected.length;

  return (
    <>
      <div onDragOver={(e) => { if (L >= 2) { e.preventDefault(); setOver(true); } }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false); }}
        onDrop={(e) => { e.preventDefault(); setOver(false); uploadFiles(e.dataTransfer.files); }} className={`media-page ${over ? "over" : ""}`}>
      {over && <div className="media-drop-hint"><IconImage width={42} height={42} /><strong>{tx("Laat de bestanden los om te uploaden")}</strong></div>}
      <div className="page-head">
        <div>
          <h1>{tx("Media")}</h1>
          <p className="muted" style={{ margin: 0 }}>{s3On ? tx("Alle afbeeldingen en video's. Elk bestand staat op één plek: lokaal of op S3.") : tx("Alle afbeeldingen en video's van de website.")}</p>
        </div>
        <div className="row">
          <input ref={input} type="file" accept="image/*,video/*" multiple hidden onChange={upload} />
          {L >= 2 && <button className="btn" onClick={scan} disabled={!!busy}>{tx("Lokale bestanden zoeken")}</button>}
          {L >= 2 && <button className="btn primary" onClick={() => input.current.click()}>{tx("+ Uploaden")}</button>}
        </div>
      </div>
      <Tabs value={area} onChange={(k) => { setArea(k); setSelected([]); }}
        tabs={[["library", "Media", <IconImage key="m" />, data.total], ["system", "Systeemobjecten", <IconGrid key="s" />, objCount]]} />
      {area === "system" && msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}
      {area === "system" && <MediaObjects canEdit={L >= 2} canManage={L >= 3} setMsg={setMsg} />}
      {area === "library" && L >= 2 && (
        <div className="card media-upload">
          <div className="dropzone" role="button" tabIndex={0} onClick={() => input.current.click()} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current.click()}>
            <span>{tx("Sleep één of meer bestanden hierheen, of klik om te kiezen")}</span>
          </div>
          <label>{tx("Tags voor deze upload")} <small className="muted">{tx("gescheiden door komma's")}</small>
            <input value={uploadTags} onChange={(e) => setUploadTags(e.target.value)} placeholder={tx("bv. zomer, strand, logo")} />
          </label>
          {queue.length > 0 && (
            <div className="upq">
              {queue.slice(-12).map((q, k) => <div key={k} className={`upq-row ${q.state}`}><span className="grow">{q.name}</span><span className="muted">{q.state === "wait" ? tx("Wachten…") : q.state === "busy" ? tx("Uploaden…") : q.state === "ok" ? tx("Klaar") : q.text}</span></div>)}
              <button className="btn sm" onClick={() => setQueue([])}>{tx("Lijst wissen")}</button>
            </div>
          )}
        </div>
      )}
      {area === "library" && <>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}

      <div className="card media-bar">
        <input type="search" style={{ maxWidth: 260 }} placeholder={tx("Zoek op naam of tag…")} value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
        <select style={{ width: "auto" }} value={filter.kind} onChange={(e) => setFilter({ ...filter, kind: e.target.value })}>
          <option value="">{tx("Alles")}</option><option value="image">{tx("Afbeeldingen")}</option><option value="video">{tx("Video's")}</option>
        </select>
        {s3On && (
          <select style={{ width: "auto" }} value={filter.storage} onChange={(e) => setFilter({ ...filter, storage: e.target.value })}>
            <option value="">{tx("Overal")}</option><option value="local">{tx("Lokaal")}</option><option value="s3">S3</option>
          </select>
        )}
        <label className="check"><input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? [] : items.map((i) => i.id))} /> {tx("Alles selecteren")}</label>
        <span className="media-actions">
          <span className="muted">{tx("{0} geselecteerd", sel)}</span>
          {s3On && <button className="btn sm" disabled={L < 2 || !sel || !data.s3_available || !!busy} title={s3Hint} onClick={() => move(selected, "s3")}>{tx("Naar S3")}</button>}
          {s3On && <button className="btn sm" disabled={L < 2 || !sel || !!busy} onClick={() => move(selected, "local")}>{tx("Naar lokaal")}</button>}
          {L >= 2 && <button className="btn sm" disabled={!sel || !!busy} onClick={() => setTagFor(selected)}>{tx("Tags")}</button>}
          <button className="btn sm danger" disabled={L < 3 || !sel || !!busy} onClick={() => remove(selected)}>{tx("Verwijderen")}</button>
        </span>
      </div>

      {(data.tags?.length > 0 || filter.tag) && (
        <div className="chips media-tags">
          {filter.tag && <button className="chip active" onClick={() => setFilter({ ...filter, tag: "" })}>✕ {filter.tag}</button>}
          {data.tags.filter((t) => t.tag !== filter.tag).slice(0, 30).map((t) => <button key={t.tag} className="chip" onClick={() => setFilter({ ...filter, tag: t.tag })}>{t.tag} <small>{t.n}</small></button>)}
        </div>
      )}
      {data.can_user_data && (
        <label className="check sec-toggle" style={{ margin: ".5rem 0" }}>
          <span className="switch"><input type="checkbox" checked={userData} onChange={(e) => setUserData(e.target.checked)} /><span /></span>
          <span>{tx("Gebruikersgegevens tonen")} <small className="muted">{tx("Foto's en bestanden van gebruikers (profielfoto's, chat) staan niet in de bibliotheek, tenzij je dit als superuser aanzet.")}</small></span>
        </label>
      )}

      <div className="media-grid big">
        {items.map((i) => (
          <div key={i.id} className={`media-card card ${selected.includes(i.id) ? "selected" : ""}`}>
            <label className="media-check"><input type="checkbox" checked={selected.includes(i.id)} onChange={() => toggle(i.id)} /></label>
            <div className="media-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {i.kind === "image" ? <img src={mediaUrl(i.url)} alt={i.name} loading="lazy" /> : <video src={mediaUrl(i.url)} preload="metadata" muted />}
            </div>
            <strong title={i.name}>{i.name}</strong>
            {i.user_content && <span className="badge" title={tx("Bestand van een gebruiker")}>{tx("Gebruiker")}</span>}
            {(i.tags || []).length > 0 && <span className="chips" style={{ margin: 0 }}>{i.tags.map((t) => <button key={t} className="chip sm" onClick={() => setFilter({ ...filter, tag: t })}>{t}</button>)}</span>}
            <span className="media-meta">
              {s3On && <span className={`badge ${i.storage === "s3" ? "ok" : "off"}`} style={i.storage === "s3" ? {} : { background: "var(--bg)", color: "var(--muted)" }}>{i.storage === "s3" ? "S3" : tx("Lokaal")}</span>}
              <span className="muted">{i.kind === "video" ? tx("Video") : tx("Afbeelding")} · {fmt(i.size)}</span>
            </span>
            {i.used_in.length > 0 && <small className="muted" title={i.used_in.join(", ")}>{tx("In gebruik:")} {i.used_in[0]}{i.used_in.length > 1 ? ` +${i.used_in.length - 1}` : ""}</small>}
            <span className="media-card-actions">
              <button className="btn sm" onClick={() => copy(i.url)}>{tx("Kopieer URL")}</button>
              {L >= 2 && <button className="btn sm" onClick={() => rename(i)}>{tx("Hernoem")}</button>}
              {L >= 2 && <button className="btn sm" onClick={() => setTagFor([i.id])}>{tx("Tags")}</button>}
              {s3On && <button className="btn sm" disabled={L < 2 || !!busy || (i.storage === "local" && !data.s3_available)} title={i.storage === "local" ? s3Hint : ""}
                onClick={() => move([i.id], i.storage === "local" ? "s3" : "local")}>{i.storage === "local" ? tx("Naar S3") : tx("Naar lokaal")}</button>}
              {L >= 3 && <button className="btn sm danger" onClick={() => remove([i.id])}>{tx("Verwijder")}</button>}
            </span>
          </div>
        ))}
        {!items.length && <p className="muted">{tx("Geen bestanden. Upload er een, of klik op \"Lokale bestanden zoeken\".")}</p>}
      </div>
      {tagFor && <TagModal count={tagFor.length} known={(data.tags || []).map((t) => t.tag)} present={[...new Set(items.filter((i) => tagFor.includes(i.id)).flatMap((i) => i.tags || []))]} onApply={applyTags} onClose={() => setTagFor(null)} />}
      </>}
      </div>
    </>
  );
}
