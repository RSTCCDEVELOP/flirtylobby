// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useCallback, useEffect, useState } from "react";
import Tabs from "./Tabs";
import { api, errorText } from "../lib/api";
import { confirmDialog } from "../lib/dialog";
import { tx } from "../lib/t";

const NAME = { plugins: "plugin", themas: "thema", languages: "taal" };
const STATE = { new: ["Nieuw", ""], update: ["Update beschikbaar", "warn"], current: ["Geïnstalleerd", "ok"], bundle: ["Bundel", ""] };

// a small picture of a theme (library): the colours, the font and the corners, in the light and the dark stand
function ThemePreview({ p }) {
  const one = (m, c) => (
    <span className="res-tp" style={{ background: c.page, borderColor: c.line, color: c.text, borderRadius: Math.min(14, Number(p.radius) || 8) }}>
      <span className="res-tp-bar" style={{ background: c.card, borderColor: c.line }}><i style={{ background: p.primary }} /><i style={{ background: c.line }} /><i style={{ background: c.line }} /></span>
      <span className="res-tp-body">
        <strong style={{ fontFamily: p.font ? `"${p.font}", system-ui, sans-serif` : undefined }}>{p.font || "Aa"}</strong>
        <span className="res-tp-line" style={{ background: c.muted }} />
        <span className="res-tp-row"><span className="res-tp-btn" style={{ background: p.primary, borderRadius: Math.min(10, Number(p.radius) || 8) }} /><span className="res-tp-dot" style={{ background: p.secondary }} /></span>
        <span className="res-tp-card" style={{ background: c.card, borderColor: c.line, borderRadius: Math.min(10, Number(p.radius) || 8) }} />
      </span>
    </span>
  );
  return <span className="res-tprev" aria-hidden="true">{p.mode !== "dark" && one("light", p.light)}{p.mode !== "light" && one("dark", p.dark)}</span>;
}

// The themes of the library shown right on the page, each with its picture: choose what to add (or update) with one click
export function ThemeGallery({ onChanged, canManage = false }) {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  const [q, setQ] = useState("");
  const [ai, setAi] = useState(false); // Claude is linked: themes can be made from a description
  const [mk, setMk] = useState(null); // the pop-up "make a theme": {prompt, mode, busy, err}
  const load = useCallback(() => api("/resource/").then((d) => setRows(d?.kinds?.themas || [])).catch(() => setRows([])), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (canManage) api("/content/ai/").then((r) => setAi(!!r.available)).catch(() => setAi(false)); }, [canManage]);
  if (!rows) return <p className="muted">{tx("Laden…")}</p>;
  const list = rows.filter((r) => !r.bundle && (!q.trim() || `${r.title} ${r.name} ${r.description}`.toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => ["update", "new", "current"].indexOf(a.state) - ["update", "new", "current"].indexOf(b.state) || a.title.localeCompare(b.title));
  if (!rows.some((r) => !r.bundle)) return null;
  const add = async (r) => {
    setBusy(r.name); setMsg(null);
    try { const d = await api("/resource/install/", { method: "POST", body: { kind: "themas", name: r.name } }); setMsg({ ok: true, text: tx("{0} is geïnstalleerd.", d.installed.join(", ")) }); await load(); onChanged?.(); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy("");
  };
  const remove = async (r) => {
    if (!(await confirmDialog(tx("Het thema {0} uit de bibliotheek verwijderen? Een thema dat al is geïnstalleerd blijft staan.", r.title), { danger: true }))) return;
    setBusy(r.name); setMsg(null);
    try { await api("/resource/theme-delete/", { method: "POST", body: { name: r.name } }); setMsg({ ok: true, text: tx("{0} is uit de bibliotheek verwijderd.", r.title) }); await load(); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy("");
  };
  const make = async () => {
    setMk((m) => ({ ...m, busy: true, err: "" }));
    try { const d = await api("/resource/theme-ai/", { method: "POST", body: { prompt: mk.prompt, mode: mk.mode } }); setMk(null); setMsg({ ok: true, text: tx("Het thema {0} staat in de bibliotheek. Kies Installeren om het te gebruiken.", d.name) }); await load(); }
    catch (e) { setMk((m) => ({ ...m, busy: false, err: errorText(e) })); }
  };
  return (
    <div className="stack-sm" style={{ marginTop: ".8rem" }}>
      <div className="row" style={{ justifyContent: "flex-start", gap: ".6rem", flexWrap: "wrap" }}>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Zoeken…")} style={{ maxWidth: "20rem" }} />
        {canManage && ai && <button type="button" className="btn" onClick={() => setMk({ prompt: "", mode: "", busy: false, err: "" })}>{tx("Thema maken met AI")}</button>}
      </div>
      {mk && (
        <div className="overlay" onClick={() => !mk.busy && setMk(null)}>
          <div className="card modal" style={{ width: "min(560px, 94vw)" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: 0 }}>{tx("Thema maken met AI")}</h2>
            <p className="muted" style={{ margin: 0 }}>{tx("Beschrijf de sfeer, de branche of de kleuren. Claude maakt er een thema van (kleuren in licht en donker, lettertype, hoeken, header en footer) en zet het in de bibliotheek.")}</p>
            <textarea rows={5} maxLength={1500} autoFocus value={mk.prompt} disabled={mk.busy} onChange={(e) => setMk({ ...mk, prompt: e.target.value })} placeholder={tx("Bijvoorbeeld: een warm en rustig thema voor een bloemenwinkel, zachte roze en groene tinten, met een elegant serif-lettertype")} />
            <label>{tx("Voor welke stand")}<select value={mk.mode} disabled={mk.busy} onChange={(e) => setMk({ ...mk, mode: e.target.value })}><option value="">{tx("Licht en donker")}</option><option value="light">{tx("Alleen licht")}</option><option value="dark">{tx("Alleen donker")}</option></select></label>
            {mk.err && <div className="alert">{mk.err}</div>}
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="btn" disabled={mk.busy} onClick={() => setMk(null)}>{tx("Annuleren")}</button>
              <button type="button" className="btn primary" disabled={mk.busy || mk.prompt.trim().length < 3} onClick={make}>{mk.busy ? tx("Claude ontwerpt…") : tx("Maken")}</button>
            </div>
          </div>
        </div>
      )}
      {msg && <div className={`alert ${msg.ok ? "ok" : ""}`}>{msg.text}</div>}
      <div className="res-gallery">
        {list.map((r) => (
          <div key={r.file} className="res-gcard">
            {r.preview && <ThemePreview p={r.preview} />}
            <strong>{r.title}</strong>
            {r.description && <small className="muted">{r.description}</small>}
            <div className="row" style={{ justifyContent: "space-between", gap: ".4rem" }}>
              <span className={`badge ${STATE[r.state][1]}`}>{tx(STATE[r.state][0])}</span>
              <span className="row" style={{ gap: ".4rem" }}>
                {canManage && <button type="button" className="btn sm danger" disabled={!!busy} onClick={() => remove(r)} title={tx("Uit de bibliotheek verwijderen")}>{tx("Verwijderen")}</button>}
                <button type="button" className={`btn sm ${r.state === "new" || r.state === "update" ? "primary" : ""}`} disabled={!!busy} onClick={() => add(r)}>{busy === r.name ? "…" : r.state === "update" ? tx("Updaten") : r.state === "current" ? tx("Opnieuw") : tx("Installeren")}</button>
              </span>
            </div>
          </div>
        ))}
        {!list.length && <p className="muted">{tx("Niets gevonden in de bibliotheek.")}</p>}
      </div>
    </div>
  );
}

// The library (folder resource/ in the product): add a plugin, theme or language without uploading a file, and update what is installed from there.
export function ResourceButtons({ kind, onChanged }) {
  const [lib, setLib] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(() => new Set()); // the names ticked in the pop-up
  const [prog, setProg] = useState(null); // the progress of an installation: {total, done, name}
  const load = useCallback(() => api("/resource/").then(setLib).catch(() => setLib(false)), []);
  useEffect(() => { load(); }, [load]);
  const rows = lib?.kinds?.[kind];
  if (lib === null) return null; // still loading
  if (!rows) return <small className="muted">{tx("De bibliotheek is niet te lezen (geen rechten, of de map resource ontbreekt op de server).")}</small>;
  if (!rows.length) return <small className="muted">{tx("De bibliotheek is leeg: zet de ondertekende zips in")} <code>{lib?.folder ? `${lib.folder}/${kind}` : `resource/${kind}`}</code></small>;
  const updates = rows.filter((r) => r.state === "update").length;
  const done = (text) => { setMsg({ ok: true, text }); load(); onChanged?.(); };
  const add = async (r) => {
    setBusy(r.name); setMsg(null); setProg({ total: 1, done: 0, name: r.title });
    try { const d = await api("/resource/install/", { method: "POST", body: { kind, name: r.name } }); setProg({ total: 1, done: 1, name: r.title }); done(tx("{0} is geïnstalleerd.", d.installed.join(", "))); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setProg(null); setBusy("");
  };
  const pickable = (r) => !r.bundle; // what "select all" ticks: everything that is shown (also what is installed already: it is installed again); a bundle is installed with its own button
  const toggle = (r) => setSel((cur) => { const n = new Set(cur); if (n.has(r.name)) n.delete(r.name); else n.add(r.name); return n; });
  const installSelected = async () => {
    const names = rows.filter((r) => sel.has(r.name) && !r.bundle).map((r) => r.name);
    if (!names.length) return;
    setBusy("*"); setMsg(null);
    const ok = [], failed = [];
    for (const [i, name] of names.entries()) {  // one by one: a plugin that needs another one finds it installed
      setProg({ total: names.length, done: i, name: rows.find((r) => r.name === name)?.title || name });
      try { const d = await api("/resource/install/", { method: "POST", body: { kind, name } }); ok.push(...d.installed); }
      catch (e) { failed.push(`${name}: ${errorText(e)}`); }
    }
    setProg({ total: names.length, done: names.length, name: "" });
    setSel(new Set());
    setMsg({ ok: !failed.length, text: [ok.length ? tx("{0} is geïnstalleerd.", ok.join(", ")) : "", ...failed].filter(Boolean).join(" ") });
    load(); onChanged?.();
    setProg(null); setBusy("");
  };
  // remove the ticked plugins: first a check of the demo data they hold (and the question what to do with it), then one by one with a progress bar
  const removeNames = async (names) => {
    if (!names.length) return;
    setBusy("*"); setMsg(null);
    try {
      const title = (n) => rows.find((r) => r.name === n)?.title || n;
      if (!(await confirmDialog(tx("{0} plugin(s) verwijderen: {1}? De mappen van de plugins gaan weg; je kunt ze later weer uit de bibliotheek installeren.", names.length, names.map(title).join(", ")), { okLabel: tx("Verwijderen"), cancelLabel: tx("Annuleren"), danger: true }))) { setBusy(""); return; }
      const check = await api("/resource/remove/", { method: "POST", body: { kind, check: true, names } });
      const withDemo = Object.entries(check.demo || {}).filter(([, n]) => n > 0);
      let demo = false;
      if (withDemo.length) demo = await confirmDialog(tx("Er zijn demo-gegevens van: {0}. Ook verwijderen? Kies Behouden om alleen de plugins te verwijderen.", withDemo.map(([n, c]) => `${title(n)} (${c})`).join(", ")), { okLabel: tx("Demo-gegevens ook verwijderen"), cancelLabel: tx("Behouden"), danger: true });
      let todo = [...names];
      const ok = [], failed = {};
      let progress = true;
      while (todo.length && progress) {  // a plugin that another one needs goes after that one: what is refused is tried again
        progress = false;
        for (const name of [...todo]) {
          setProg({ total: names.length, done: ok.length, name: title(name), verb: tx("Verwijderen") });
          try { await api("/resource/remove/", { method: "POST", body: { kind, name, with_demo: demo } }); ok.push(name); todo = todo.filter((n) => n !== name); delete failed[name]; progress = true; }
          catch (e) { failed[name] = errorText(e); }
        }
      }
      setProg({ total: names.length, done: ok.length, name: "", verb: tx("Verwijderen") });
      setSel(new Set());
      setMsg({ ok: !todo.length, text: [ok.length ? tx("{0} is verwijderd.", ok.map(title).join(", ")) : "", ...todo.map((n) => `${title(n)}: ${failed[n]}`)].filter(Boolean).join(" ") });
      load(); onChanged?.();
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setProg(null); setBusy("");
  };
  const removeSelected = () => removeNames(rows.filter((r) => sel.has(r.name) && r.installed && !r.bundle).map((r) => r.name));
  const remove = (r) => removeNames([r.name]);
  const update = async () => {
    setBusy("*"); setMsg(null); setProg({ total: updates, done: 0, name: tx("Alles wat een update heeft") });
    try { const d = await api("/resource/update/", { method: "POST", body: { kind } }); done(d.updated.length ? tx("Bijgewerkt: {0}.", d.updated.join(", ")) : tx("Alles is al actueel.")); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setProg(null); setBusy("");
  };
  const shown = rows.filter((r) => !q.trim() || `${r.title} ${r.name} ${r.description}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <>
      <button type="button" className="btn primary" onClick={() => { setOpen(true); setMsg(null); load(); }}>+ {tx("Toevoegen uit de bibliotheek")}</button>
      <button type="button" className="btn" disabled={!!busy || !updates} onClick={update} title={updates ? "" : tx("Alles is al actueel.")}>↻ {tx("Updaten")}{updates ? ` (${updates})` : ""}</button>
      {msg && !open && <span className={msg.ok ? "muted" : "error"} style={{ alignSelf: "center" }}>{msg.text}</span>}
      {open && (
        <div className="overlay" onClick={() => setOpen(false)}>
          <div className="card modal wide res-modal" style={{ width: "min(1180px, 94vw)", maxWidth: "94vw" }} onClick={(e) => e.stopPropagation()}>
            <div className="row between"><h2 style={{ margin: 0 }}>{tx("Toevoegen uit de bibliotheek")}</h2><button type="button" className="btn sm" onClick={() => setOpen(false)}>{tx("Sluiten")}</button></div>
            <p className="muted" style={{ margin: 0 }}>{tx("Dit komt uit de map resource van het product: je hoeft geen bestand te uploaden. Alleen de nieuwste versie staat erin.")}</p>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Zoeken…")} />
            <div className="row" style={{ justifyContent: "flex-start", alignItems: "center", gap: ".6rem", flexWrap: "wrap" }}>
              <button type="button" className="btn sm" disabled={!!busy} onClick={() => { const all = shown.filter(pickable).map((r) => r.name); setSel((cur) => (all.length && all.every((n) => cur.has(n)) ? new Set() : new Set(all))); }}>
                {shown.filter(pickable).length && shown.filter(pickable).every((r) => sel.has(r.name)) ? tx("Niets selecteren") : tx("Alles selecteren")}
              </button>
              <button type="button" className="btn sm primary" disabled={!!busy || !sel.size} onClick={installSelected}>{busy === "*" ? "…" : tx("Geselecteerde installeren")}{sel.size ? ` (${sel.size})` : ""}</button>
              {kind === "plugins" && <button type="button" className="btn sm danger" disabled={!!busy || !rows.some((r) => sel.has(r.name) && r.installed && !r.bundle)} onClick={removeSelected}>{tx("Geselecteerde verwijderen")}{sel.size ? ` (${rows.filter((r) => sel.has(r.name) && r.installed && !r.bundle).length})` : ""}</button>}
            </div>
            {prog && (
              <div role="status" aria-live="polite">
                <div className="run-bar" role="progressbar" aria-valuemin={0} aria-valuemax={prog.total} aria-valuenow={prog.done}><span style={{ width: `${Math.round((100 * (prog.done + (prog.done < prog.total ? 0.5 : 0))) / Math.max(1, prog.total))}%` }} /></div>
                <small className="muted">{prog.done >= prog.total ? tx("Klaar.") : `${prog.verb || tx("Installeren")} ${prog.done + 1} ${tx("van")} ${prog.total}: ${prog.name}…`}</small>
              </div>
            )}
            {msg && <div className={`alert ${msg.ok ? "ok" : ""}`}>{msg.text}</div>}
            <div className="res-list">
              {shown.map((r) => (
                <div key={r.file} className="res-item" style={{ gridTemplateColumns: "auto minmax(0, 1fr) auto auto auto" }}>
                  <input type="checkbox" checked={sel.has(r.name)} disabled={!!busy || !!r.bundle} onChange={() => toggle(r)} aria-label={tx("Selecteren")} />
                  <div className="res-main">
                    <strong>{r.title}</strong> <small className="muted">{r.name !== r.title ? r.name + " · " : ""}{tx("versie")} {r.version}{r.installed_version ? ` (${tx("nu")} ${r.installed_version})` : ""}</small>
                    {r.description && <small className="muted">{r.description}</small>}
                    {r.preview && <ThemePreview p={r.preview} />}
                  </div>
                  <span className={`badge ${STATE[r.state][1]}`}>{tx(STATE[r.state][0])}</span>
                  <button type="button" className={`btn sm ${r.state === "new" || r.state === "update" ? "primary" : ""}`} disabled={!!busy} onClick={() => add(r)}>
                    {busy === r.name ? "…" : r.state === "update" ? tx("Updaten") : r.state === "current" ? tx("Opnieuw") : tx("Installeren")}
                  </button>
                  {kind === "plugins" && !r.bundle ? <button type="button" className="btn sm danger" disabled={!!busy || !r.installed} onClick={() => remove(r)}>{tx("Verwijderen")}</button> : <span />}
                </div>
              ))}
              {!shown.length && <p className="muted">{tx("Niets gevonden in de bibliotheek.")}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Superadmin: what is in the library, what others may install without uploading (resource/allowed.json), and install or update it here.
export function ResourceAdmin() {
  const [lib, setLib] = useState(null);
  const [kind, setKind] = useState("plugins");
  const [ok, setOk] = useState(null); // {kind: Set(names)}
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState("");
  const load = useCallback(() => api("/resource/").then((d) => {
    setLib(d);
    setOk((cur) => cur || Object.fromEntries(Object.entries(d.kinds).map(([k, rows]) => [k, new Set(rows.filter((r) => r.allowed).map((r) => r.name))])));
  }).catch((e) => setMsg({ ok: false, text: errorText(e) })), []);
  useEffect(() => { load(); }, [load]);
  if (!lib) return msg ? <div className="alert">{msg.text}</div> : <p className="muted">{tx("Laden…")}</p>;
  const rows = lib.kinds[kind] || [];
  const flip = (name) => setOk((cur) => { const s = new Set(cur[kind]); s.has(name) ? s.delete(name) : s.add(name); return { ...cur, [kind]: s }; });
  const save = async () => {
    setBusy("save"); setMsg(null);
    try { await api("/resource/allowed/", { method: "PUT", body: Object.fromEntries(Object.entries(ok).map(([k, s]) => [k, [...s]])) }); setMsg({ ok: true, text: tx("Opgeslagen in resource/allowed.json.") }); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy("");
  };
  const act = async (path, body, text) => {
    setBusy(body.name || "*"); setMsg(null);
    try { const d = await api(path, { method: "POST", body }); setMsg({ ok: true, text: text(d) }); await load(); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy("");
  };
  const updates = rows.filter((r) => r.state === "update").length;
  return (
    <div className="stack" style={{ gap: ".9rem" }}>
      <p className="muted" style={{ margin: 0 }}>{tx("De map resource van het product bevat de zips van plugins, thema's en talen (alleen de nieuwste versie). Vink aan wat gebruikers met rechten voor dat onderdeel mogen installeren zonder te uploaden; superadmins kunnen alles installeren. Het vinkje komt in resource/allowed.json en gaat met het product mee.")}</p>
      <Tabs value={kind} onChange={setKind} tabs={Object.keys(lib.kinds).map((k) => [k, lib.titles[k] || k])} />
      {msg && <div className={`alert ${msg.ok ? "ok" : ""}`}>{msg.text}</div>}
      <div className="res-list">
        <div className="res-item res-head"><span>{tx("Naam")}</span><span>{tx("Mag zonder uploaden")}</span><span>{tx("Status")}</span><span /></div>
        {rows.map((r) => (
          <div key={r.file} className="res-item">
            <div className="res-main"><strong>{r.title}</strong> <small className="muted">{r.name !== r.title ? r.name + " · " : ""}{tx("versie")} {r.version}{r.installed_version ? ` (${tx("nu")} ${r.installed_version})` : ""}</small></div>
            <label className="switch" title={tx("Mag zonder uploaden worden geïnstalleerd")}><input type="checkbox" disabled={r.bundle} checked={!r.bundle && !!ok?.[kind]?.has(r.name)} onChange={() => flip(r.name)} /><span /></label>
            <span className={`badge ${STATE[r.state][1]}`}>{tx(STATE[r.state][0])}</span>
            <button type="button" className="btn sm" disabled={!!busy} onClick={() => act("/resource/install/", { kind, name: r.name }, (d) => tx("{0} is geïnstalleerd.", d.installed.join(", ")))}>
              {r.state === "update" ? tx("Updaten") : r.installed ? tx("Opnieuw") : tx("Installeren")}
            </button>
          </div>
        ))}
        {!rows.length && <p className="muted">{tx("Er staat nog niets in resource/")}{kind}.</p>}
      </div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <button type="button" className="btn" disabled={!!busy || !updates} onClick={() => act("/resource/update/", { kind }, (d) => (d.updated.length ? tx("Bijgewerkt: {0}.", d.updated.join(", ")) : tx("Alles is al actueel.")))}>↻ {tx("Alles updaten")}{updates ? ` (${updates})` : ""}</button>
        <button type="button" className="btn primary" disabled={!!busy} onClick={save}>{tx("Opslaan")}</button>
      </div>
    </div>
  );
}
