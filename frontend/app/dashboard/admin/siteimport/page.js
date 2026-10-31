// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { markImported } from "../../../../lib/imported";
import { Busy } from "../../../../components/PageLoader";
import { tx } from "../../../../lib/t";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import Collapsible from "../../../../components/Collapsible";
import { IconFolder, IconGlobe, IconImage } from "../../../../components/Icons";
import Tabs from "../../../../components/Tabs";
import { createPortal } from "react-dom";
import DesignFrame from "../../../../components/DesignFrame";
import { api, errorText, mediaUrl } from "../../../../lib/api";
import { confirmDialog } from "../../../../lib/dialog";
import { lvl } from "../../../../lib/perms";

const ROLES = [["logo", "Logo"], ["logo_dark", "Logo (donker)"], ["favicon", "Favicon"], ["icon", "App-icoon"], ["og_image", "Deelafbeelding"]];
const ROLE_NAME = { logo: "Logo", favicon: "Favicon", icon: "Icoon", og_image: "Deelafbeelding", image: "Afbeelding" };

// Two columns: the pages of the file on the left, the pages of the website on the right. Drag one onto the other (either way) or click one and then the other to link them.
function PageMapper({ sources, targets, map, onChange, freeLabel, multi = false, freeSub }) {
  const [pick, setPick] = useState(null); // {kind: "src" | "tgt", key}: the first click of a pair
  const [over, setOver] = useState("");
  const link = (src, tgt) => {
    const next = Object.fromEntries(Object.entries(map).filter(([k, v]) => k !== src && (multi || !tgt || v !== tgt))); // a page goes to one place and a place takes one page
    if (tgt) next[src] = tgt;
    onChange(next);
  };
  const connect = (a, b) => { // a and b: {kind, key} in any order
    if (a.kind === b.kind) return false;
    const src = a.kind === "src" ? a.key : b.key, tgt = a.kind === "tgt" ? a.key : b.key;
    link(src, tgt === "" ? "" : tgt);
    return true;
  };
  const onDrop = (e, me) => {
    e.preventDefault(); setOver("");
    try { const d = JSON.parse(e.dataTransfer.getData("text/plain") || "{}"); if (d.kind) connect(d, me); } catch { /* not ours */ }
  };
  const onClick = (me) => {
    if (pick && pick.kind !== me.kind) { connect(pick, me); setPick(null); } else setPick(pick && pick.kind === me.kind && pick.key === me.key ? null : me);
  };
  const item = (me, title, sub, note, on, unlink) => {
    const id = `${me.kind}:${me.key}`, picked = pick && pick.kind === me.kind && pick.key === me.key;
    return (
      <div key={id} draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", JSON.stringify(me)); e.dataTransfer.effectAllowed = "link"; }}
        onDragOver={(e) => { e.preventDefault(); setOver(id); }} onDragLeave={() => setOver((o) => (o === id ? "" : o))} onDrop={(e) => onDrop(e, me)} onClick={() => onClick(me)}
        style={{ padding: ".55rem .75rem", border: `1px ${over === id ? "solid" : "solid"} ${over === id || picked ? "var(--blue)" : "var(--line)"}`, background: over === id ? "color-mix(in srgb, var(--blue) 14%, var(--card))" : on ? "color-mix(in srgb, var(--blue) 8%, var(--card))" : "var(--card)", borderRadius: 10, cursor: "grab", display: "flex", gap: ".5rem", alignItems: "center", boxShadow: picked ? "0 0 0 2px var(--blue)" : "none" }}>
        <span aria-hidden style={{ opacity: .5 }}>⋮⋮</span>
        <span style={{ flex: 1, minWidth: 0 }}><strong>{title}</strong>{sub && <small className="muted" style={{ display: "block", overflowWrap: "anywhere" }}>{sub}</small>}</span>
        {note && <span className="badge ok" style={{ whiteSpace: "nowrap" }}>{note}</span>}
        {unlink && <button type="button" className="btn sm" title={tx("Loskoppelen")} onClick={(e) => { e.stopPropagation(); unlink(); }}>×</button>}
      </div>
    );
  };
  const srcOf = (t) => Object.keys(map).find((k) => map[k] === t);
  const srcAll = (t) => Object.keys(map).filter((k) => map[k] === t);
  return (
    <div>
      <p className="muted" style={{ margin: "0 0 .6rem" }}>{tx("Sleep een pagina uit het bestand (links) op een pagina van je website (rechts), of andersom. Je kunt ook eerst op de ene en dan op de andere klikken. Wat nog niet gekoppeld is, wordt een eigen pagina.")}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.2rem", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: ".45rem" }}>
          <strong>{tx("Pagina's uit het bestand")}</strong>
          {sources.map((x) => item({ kind: "src", key: x.key }, x.title, x.sub, map[x.key] ? `→ ${(targets.find((t) => t.key === map[x.key]) || {}).title || map[x.key]}` : tx("eigen pagina"), !!map[x.key], map[x.key] ? () => link(x.key, "") : null))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: ".45rem", maxHeight: "52vh", overflowY: "auto", paddingRight: ".2rem" }}>
          <strong>{tx("Pagina's van je website")}</strong>
          {item({ kind: "tgt", key: "" }, freeLabel || tx("Eigen pagina maken"), freeSub || tx("Zet een pagina hierop om hem los te koppelen"), "", false, null)}
          {targets.map((t) => { const all = srcAll(t.key); const sk = all[0]; const src = sources.find((x) => x.key === sk); return item({ kind: "tgt", key: t.key }, t.title, multi ? t.key : t.std ? tx("Standaardpagina van het systeem") : tx("Eigen pagina"), all.length > 1 ? `← ${all.length}` : src ? `← ${src.title}` : "", all.length > 0, !multi && sk ? () => link(sk, "") : null); })}
        </div>
      </div>
    </div>
  );
}

// What happens when the pages are built: an extra instruction for Claude, what to do with a page that already has content, and translating.
function ApplyOptions({ opts, setOpts, needMode, canReplace, languages }) {
  const blocks = opts.render === "blocks";
  const set = (patch) => setOpts((o) => ({ ...o, ...patch }));
  return (
    <div className="stack-sm" style={{ display: "flex", flexDirection: "column", gap: ".9rem", marginTop: "1rem" }}>
      <div><strong>{tx("Weergave")}</strong>
        {[["design", tx("Exact: 1 op 1 zoals het bestand"), tx("De pagina ziet er precies uit als het html-bestand. Teksten pas je aan door het bestand opnieuw te importeren.")], ["blocks", tx("Bewerkbaar: opbouwen met blokken"), tx("Claude bouwt de pagina na met de blokken van het systeem, zodat je alles in de bewerkmodus kunt aanpassen. Dit is een benadering: kaarten, iconen en bijzondere vormen kunnen afwijken.")]].map(([k, l, h]) => (
          <label key={k} className="check" style={{ display: "flex", gap: ".5rem", marginTop: ".3rem" }}><input type="radio" name="si-render" checked={(opts.render || "design") === k} onChange={() => set({ render: k })} /><span>{l} <small className="muted">{h}</small></span></label>
        ))}
      </div>
      {blocks && <label>{tx("Opdracht voor Claude (om de pagina te verbeteren)")} <small className="muted">{tx("Optioneel. Bijvoorbeeld: maak de koppen groter, meer ruimte tussen de blokken, de knoppen in het midden.")}</small>
        <textarea rows={3} value={opts.prompt} maxLength={1500} onChange={(e) => set({ prompt: e.target.value })} placeholder={tx("Wat moet Claude anders doen?")} />
      </label>}
      {blocks && needMode && (
        <div><strong>{tx("Er staat al inhoud op de gekozen pagina. Wat moet er gebeuren?")}</strong>
          {[["clear", tx("Eerst helemaal leegmaken en dan opbouwen"), tx("De huidige blokken worden bewaard en komen terug als je de import verwijdert.")], ...(canReplace ? [["replace", tx("Alleen de blokken van deze import vervangen"), tx("De rest van de pagina blijft staan.")]] : []), ["append", tx("Onderaan toevoegen"), tx("Wat er staat blijft, de nieuwe blokken komen eronder.")]].map(([k, l, h]) => (
            <label key={k} className="check" style={{ display: "flex", gap: ".5rem", marginTop: ".3rem" }}><input type="radio" name="si-mode" checked={opts.mode === k} onChange={() => set({ mode: k })} /><span>{l} <small className="muted">{h}</small></span></label>
          ))}
        </div>
      )}
      {blocks && languages?.length > 0 && (
        <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={opts.translate} onChange={(e) => set({ translate: e.target.checked })} /><span /></span><span>{tx("Pagina's en inhoud ook vertalen")} <small className="muted">{languages.map((l) => l.name).join(", ")}</small></span></label>
      )}
    </div>
  );
}

const DEVICES = [["web", "Web", "100%"], ["tablet", "iPad", "820px"], ["mobile", "Mobiel", "390px"]];

// A page in a window: one scroll bar (the page's own), and the width of a computer, an iPad or a phone.
function DevicePopup({ title, sub, link, onClose, scrollHere = false, children }) {
  const [dev, setDev] = useState("web");
  const width = DEVICES.find((d) => d[0] === dev)[2];
  return (
    <div className="pb-objback" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pb-objpop" role="dialog" aria-label={title} style={{ width: "min(92vw, 1600px)", maxWidth: "none", height: "92vh", maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div className="pb-objhead"><strong>{title}</strong>{sub && <small className="muted" style={{ marginLeft: ".6rem" }}>{sub}</small>}<span style={{ flex: 1 }} />
          <span className="pb-seg" style={{ marginRight: ".6rem" }}>{DEVICES.map(([k, l]) => <button type="button" key={k} className={dev === k ? "on" : ""} onClick={() => setDev(k)}>{tx(l)}</button>)}</span>
          {link && <a className="btn sm" href={link} target="_blank" rel="noreferrer">{tx("Openen in een nieuw tabblad")}</a>}
          <button type="button" className="pb-panelx" onClick={onClose} aria-label={tx("Sluiten")}>×</button></div>
        <div style={{ flex: 1, minHeight: 0, display: "flex", justifyContent: "center", background: "var(--bg)", overflow: scrollHere ? "auto" : "hidden", borderRadius: 8 }}>
          <div style={{ width, maxWidth: "100%", height: scrollHere ? "auto" : "100%", background: "#fff", boxShadow: dev === "web" ? "none" : "0 0 0 1px var(--line), 0 10px 40px rgba(0,0,0,.4)" }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

// Where an import stands, in words: waiting for the approval, approved but the content not processed yet (in treatment), or active (the content is on the website).
function StatusBadge({ imp }) {
  const a = imp.apply || {};
  const [cls, label, hint] = a.state === "running" ? ["badge off", `${tx("Bezig met toepassen")} ${Math.round(a.percent || 0)} %`, tx("De pagina's worden nu opgebouwd.")]
    : a.state === "error" ? ["badge off", tx("Mislukt"), tx("Het toepassen is niet gelukt. Probeer het opnieuw.")]
    : a.state === "done" ? ["badge ok", tx("Actief"), tx("De inhoud is verwerkt en staat op je website.")]
    : a.pending ? ["badge off", tx("In behandeling"), tx("Nog niet verwerkt: kies hieronder waar de pagina's komen en klik op Toepassen.")]
    : ["badge", tx("Ingelezen"), ""];
  return <><span className={cls} title={hint}>{label}</span>{hint && <small className="muted" style={{ marginLeft: ".5rem" }}>{hint}</small>}</>;
}

function Swatches({ colors }) {
  return <span className="si-swatches">{(colors || []).map((c) => <i key={c} style={{ background: c }} title={c} />)}</span>;
}

function Detail({ imp, onChanged, onApply, busy }) {
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState(null);
  const [pick, setPick] = useState({});
  const [info, setInfo] = useState(null); // the files of this import, where they are, the pages they can go to and the languages
  const [map, setMap] = useState({});
  const [opts, setOpts] = useState({ prompt: "", mode: "clear", translate: false, render: "design" });
  const [atab, setAtab] = useState("pages");
  const [linkMap, setLinkMap] = useState({});
  const [hdrOn, setHdrOn] = useState(true);
  const [footOn, setFootOn] = useState(true);
  const [thm, setThm] = useState({});
  useEffect(() => { if (imp.apply?.pending) api(`/siteimport/${imp.id}/apply/?info=1`).then((i) => { setInfo(i); setMap(Object.fromEntries(i.sources.filter((x) => !x.own && x.dest).map((x) => [x.key, x.dest]))); setOpts((o) => ({ ...o, prompt: o.prompt || i.prompt || "", translate: i.languages.length > 0 })); setLinkMap({ ...Object.fromEntries((i.links || []).filter((l) => l.suggest).map((l) => [l.key, l.suggest])), ...(i.link_map || {}) }); setHdrOn(i.options?.header !== false); setFootOn(i.options?.site_footer !== false); setThm(i.theme || {}); }).catch(() => setInfo(null)); else setInfo(null); }, [imp.id, imp.apply?.pending, imp.apply?.state]);
  useEffect(() => { api(`/siteimport/${imp.id}/`).then(setD).catch((e) => setMsg({ ok: false, text: errorText(e) })); }, [imp.id, imp.pages, imp.images]);
  const use = async (a) => {
    try { await api(`/siteimport/${imp.id}/asset/`, { method: "POST", body: { media: a.media, role: pick[a.media] || (ROLE_NAME[a.role] && a.role !== "image" ? a.role : "logo") } }); setMsg({ ok: true, text: tx("Ingesteld. Zie Logo's & beeld.") }); onChanged(); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  };
  const savePage = async (key, patch) => {
    try { setD(await api(`/siteimport/${imp.id}/page/`, { method: "POST", body: { key, ...patch } })); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  };
  if (!d) return <Busy />;
  return (
    <div className="si-detail">
      {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
      {d.notes?.length > 0 && <div className="alert">{d.notes.join(" ")}</div>}
      {info && info.sources.length > 0 && (() => {
        const dest = (x) => (x.key in map ? map[x.key] : "");
        const rowsOf = (k) => info.targets.find((t) => t.key === k) || {};
        const needMode = info.sources.some((x) => (rowsOf(dest(x)).rows || 0) > 0);
        const canReplace = info.sources.some((x) => (rowsOf(dest(x)).own_rows || 0) > 0);
        const L = info.links || [];
        const pick = (f) => L.filter(f).map((l) => ({ key: l.key, title: l.label, sub: l.href }));
        const parts = { header: pick((l) => l.where === "header"), footer: pick((l) => l.where === "footer"), links: pick((l) => l.where === "page" && l.kind === "link"), buttons: pick((l) => l.where === "page" && l.kind === "button") };
        const n = (k) => parts[k].filter((l) => linkMap[l.key]).length;
        const linkTab = (k, intro) => (<div>
          <p className="muted" style={{ margin: "0 0 .6rem" }}>{intro}</p>
          {parts[k].length ? <PageMapper multi sources={parts[k]} targets={info.link_targets} map={linkMap} onChange={(m) => setLinkMap((o) => ({ ...Object.fromEntries(Object.entries(o).filter(([key]) => !parts[k].some((l) => l.key === key))), ...m }))} freeLabel={tx("Niet koppelen (het adres blijft zoals het was)")} freeSub={tx("Zet een link hierop om hem los te koppelen")} />
            : <p className="muted">{tx("Geen gevonden in de bestanden.")}</p>}
        </div>);
        const tabsDef = [["pages", "Pagina's"], ["links", "Links", null, n("links")], ["buttons", "Knoppen", null, n("buttons")], ["header", "Header", null, hdrOn ? 1 : 0], ["footer", "Footer", null, n("footer")], ["theme", "Thema"]];
        const set = (k, v) => setThm((o) => ({ ...o, [k]: v }));
        return (
          <div className="card" id={`si-map-${imp.id}`} style={{ borderColor: "var(--blue)" }}>
            <strong>{imp.apply?.state === "done" ? tx("Opnieuw toepassen") : tx("Pagina's koppelen en toepassen")}</strong>
            <p className="muted" style={{ margin: ".3rem 0 .8rem" }}>{tx("De originele html is bewaard: je kunt dit zo vaak herhalen, ook met een nieuwe opdracht voor Claude. Kies per tabblad wat er gebeurt en klik onderaan op Toepassen.")}</p>
            <Tabs value={atab} onChange={setAtab} tabs={tabsDef} />
            {atab === "pages" && (<div>
              <PageMapper sources={info.sources.map((x) => ({ key: x.key, title: x.title, sub: x.path }))} targets={info.targets} map={map} onChange={setMap} freeLabel={tx("Eigen pagina van de import")} />
              <ApplyOptions opts={opts} setOpts={setOpts} needMode={needMode} canReplace={canReplace} languages={info.languages} />
            </div>)}
            {atab === "links" && linkTab("links", tx("Links in de tekst van de pagina's. Koppel ze aan een pagina of onderdeel van je website; sleep een link op een onderdeel rechts, of andersom."))}
            {atab === "buttons" && linkTab("buttons", tx("Knoppen op de pagina's (zoals Start uw BV). Koppel ze aan een pagina of onderdeel van je website."))}
            {atab === "header" && (<div className="form">
              <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={hdrOn} onChange={(e) => setHdrOn(e.target.checked)} /><span /></span><span>{tx("De header van het systeem aanpassen aan die van het bestand")} <small className="muted">{tx("Kleuren, hoogte en grotere knoppen. De links en knoppen van de header worden menu-items. Alleen bij Bewerkbaar; bij Exact heeft de pagina zijn eigen header.")}</small></span></label>
              {linkTab("header", tx("Links en knoppen in de header van het bestand: kies waar ze naartoe gaan in je website."))}
            </div>)}
            {atab === "footer" && (<div className="form">
              <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={footOn} onChange={(e) => setFootOn(e.target.checked)} /><span /></span><span>{tx("De footer van het systeem tonen onder de pagina's")} <small className="muted">{tx("Alleen bij Bewerkbaar.")}</small></span></label>
              {linkTab("footer", tx("Links in de footer van het bestand: kies waar ze naartoe gaan in je website."))}
            </div>)}
            {atab === "theme" && (<div className="form">
              <p className="muted" style={{ margin: 0 }}>{tx("De instellingen van het thema dat uit het bestand is gemaakt, zoals bij Thema. Wat je hier wijzigt, geldt voor het thema van deze import.")}</p>
              <div className="grid2">
                {[["primary", "Hoofdkleur"], ["secondary", "Tweede kleur"]].map(([k, l]) => <label key={k}>{tx(l)}<input type="color" value={thm[k] || "#7b2ce0"} onChange={(e) => set(k, e.target.value)} /></label>)}
                <label>{tx("Standaard weergave")}<select value={thm.default_mode || "system"} onChange={(e) => set("default_mode", e.target.value)}><option value="system">{tx("Volgt het apparaat")}</option><option value="light">{tx("Licht")}</option><option value="dark">{tx("Donker")}</option></select></label>
                <label>{tx("Breedte van de inhoud")} (px)<input type="number" min="720" max="1600" step="20" value={thm.content_w || 1100} onChange={(e) => set("content_w", Number(e.target.value))} /></label>
                <label>{tx("Ronde hoeken")} (px)<input type="number" min="0" max="40" value={thm.radius ?? 12} onChange={(e) => set("radius", Number(e.target.value))} /></label>
                <label>{tx("Ronde hoeken van knoppen")} (px)<input type="number" min="0" max="40" value={thm.btn_radius ?? 10} onChange={(e) => set("btn_radius", Number(e.target.value))} /></label>
              </div>
            </div>)}
            <div className="row" style={{ justifyContent: "flex-start", marginTop: ".8rem" }}><button className="btn primary" disabled={busy} onClick={() => onApply(imp, Object.fromEntries(info.sources.map((x) => [x.key, map[x.key] || ""])), { ...opts, options: { links: Object.fromEntries(Object.entries(linkMap).filter(([, v]) => v)), header: hdrOn, site_footer: footOn, theme: thm } })}>{imp.apply?.state === "done" ? tx("Opnieuw toepassen") : tx("Toepassen")}</button></div>
          </div>
        );
      })()}
      <div>
        <strong>{tx("Pagina's")} ({d.page_list.length + (d.targets || []).length})</strong>
        <div className="si-pagerows">
          {[...(d.targets || []).map((t) => ({ key: t.key, title: t.page_title || t.title, path: t.path, in_menu: t.in_menu, enabled: t.enabled !== false, note: tx("ontwerp op een bestaande pagina") })), ...d.page_list.map((p) => ({ key: p.key, title: p.title, path: p.path, in_menu: p.in_menu, enabled: p.enabled, note: p.design ? tx("1 op 1 uit het bestand") : tx("bewerkbare blokken") }))].map((p) => (
            <div className="si-pagerow" key={p.key}>
              <input defaultValue={p.title} aria-label={tx("Naam")} onBlur={(e) => { if (e.target.value.trim() && e.target.value.trim() !== p.title) savePage(p.key, { title: e.target.value }); }} />
              <small className="muted">{p.path} · {p.note}</small>
              <label className="check"><span className="switch"><input type="checkbox" checked={!!p.in_menu} onChange={(e) => savePage(p.key, { in_menu: e.target.checked })} /><span /></span><span>{tx("In menu")}</span></label>
              <label className="check"><span className="switch"><input type="checkbox" checked={p.enabled !== false} onChange={(e) => savePage(p.key, { enabled: e.target.checked })} /><span /></span><span>{tx("Zichtbaar")}</span></label>
              <a className="btn sm" href={p.path} target="_blank" rel="noreferrer">{tx("Bekijken")}</a>
            </div>
          ))}
        </div>
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
function Proposal({ imp, onDone, onCancel, onPreview }) {
  const pr = imp.proposal;
  const [tab, setTab] = useState(pr.theme.ai ? "theme" : "profile");
  const [name, setName] = useState(pr.theme.name);
  const [profile, setProfile] = useState(pr.profile.key);
  const [useProfile, setUseProfile] = useState(true);
  const [pages, setPages] = useState(pr.pages.map((p) => ({ i: p.i, include: true, title: p.title, in_menu: p.in_menu, target: p.suggest || "" })));
  const [home, setHome] = useState(!!pr.home.title);
  const [assets, setAssets] = useState(pr.assets.map((a) => ({ file: a.file, include: true, role: a.role })));
  const [useTheme, setUseTheme] = useState(true);
  const [mods, setMods] = useState((pr.modules || []).map((m) => ({ key: m.key, include: m.include })));
  const [opts, setOpts] = useState({ prompt: "", mode: "clear", translate: (pr.languages || []).length > 0, render: "design" });
  const [direct, setDirect] = useState(true); // apply (build the pages with blocks) right after the import
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const setP = (i, patch) => setPages((l) => l.map((x) => (x.i === i ? { ...x, ...patch } : x)));
  const setA = (f, patch) => setAssets((l) => l.map((x) => (x.file === f ? { ...x, ...patch } : x)));
  const nPages = pages.filter((p) => p.include).length, nAssets = assets.filter((a) => a.include).length;

  const approve = async () => {
    setBusy(true); setErr("");
    try { const r = await api(`/siteimport/${imp.id}/approve/`, { method: "POST", body: { name, profile: useProfile ? profile : null, pages, home: { include: home }, assets, theme: { include: useTheme }, modules: mods } }); onDone(r, direct && pr.design ? { opts } : null); }
    catch (e) { setErr(errorText(e)); setBusy(false); }
  };

  return (
    <div className="card si-proposal" id="si-proposal">
      <div className="si-head">
        <div className="grow"><strong style={{ fontSize: "1.1rem" }}>{tx("Voorstel voor")} “{imp.name}”</strong><br /><small className="muted">{tx("Bron")}: {imp.source} · {tx("Bestanden in")} <code>{imp.folder}</code></small></div>
      </div>
      <p className="muted" style={{ margin: 0 }}>{tx("Controleer het voorstel. Er is nog niets aan je site veranderd: pas na je akkoord worden de pagina's en afbeeldingen aangemaakt.")}</p>
      {imp.notes?.length > 0 && <div className="alert">{imp.notes.join(" ")}</div>}
      {pr.design && pr.pages.length > 0 && <p className="muted" style={{ margin: 0 }}>{tx("Koppel bij het tabblad Koppelen en verbeteren elke pagina aan een pagina van je website (bijvoorbeeld de startpagina), of laat hem een nieuwe pagina worden. Wat daar stond komt terug als je de import verwijdert.")}</p>}
      {pr.design && <div className="alert ok">{tx("De pagina's worden 1 op 1 overgenomen, met hun eigen opmaak. De header en footer van de site staan op die pagina's uit; zet ze aan bij de instellingen van de pagina.")}</div>}
      <Tabs value={tab} onChange={setTab} tabs={[...(pr.theme.ai ? [["theme", "Thema"]] : []), ["profile", "Profielen"], ["pages", "Pagina's", null, nPages + (home ? 1 : 0)], ...(pr.design && (pr.targets || []).length ? [["link", "Koppelen en verbeteren", null, pages.filter((p) => p.include && p.target).length]] : []), ["assets", "Afbeeldingen", null, nAssets], ...(pr.modules?.length ? [["modules", "Modules", null, mods.filter((m) => m.include).length]] : [])]} />

      {tab === "theme" && (
        <div className="form">
          <p className="muted" style={{ margin: 0 }}>{tx("Claude heeft uit de kleuren, lettertypen en vormen van het bestand een thema gemaakt.")} {pr.theme.description}</p>
          <div className="row" style={{ justifyContent: "flex-start", alignItems: "center" }}><strong>{pr.theme.name}</strong><Swatches colors={[pr.theme.values?.primary, pr.theme.values?.secondary, ...(pr.theme.palette || []).slice(0, 5)].filter((c, k, a) => c && a.indexOf(c) === k)} /></div>
          <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={useTheme} onChange={(e) => setUseTheme(e.target.checked)} /><span /></span><span>{tx("Thema maken")} <small className="muted">{tx("Het thema komt in de themabibliotheek en kan hierna met één klik worden gebruikt.")}</small></span></label>
        </div>
      )}

      {tab === "modules" && (
        <div className="form">
          <p className="muted" style={{ margin: 0 }}>{tx("Deze modules heeft de inhoud nodig om te werken. Ze worden aangezet bij je akkoord.")}</p>
          {pr.modules.map((m) => { const c = mods.find((x) => x.key === m.key); return (
            <label key={m.key} className="check sec-toggle"><span className="switch"><input type="checkbox" checked={!!c?.include} onChange={(e) => setMods((l) => l.map((x) => (x.key === m.key ? { ...x, include: e.target.checked } : x)))} /><span /></span><span><strong>{tx(m.label)}</strong> <small className="muted">{m.reason}</small></span></label>); })}
        </div>
      )}

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
          {pr.home.title && <label className="check"><input type="checkbox" checked={home} onChange={(e) => setHome(e.target.checked)} /> <span><strong>{tx("Startpagina")}</strong>: {pr.home.title} <small className="muted">— {pr.home.preview}</small></span></label>}
          {pr.design && (
            <div className="si-pagelist">
              {pr.pages.map((p) => { const c = pages.find((x) => x.i === p.i); return (
                <div key={p.i} className="si-pagerow" style={{ opacity: c.include ? 1 : .5 }}>
                  <input type="checkbox" checked={c.include} onChange={(e) => setP(p.i, { include: e.target.checked })} aria-label={tx("Meenemen")} />
                  <div className="grow">
                    <input value={c.title} maxLength={80} onChange={(e) => setP(p.i, { title: e.target.value })} aria-label={tx("Titel")} />
                    <small className="muted"><code>{p.path}</code>{p.preview ? ` · ${p.preview}` : ""}</small>
                  </div>
                  <label className="check" title={c.target ? tx("Een pagina die op een bestaande pagina komt, staat niet in het menu") : ""}><input type="checkbox" checked={c.in_menu && !c.target} disabled={!c.include || !!c.target} onChange={(e) => setP(p.i, { in_menu: e.target.checked })} /> {tx("In menu")}</label>
                  <button type="button" className="btn sm" onClick={() => onPreview(p.i)}>{tx("Voorbeeld bekijken")}</button>
                </div>); })}
            </div>
          )}
          {!pr.design && <div className="table-wrap"><table>
            <thead><tr><th /><th>{tx("Titel")}</th><th>{tx(pr.design ? "Bestand" : "Adres op de oude site")}</th><th>{tx("In menu")}</th></tr></thead>
            <tbody>
              {pr.pages.map((p) => { const c = pages.find((x) => x.i === p.i); return (
                <tr key={p.i}>
                  <td><input type="checkbox" checked={c.include} onChange={(e) => setP(p.i, { include: e.target.checked })} /></td>
                  <td><input value={c.title} maxLength={80} onChange={(e) => setP(p.i, { title: e.target.value })} />{pr.design && <button type="button" className="btn sm" style={{ marginTop: ".3rem" }} onClick={() => onPreview(p.i)}>{tx("Voorbeeld bekijken")}</button>}<small className="muted">{p.preview}</small></td>
                  <td><code>{p.path}</code></td>
                  <td><input type="checkbox" checked={c.in_menu && !c.target} disabled={!c.include || !!c.target} onChange={(e) => setP(p.i, { in_menu: e.target.checked })} /></td>

                </tr>); })}
            </tbody>
          </table></div>}
          {!pr.pages.length && <p className="muted" style={{ margin: 0 }}>{tx("Geen aparte pagina's gevonden.")}</p>}
        </div>
      )}

      {tab === "link" && (
        <div>
        <PageMapper sources={pages.filter((p) => p.include).map((p) => ({ key: String(p.i), title: p.title, sub: pr.pages.find((x) => x.i === p.i)?.path }))} targets={pr.targets || []}
          map={Object.fromEntries(pages.filter((p) => p.include && p.target).map((p) => [String(p.i), p.target]))}
          onChange={(m) => setPages((l) => l.map((x) => ({ ...x, target: m[String(x.i)] || "" })))} freeLabel={tx("Nieuwe pagina maken")} />
        <ApplyOptions opts={opts} setOpts={setOpts} languages={pr.languages}
          needMode={pages.some((p) => p.include && p.target && ((pr.targets || []).find((t) => t.key === p.target) || {}).rows > 0)} canReplace={false} />
        <label className="check sec-toggle" style={{ marginTop: "1rem" }}><span className="switch"><input type="checkbox" checked={direct} onChange={(e) => setDirect(e.target.checked)} /><span /></span><span>{tx("Direct na het importeren toepassen")} <small className="muted">{tx("Claude bouwt de pagina's dan meteen op met blokken die je kunt aanpassen. Uit: de pagina's staan eerst als ontwerp en je past ze later toe.")}</small></span></label>
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
        <button className="btn primary" disabled={busy || !name.trim()} onClick={approve}>{busy ? tx("Bezig…") : direct && pr.design ? tx("Akkoord: importeren en toepassen") : tx("Akkoord: importeren")}</button>
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
  const htmlFile = useRef(null);

  const load = useCallback(() => api("/siteimport/").then((d) => { markImported(d.imports.length > 0); setList(d.imports); setOpen((o) => o ?? (d.imports.find((x) => x.apply?.pending) || {}).id ?? null); setFolders(d.folders); setFolder((f) => f || d.folders[0] || ""); }).catch((e) => setMsg({ ok: false, text: errorText(e) })), []);
  useEffect(() => { load(); }, [load]);

  const run = async (label, fn, okText) => {
    setBusy(label); setMsg(null);
    try { const r = await fn(); await load(); setMsg({ ok: true, text: okText ? okText(r) : tx("Klaar.") }); return r; }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    finally { setBusy(""); }
  };
  const done = (r) => tx("\"{0}\" is ingelezen. Controleer hieronder het voorstel; pas na je akkoord wordt er iets aangemaakt.", r.name);
  const start = (body) => run("import", () => api("/siteimport/", { method: "POST", body }), done).then((r) => { if (r) { setProposal(r); showProposal(); } });
  const importZip = (e) => { const f = e.target.files[0]; e.target.value = ""; if (!f) return; const fd = new FormData(); fd.append("kind", "zip"); fd.append("file", f); fd.append("name", themeName); start(fd); };
  const importHtml = (e) => { const fl = Array.from(e.target.files || []); e.target.value = ""; if (!fl.length) return; const fd = new FormData(); fd.append("kind", "html"); fl.forEach((f) => fd.append("file", f)); fd.append("name", themeName); start(fd); };
  const showProposal = () => setTimeout(() => document.getElementById("si-proposal")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);  // the proposal stands above the list: bring it into view
  const [prog, setProg] = useState(null); // {name, percent, step, error, built}: the progress of an application (Toepassen)
  const applyImport = (i) => { // the columns to link the pages are in the details of the import
    setOpen(i.id);
    setTimeout(() => document.getElementById(`si-map-${i.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 250);
  };
  const runApply = async (i, map, opts = {}) => {
    setProg({ name: i.name, percent: 1, step: tx("Starten…"), error: "", built: [] });
    try {
      let st = await api(`/siteimport/${i.id}/apply/`, { method: "POST", body: { ...(map ? { map } : {}), mode: opts.mode || "clear", prompt: opts.prompt || "", translate: !!opts.translate, render: opts.render || "design", options: opts.options || {} } });
      setProg((p) => ({ ...p, ...st }));
      while (st.state === "running" && !st.stale) {
        await new Promise((r) => setTimeout(r, 1500));
        st = await api(`/siteimport/${i.id}/apply/`);
        setProg((p) => ({ ...p, ...st }));
      }
      if (st.state === "running") setProg((p) => ({ ...p, error: tx("De server reageert niet meer. Probeer het straks nog eens.") }));
    } catch (e) { setProg((p) => ({ ...p, error: errorText(e), state: "error" })); }
    await load();
  };
  const [shown, setShown] = useState(null); // {title, path}: a page of the site in a window
  const [view, setView] = useState(null); // the design of one page, to look at
  const openPreview = async (id, n) => { try { setView(await api(`/siteimport/${id}/preview/${n}/`)); } catch (e) { setMsg({ ok: false, text: errorText(e) }); } };
  const review = async (i) => { try { setProposal(await api(`/siteimport/${i.id}/`)); showProposal(); } catch (e) { setMsg({ ok: false, text: errorText(e) }); } };
  const cancelProposal = async (i) => {
    if (!(await confirmDialog(tx("Dit voorstel weggooien? De ingelezen bestanden worden verwijderd."), { danger: true, title: tx("Voorstel weggooien"), okLabel: tx("Weggooien") }))) return;
    await run("cancel", () => api(`/siteimport/${i.id}/`, { method: "DELETE" }), () => tx("Weggegooid."));
    setProposal(null);
  };
  const approved = async (r, req) => { setProposal(null); await load(); setOpen(r.id); if (req) { runApply(r, null, req.opts); return; } const where = [...(r.targets || []).map((t) => `${t.title} (${t.path})`), ...(r.page_list || []).map((p) => `${p.title} (${p.path})`)]; setMsg({ ok: true, text: tx("Import \"{0}\" is aangemaakt in de map {1}.", r.name, r.folder) + (where.length ? " " + tx("Je vindt de pagina's hier:") + " " + where.join(", ") : "") }); };
  const toggle = (i, what, on) => run(what + i.id, () => api(`/siteimport/${i.id}/${what}/`, { method: "POST", body: { apply: on } }), () => (on ? tx("Gebruikt.") : tx("Teruggezet.")));
  const remove = async (i) => {
    if (!(await confirmDialog(tx("\"{0}\" verwijderen? De {1} pagina's en de {2} afbeeldingen die hiervan zijn ingelezen worden ook verwijderd. Het profieltype en de startpagina gaan terug naar hoe ze waren.", i.name, i.pages, i.images), { danger: true, title: tx("Import verwijderen"), okLabel: tx("Verwijderen") }))) return;
    await run("del" + i.id, () => api(`/siteimport/${i.id}/`, { method: "DELETE" }), (r) => [tx("Verwijderd, met alles wat ervan was ingelezen."), ...(r?.done || []).map((x) => tx(x)), ...(r?.leftovers || []).map((x) => tx(x)), ...(r?.problems || []).map((x) => tx(x)), r?.advice ? tx(r.advice) : ""].filter(Boolean).join(" "));
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
          <Tabs value={tab} onChange={setTab} tabs={[["url", "Website-adres", <IconGlobe key="u" />], ["folder", "Map op de server", <IconFolder key="f" />], ["zip", "ZIP-bestand", <IconImage key="z" />], ["html", "HTML-bestand", <IconGlobe key="h" />]]} />
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
          {tab === "html" && (
            <div style={{ marginTop: ".75rem" }}>
              <div className="dropzone" role="button" tabIndex={0} onClick={() => htmlFile.current.click()} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && htmlFile.current.click()}
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); importHtml({ target: { files: e.dataTransfer.files, value: "" } }); }}>
                <span>{busy === "import" ? tx("Claude leest de bestanden en maakt het voorstel… dit duurt even.") : tx("Sleep één of meer html-bestanden hierheen (met eventueel de css en de afbeeldingen) of klik om te kiezen")}</span>
                <input ref={htmlFile} type="file" multiple accept=".html,.htm,.css,image/*,text/html" hidden onChange={importHtml} />
              </div>
            </div>
          )}
          <small className="muted" style={{ display: "block", marginTop: ".6rem" }}>
            {tab === "html" ? tx("Eén of meer html-bestanden, elk bestand wordt een pagina met precies dezelfde opmaak. Sleep de css en de afbeeldingen er ook bij. Claude maakt het thema met de kleuren, geeft de pagina's een naam en zet de modules aan die nodig zijn. Eerst zie je het voorstel; er is pas iets aangemaakt na je akkoord.") : tab === "folder" ? tx("Zet de map van de andere site in de map \"imports\" naast de backend (bijvoorbeeld backend/imports/mijnsite). Er moet een index.html in staan.") : tab === "zip" ? tx("Een ZIP met de html-, css- en afbeeldingsbestanden van de site, met een index.html.") : tx("Alleen openbare websites. Er worden maximaal 12 pagina's en 40 afbeeldingen ingelezen.")}
          </small>
        </Collapsible>
      )}

      {prog && typeof document !== "undefined" && createPortal(
        <div className="pb-objback">
          <div className="pb-objpop" role="dialog" aria-label={tx("Toepassen")} style={{ width: "min(520px, 94vw)" }}>
            <div className="pb-objhead"><strong>{tx("Toepassen")}: {prog.name}</strong><span style={{ flex: 1 }} />{prog.state !== "running" && <button type="button" className="pb-panelx" onClick={() => setProg(null)} aria-label={tx("Sluiten")}>×</button>}</div>
            <div style={{ padding: "1rem 1.2rem 1.4rem", display: "flex", flexDirection: "column", gap: ".8rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>{prog.error ? tx("Mislukt") : prog.step}</span><strong>{Math.round(prog.percent || 0)} %</strong></div>
              <div style={{ height: 10, borderRadius: 999, background: "var(--line)", overflow: "hidden" }}><div style={{ width: `${Math.max(2, Math.min(100, prog.percent || 0))}%`, height: "100%", background: prog.error ? "var(--danger)" : "var(--blue)", transition: "width .4s" }} /></div>
              {prog.error && <div className="alert">{prog.error}</div>}
              {prog.state === "done" && prog.warning && <div className="alert">{prog.warning}</div>}
              {prog.state === "done" && <div className="alert ok">{tx("Klaar. De pagina's zijn opgebouwd:")} {(prog.built || []).map((b) => <a key={b.path} href={b.path} target="_blank" rel="noreferrer" style={{ marginLeft: ".4rem" }}>{b.title}</a>)}</div>}
              {prog.state !== "running" && <div className="row" style={{ justifyContent: "flex-start" }}>
                {prog.state === "done" && !prog.error && (prog.built || []).map((b, n, all) => <a key={b.path} className={`btn${n === 0 ? " primary" : ""}`} href={b.path}>{all.length > 1 ? `${tx("Ga naar")} ${b.title}` : tx("Ga naar pagina")}</a>)}
                <button className="btn" onClick={() => setProg(null)}>{tx("Sluiten")}</button>
              </div>}
            </div>
          </div>
        </div>, document.body)}
      {shown && typeof document !== "undefined" && createPortal(
        <DevicePopup title={`${tx("Pagina")}: ${shown.title}`} sub={shown.path} link={shown.path} onClose={() => setShown(null)}>
          <iframe title={shown.title} src={shown.path} style={{ display: "block", width: "100%", height: "100%", border: 0, background: "#fff" }} />
        </DevicePopup>, document.body)}
      {view && typeof document !== "undefined" && createPortal(
        <DevicePopup title={`${tx("Voorbeeld")}: ${view.title}`} onClose={() => setView(null)} scrollHere>
          <DesignFrame html={view.design} title={view.title} />
        </DevicePopup>, document.body)}
      {proposal && proposal.status === "proposal" && proposal.proposal?.theme && <Proposal key={proposal.id} imp={proposal} onDone={approved} onCancel={() => cancelProposal(proposal)} onPreview={(n) => openPreview(proposal.id, n)} />}

      <Collapsible id="si-list" title={`${tx("Geïmporteerde sites")} (${list?.length ?? 0})`} defaultOpen>
        {!list && <Busy />}
        {list && !list.length && <p className="muted" style={{ margin: 0 }}>{tx("Nog niets geïmporteerd.")}</p>}
        {(list || []).filter((i) => i.status === "analysing").map((i) => (
          <div key={i.id} className="card si-card">
            <div className="si-head"><div className="grow"><strong style={{ fontSize: "1.05rem" }}>{i.name}</strong> <span className="badge off">{tx("Bezig met analyseren…")}</span><br /><small className="muted">{i.source}</small></div></div>
            <div className="row" style={{ justifyContent: "flex-start" }}><button className="btn" onClick={load}>{tx("Verversen")}</button><button className="btn danger" onClick={() => cancelProposal(i)}>{tx("Weggooien")}</button></div>
          </div>
        ))}
        {(list || []).filter((i) => i.status === "proposal").map((i) => (
          <div key={i.id} className="card si-card">
            <div className="si-head"><div className="grow"><strong style={{ fontSize: "1.05rem" }}>{i.name}</strong> <span className="badge off">{tx("Wacht op controle")}</span><br /><small className="muted">{i.source} · <code>{i.folder}</code></small></div></div>
            <div className="row" style={{ justifyContent: "flex-start" }}><button className="btn primary" onClick={() => review(i)}>{tx("Voorstel bekijken")}</button><button className="btn danger" onClick={() => cancelProposal(i)}>{tx("Weggooien")}</button></div>
          </div>
        ))}
        {(list || []).filter((i) => i.status !== "proposal" && i.status !== "analysing").map((i) => (
          <div key={i.id} className="card si-card">
            <div className="si-head">
              <div className="grow">
                <strong style={{ fontSize: "1.05rem" }}>{i.name}</strong> <span className="badge">{tx(i.kind === "url" ? "Website" : i.kind === "zip" ? "ZIP" : i.kind === "html" ? "HTML" : "Map")}</span> <StatusBadge imp={i} />
                <br /><small className="muted">{i.source} · {tx("map")} <code>{i.folder}</code> · {new Date(i.created_at).toLocaleString()}</small>
              </div>
              <Swatches colors={[i.theme.primary, i.theme.secondary, ...(i.theme.palette || []).slice(0, 4)].filter((c, k, a) => c && a.indexOf(c) === k)} />
            </div>
            <div className="si-stats">
              <span><strong>{i.pages}</strong> {tx("pagina's")}</span><span><strong>{i.images}</strong> {tx("afbeeldingen")}</span>
              {i.theme.profile && <span className="badge">{tx("Profielen")}: {tx(PROFILE_LABEL[i.theme.profile])}</span>}
              {i.theme.modules?.length > 0 && <span className="badge ok">{tx("Modules aangezet")}: {i.theme.modules.join(", ")}</span>}
            </div>
            <div className="row" style={{ justifyContent: "flex-start" }}>
              {canManage && (i.theme.profile || i.theme.has_values) && (i.theme.applied
                ? <button className="btn" disabled={!!busy} onClick={() => toggle(i, "theme", false)}>{tx(i.theme.has_values ? "Thema terugzetten" : "Profieltype terugzetten")}</button>
                : <button className="btn primary" disabled={!!busy} onClick={() => toggle(i, "theme", true)}>{tx(i.theme.has_values ? "Thema gebruiken" : "Profieltype gebruiken")}</button>)}
              {canManage && i.home.exists && (i.home.applied
                ? <button className="btn" disabled={!!busy} onClick={() => toggle(i, "home", false)}>{tx("Startpagina terugzetten")}</button>
                : <button className="btn" disabled={!!busy} onClick={() => toggle(i, "home", true)}>{tx("Startpagina overnemen")}</button>)}
              <button className="btn" onClick={() => setOpen(open === i.id ? null : i.id)}>{open === i.id ? tx("Sluiten") : tx("Pagina's en afbeeldingen")}</button>
              {canManage && i.apply?.pending && <button className="btn primary" disabled={!!busy || !!prog} onClick={() => applyImport(i)}>{i.apply?.state === "done" ? tx("Opnieuw toepassen") : tx("Toepassen")}</button>}
              {(i.paths || []).map((x) => <button key={x.path} className="btn" onClick={() => setShown(x)}>{tx("Pagina bekijken")}: {x.title}</button>)}
              {canManage && <button className="btn danger" disabled={!!busy} onClick={() => remove(i)}>{tx("Verwijderen")}</button>}
            </div>
            {open === i.id && <Detail imp={i} onChanged={load} onApply={runApply} busy={!!busy || !!prog} />}
          </div>
        ))}
      </Collapsible>
    </>
  );
}
