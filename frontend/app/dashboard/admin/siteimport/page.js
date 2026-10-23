// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { Busy } from "../../../../components/PageLoader";
import { tx } from "../../../../lib/t";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import Collapsible from "../../../../components/Collapsible";
import { IconFolder, IconGlobe, IconImage } from "../../../../components/Icons";
import Tabs from "../../../../components/Tabs";
import { api, errorText, mediaUrl } from "../../../../lib/api";
import { confirmDialog } from "../../../../lib/dialog";
import { lvl } from "../../../../lib/perms";

const ROLES = [["logo", "Logo"], ["logo_dark", "Logo (donker)"], ["favicon", "Favicon"], ["icon", "App-icoon"], ["og_image", "Deelafbeelding"]];
const ROLE_NAME = { logo: "Logo", favicon: "Favicon", icon: "Icoon", og_image: "Deelafbeelding", image: "Afbeelding" };

function Swatches({ colors }) {
  return <span className="si-swatches">{(colors || []).map((c) => <i key={c} style={{ background: c }} title={c} />)}</span>;
}

function Detail({ imp, onChanged }) {
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState(null);
  const [pick, setPick] = useState({});
  useEffect(() => { api(`/siteimport/${imp.id}/`).then(setD).catch((e) => setMsg({ ok: false, text: errorText(e) })); }, [imp.id, imp.pages, imp.images]);
  const use = async (a) => {
    try { await api(`/siteimport/${imp.id}/asset/`, { method: "POST", body: { media: a.media, role: pick[a.media] || (ROLE_NAME[a.role] && a.role !== "image" ? a.role : "logo") } }); setMsg({ ok: true, text: tx("Ingesteld. Zie Logo's & beeld.") }); onChanged(); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  };
  if (!d) return <Busy />;
  return (
    <div className="si-detail">
      {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
      {d.notes?.length > 0 && <div className="alert">{d.notes.join(" ")}</div>}
      <div>
        <strong>{tx("Pagina's")} ({d.page_list.length})</strong>
        <ul className="si-pages">{d.page_list.map((p) => <li key={p.id}><a href={p.path} target="_blank" rel="noreferrer">{p.title}</a> <small className="muted">{p.path}{p.in_menu ? ` · ${tx("in menu")}` : ""}</small></li>)}</ul>
        {!d.page_list.length && <p className="muted" style={{ margin: 0 }}>{tx("Geen aparte pagina's gevonden. De startpagina is wel ingelezen.")}</p>}
      </div>
      <div>
        <strong>{tx("Iconen en afbeeldingen")} ({d.assets.length})</strong>
        <div className="si-assets">
          {d.assets.map((a) => (
            <figure key={a.media}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(a.url)} alt={a.name} />
              <figcaption><span className="badge">{tx(ROLE_NAME[a.role] || "Afbeelding")}</span></figcaption>
              <span className="row" style={{ flexWrap: "nowrap", gap: ".3rem" }}>
                <select value={pick[a.media] || (a.role !== "image" ? a.role : "logo")} onChange={(e) => setPick({ ...pick, [a.media]: e.target.value })}>
                  {ROLES.map(([k, l]) => <option key={k} value={k}>{tx(l)}</option>)}
                </select>
                <button type="button" className="btn sm" onClick={() => use(a)}>{tx("Gebruik")}</button>
              </span>
            </figure>
          ))}
          {!d.assets.length && <p className="muted" style={{ margin: 0 }}>{tx("Geen afbeeldingen gevonden.")}</p>}
        </div>
        <small className="muted">{tx("De afbeeldingen staan ook in de mediabibliotheek (tag: import).")}</small>
      </div>
    </div>
  );
}

const PROFILE_LABEL = { normal: "Normaal", dating: "Dating", sporters: "Sporters", business: "Business", webshop: "Webshop" };

// The proposal made from the site: check and adjust it, then approve. Nothing is created before the approval.
function Proposal({ imp, onDone, onCancel }) {
  const pr = imp.proposal;
  const [tab, setTab] = useState("profile");
  const [name, setName] = useState(pr.theme.name);
  const [profile, setProfile] = useState(pr.profile.key);
  const [useProfile, setUseProfile] = useState(true);
  const [pages, setPages] = useState(pr.pages.map((p) => ({ i: p.i, include: true, title: p.title, in_menu: p.in_menu })));
  const [home, setHome] = useState(!!pr.home.title);
  const [assets, setAssets] = useState(pr.assets.map((a) => ({ file: a.file, include: true, role: a.role })));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const setP = (i, patch) => setPages((l) => l.map((x) => (x.i === i ? { ...x, ...patch } : x)));
  const setA = (f, patch) => setAssets((l) => l.map((x) => (x.file === f ? { ...x, ...patch } : x)));
  const nPages = pages.filter((p) => p.include).length, nAssets = assets.filter((a) => a.include).length;

  const approve = async () => {
    setBusy(true); setErr("");
    try { onDone(await api(`/siteimport/${imp.id}/approve/`, { method: "POST", body: { name, profile: useProfile ? profile : null, pages, home: { include: home }, assets } })); }
    catch (e) { setErr(errorText(e)); setBusy(false); }
  };

  return (
    <div className="card si-proposal">
      <div className="si-head">
        <div className="grow"><strong style={{ fontSize: "1.1rem" }}>{tx("Voorstel voor")} “{imp.name}”</strong><br /><small className="muted">{tx("Bron")}: {imp.source} · {tx("Bestanden in")} <code>{imp.folder}</code></small></div>
      </div>
      <p className="muted" style={{ margin: 0 }}>{tx("Controleer het voorstel. Er is nog niets aan je site veranderd: pas na je akkoord worden de pagina's en afbeeldingen aangemaakt.")}</p>
      {imp.notes?.length > 0 && <div className="alert">{imp.notes.join(" ")}</div>}
      <Tabs value={tab} onChange={setTab} tabs={[["profile", "Profielen"], ["pages", "Pagina's", null, nPages + (home ? 1 : 0)], ["assets", "Afbeeldingen", null, nAssets]]} />

      {tab === "profile" && (
        <div className="form">
          <p className="muted" style={{ margin: 0 }}>{tx("Voorstel voor het type profielen op je site")}: <strong>{tx(PROFILE_LABEL[pr.profile.key])}</strong>. {tx(pr.profile.reason)}</p>
          <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={useProfile} onChange={(e) => setUseProfile(e.target.checked)} /><span /></span><span>{tx("Profieltype meenemen in dit thema")} <small className="muted">{tx("Zet de profielvelden van dit type aan wanneer je het thema gebruikt.")}</small></span></label>
          <div className="popup-presets">
            {imp.proposal.profile_options.map((k) => (
              <button key={k} type="button" disabled={!useProfile} className="card" onClick={() => setProfile(k)} style={{ textAlign: "left", borderColor: useProfile && profile === k ? "var(--blue)" : undefined }}>
                <strong>{tx(PROFILE_LABEL[k])} {k === pr.profile.key && <span className="badge ok">{tx("Voorstel")}</span>}</strong>
              </button>
            ))}
          </div>
        </div>
      )}


      {tab === "pages" && (
        <div className="form">
          <label className="check"><input type="checkbox" checked={home} onChange={(e) => setHome(e.target.checked)} /> <span><strong>{tx("Startpagina")}</strong>: {pr.home.title} <small className="muted">— {pr.home.preview}</small></span></label>
          <div className="table-wrap"><table>
            <thead><tr><th /><th>{tx("Titel")}</th><th>{tx("Adres op de oude site")}</th><th>{tx("In menu")}</th></tr></thead>
            <tbody>
              {pr.pages.map((p) => { const c = pages.find((x) => x.i === p.i); return (
                <tr key={p.i}>
                  <td><input type="checkbox" checked={c.include} onChange={(e) => setP(p.i, { include: e.target.checked })} /></td>
                  <td><input value={c.title} maxLength={80} onChange={(e) => setP(p.i, { title: e.target.value })} /><small className="muted">{p.preview}</small></td>
                  <td><code>{p.path}</code></td>
                  <td><input type="checkbox" checked={c.in_menu} disabled={!c.include} onChange={(e) => setP(p.i, { in_menu: e.target.checked })} /></td>
                </tr>); })}
            </tbody>
          </table></div>
          {!pr.pages.length && <p className="muted" style={{ margin: 0 }}>{tx("Geen aparte pagina's gevonden.")}</p>}
        </div>
      )}

      {tab === "assets" && (
        <div className="si-assets">
          {pr.assets.map((a) => { const c = assets.find((x) => x.file === a.file); return (
            <figure key={a.file} style={{ opacity: c.include ? 1 : .45 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(a.url)} alt={a.name} />
              <label className="check"><input type="checkbox" checked={c.include} onChange={(e) => setA(a.file, { include: e.target.checked })} /> {a.name}</label>
              <select value={c.role} disabled={!c.include} onChange={(e) => setA(a.file, { role: e.target.value })}>
                {[["logo", "Logo"], ["logo_dark", "Logo (donker)"], ["favicon", "Favicon"], ["icon", "App-icoon"], ["og_image", "Deelafbeelding"], ["image", "Afbeelding"]].map(([k, l]) => <option key={k} value={k}>{tx(l)}</option>)}
              </select>
            </figure>); })}
          {!pr.assets.length && <p className="muted" style={{ margin: 0 }}>{tx("Geen afbeeldingen gevonden.")}</p>}
        </div>
      )}

      {err && <div className="alert">{err}</div>}
      <div className="row" style={{ justifyContent: "flex-start" }}>
        <button className="btn primary" disabled={busy || !name.trim()} onClick={approve}>{busy ? tx("Bezig…") : tx("Akkoord: importeren")}</button>
        <button className="btn danger" disabled={busy} onClick={onCancel}>{tx("Weggooien")}</button>
      </div>
    </div>
  );
}

export default function SiteImport() {
  const { user } = useAuth();
  const L = lvl(user, "siteimport");
  const [tab, setTab] = useState("url");
  const [list, setList] = useState(null);
  const [folders, setFolders] = useState([]);
  const [url, setUrl] = useState("");
  const [themeName, setThemeName] = useState("");
  const [proposal, setProposal] = useState(null); // imp (with .proposal) being checked
  const [folder, setFolder] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  const [open, setOpen] = useState(null);
  const zip = useRef(null);

  const load = useCallback(() => api("/siteimport/").then((d) => { setList(d.imports); setFolders(d.folders); setFolder((f) => f || d.folders[0] || ""); }).catch((e) => setMsg({ ok: false, text: errorText(e) })), []);
  useEffect(() => { load(); }, [load]);

  const run = async (label, fn, okText) => {
    setBusy(label); setMsg(null);
    try { const r = await fn(); await load(); setMsg({ ok: true, text: okText ? okText(r) : tx("Klaar.") }); return r; }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    finally { setBusy(""); }
  };
  const done = (r) => tx("\"{0}\" is ingelezen. Controleer hieronder het voorstel; pas na je akkoord wordt er iets aangemaakt.", r.name);
  const start = (body) => run("import", () => api("/siteimport/", { method: "POST", body }), done).then((r) => r && setProposal(r));
  const importZip = (e) => { const f = e.target.files[0]; e.target.value = ""; if (!f) return; const fd = new FormData(); fd.append("kind", "zip"); fd.append("file", f); fd.append("name", themeName); start(fd); };
  const review = async (i) => { try { setProposal(await api(`/siteimport/${i.id}/`)); } catch (e) { setMsg({ ok: false, text: errorText(e) }); } };
  const cancelProposal = async (i) => {
    if (!(await confirmDialog(tx("Dit voorstel weggooien? De ingelezen bestanden worden verwijderd."), { danger: true, title: tx("Voorstel weggooien"), okLabel: tx("Weggooien") }))) return;
    await run("cancel", () => api(`/siteimport/${i.id}/`, { method: "DELETE" }), () => tx("Weggegooid."));
    setProposal(null);
  };
  const approved = async (r) => { setProposal(null); await load(); setOpen(r.id); setMsg({ ok: true, text: tx("Import \"{0}\" is aangemaakt in de map {1}.", r.name, r.folder) }); };
  const toggle = (i, what, on) => run(what + i.id, () => api(`/siteimport/${i.id}/${what}/`, { method: "POST", body: { apply: on } }), () => (on ? tx("Gebruikt.") : tx("Teruggezet.")));
  const remove = async (i) => {
    if (!(await confirmDialog(tx("\"{0}\" verwijderen? De {1} pagina's en de {2} afbeeldingen die hiervan zijn ingelezen worden ook verwijderd. Het profieltype en de startpagina gaan terug naar hoe ze waren.", i.name, i.pages, i.images), { danger: true, title: tx("Import verwijderen"), okLabel: tx("Verwijderen") }))) return;
    await run("del" + i.id, () => api(`/siteimport/${i.id}/`, { method: "DELETE" }), () => tx("Verwijderd, met alles wat ervan was ingelezen."));
    if (open === i.id) setOpen(null);
  };

  if (L < 1) return <p className="muted">{tx("Geen toegang.")}</p>;
  const canManage = L >= 3;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{tx("Site importeren")}</h1>
          <p className="muted" style={{ margin: 0 }}>{tx("Lees een andere website in: je krijgt de pagina's, een basis-startpagina, het profieltype en de afbeeldingen. Een thema (kleuren, logo's, e-mail) maak je bij Thema → Nieuw themapakket → Importeren van een website. Niets verandert op je site totdat je het zelf aanzet, en alles is weer te verwijderen.")}</p>
        </div>
      </div>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}

      {canManage && (
        <Collapsible id="si-new" title={tx("Nieuwe import")} defaultOpen>
          <label style={{ maxWidth: 420, marginBottom: ".75rem" }}>{tx("Naam van de import")} <small className="muted">{tx("ook de naam van de map met alle bestanden")}</small><input value={themeName} maxLength={120} onChange={(e) => setThemeName(e.target.value)} placeholder={tx("bv. Bakkerij De Zon")} /></label>
          <Tabs value={tab} onChange={setTab} tabs={[["url", "Website-adres", <IconGlobe key="u" />], ["folder", "Map op de server", <IconFolder key="f" />], ["zip", "ZIP-bestand", <IconImage key="z" />]]} />
          {tab === "url" && (
            <form className="row" style={{ flexWrap: "nowrap", alignItems: "end", marginTop: ".75rem" }} onSubmit={(e) => { e.preventDefault(); start({ kind: "url", url, name: themeName }); }}>
              <label style={{ flex: 1 }}>{tx("Adres van de website")}<input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.voorbeeld.nl" required /></label>
              <button className="btn primary" disabled={!!busy}>{busy === "import" ? tx("Bezig met inlezen…") : tx("Analyseren")}</button>
            </form>
          )}
          {tab === "folder" && (
            <div className="row" style={{ flexWrap: "nowrap", alignItems: "end", marginTop: ".75rem" }}>
              <label style={{ flex: 1 }}>{tx("Map")}
                <select value={folder} onChange={(e) => setFolder(e.target.value)} disabled={!folders.length}>{folders.length ? folders.map((f) => <option key={f} value={f}>{f}</option>) : <option>{tx("Geen mappen gevonden")}</option>}</select>
              </label>
              <button className="btn" type="button" onClick={load}>{tx("Verversen")}</button>
              <button className="btn primary" disabled={!!busy || !folder} onClick={() => start({ kind: "folder", folder, name: themeName })}>{busy === "import" ? tx("Bezig met inlezen…") : tx("Analyseren")}</button>
            </div>
          )}
          {tab === "zip" && (
            <div style={{ marginTop: ".75rem" }}>
              <div className="dropzone" role="button" tabIndex={0} onClick={() => zip.current.click()} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && zip.current.click()}
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); importZip({ target: { files: e.dataTransfer.files, value: "" } }); }}>
                <span>{busy === "import" ? tx("Bezig met inlezen…") : tx("Sleep het ZIP-bestand van de site hierheen of klik om te kiezen")}</span>
                <input ref={zip} type="file" accept=".zip,application/zip" hidden onChange={importZip} />
              </div>
            </div>
          )}
          <small className="muted" style={{ display: "block", marginTop: ".6rem" }}>
            {tab === "folder" ? tx("Zet de map van de andere site in de map \"imports\" naast de backend (bijvoorbeeld backend/imports/mijnsite). Er moet een index.html in staan.") : tab === "zip" ? tx("Een ZIP met de html-, css- en afbeeldingsbestanden van de site, met een index.html.") : tx("Alleen openbare websites. Er worden maximaal 12 pagina's en 40 afbeeldingen ingelezen.")}
          </small>
        </Collapsible>
      )}

      {proposal && proposal.status === "proposal" && <Proposal key={proposal.id} imp={proposal} onDone={approved} onCancel={() => cancelProposal(proposal)} />}

      <Collapsible id="si-list" title={`${tx("Geïmporteerde sites")} (${list?.length ?? 0})`} defaultOpen>
        {!list && <Busy />}
        {list && !list.length && <p className="muted" style={{ margin: 0 }}>{tx("Nog niets geïmporteerd.")}</p>}
        {(list || []).filter((i) => i.status === "proposal").map((i) => (
          <div key={i.id} className="card si-card">
            <div className="si-head"><div className="grow"><strong style={{ fontSize: "1.05rem" }}>{i.name}</strong> <span className="badge off">{tx("Wacht op controle")}</span><br /><small className="muted">{i.source} · <code>{i.folder}</code></small></div></div>
            <div className="row" style={{ justifyContent: "flex-start" }}><button className="btn primary" onClick={() => review(i)}>{tx("Voorstel bekijken")}</button><button className="btn danger" onClick={() => cancelProposal(i)}>{tx("Weggooien")}</button></div>
          </div>
        ))}
        {(list || []).filter((i) => i.status !== "proposal").map((i) => (
          <div key={i.id} className="card si-card">
            <div className="si-head">
              <div className="grow">
                <strong style={{ fontSize: "1.05rem" }}>{i.name}</strong> <span className="badge">{tx(i.kind === "url" ? "Website" : i.kind === "zip" ? "ZIP" : "Map")}</span>
                <br /><small className="muted">{i.source} · {tx("map")} <code>{i.folder}</code> · {new Date(i.created_at).toLocaleString()}</small>
              </div>
              <Swatches colors={[i.theme.primary, i.theme.secondary, ...(i.theme.palette || []).slice(0, 4)].filter((c, k, a) => c && a.indexOf(c) === k)} />
            </div>
            <div className="si-stats">
              <span><strong>{i.pages}</strong> {tx("pagina's")}</span><span><strong>{i.images}</strong> {tx("afbeeldingen")}</span>
              {i.theme.profile && <span className="badge">{tx("Profielen")}: {tx(PROFILE_LABEL[i.theme.profile])}</span>}
            </div>
            <div className="row" style={{ justifyContent: "flex-start" }}>
              {canManage && i.theme.profile && (i.theme.applied
                ? <button className="btn" disabled={!!busy} onClick={() => toggle(i, "theme", false)}>{tx("Profieltype terugzetten")}</button>
                : <button className="btn primary" disabled={!!busy} onClick={() => toggle(i, "theme", true)}>{tx("Profieltype gebruiken")}</button>)}
              {canManage && i.home.exists && (i.home.applied
                ? <button className="btn" disabled={!!busy} onClick={() => toggle(i, "home", false)}>{tx("Startpagina terugzetten")}</button>
                : <button className="btn" disabled={!!busy} onClick={() => toggle(i, "home", true)}>{tx("Startpagina overnemen")}</button>)}
              <button className="btn" onClick={() => setOpen(open === i.id ? null : i.id)}>{open === i.id ? tx("Sluiten") : tx("Pagina's en afbeeldingen")}</button>
              {canManage && <button className="btn danger" disabled={!!busy} onClick={() => remove(i)}>{tx("Verwijderen")}</button>}
            </div>
            {open === i.id && <Detail imp={i} onChanged={load} />}
          </div>
        ))}
      </Collapsible>
    </>
  );
}
