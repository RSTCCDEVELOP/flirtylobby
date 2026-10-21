"use client";

import { useEffect, useRef, useState } from "react";
import { api, apiBase, downloadFile, errorText } from "../lib/api";
import { confirmDialog } from "../lib/dialog";
import { useAuth } from "./AuthContext";
import { useAutoSave } from "../lib/autosave";
import { tx } from "../lib/t";
import { IconEye, IconGrid, IconSettings } from "./Icons";
import MediaField from "./MediaField";
import SaveStatus from "./SaveStatus";
import Tabs from "./Tabs";

// A field of a plugin's settings (the plugin describes them in plugin.json)
function Field({ c, value, onChange }) {
  const label = <>{c.label}{c.hint && <small className="muted"> {c.hint}</small>}</>;
  if (c.type === "bool") return <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /><span /></span><span>{label}</span></label>;
  if (c.type === "textarea") return <label>{label}<textarea rows={4} value={value ?? ""} onChange={(e) => onChange(e.target.value)} /></label>;
  if (c.type === "select") return <label>{label}<select value={value ?? ""} onChange={(e) => onChange(e.target.value)}>{c.options.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>;
  if (c.type === "secret") return <label>{label}<input type="password" autoComplete="new-password" value={value === true ? "" : value ?? ""} placeholder={value === true ? tx("Ingesteld (laat leeg om te behouden)") : ""} onChange={(e) => onChange(e.target.value)} /></label>;
  return <label>{label}<input type={c.type === "number" ? "number" : "text"} value={value ?? ""} onChange={(e) => onChange(e.target.value)} /></label>;
}

// Warnings about one plugin: version against the system, signature, languages
export function PluginWarnings({ p }) {
  const items = [];
  if (p.signature === "invalid") items.push(["bad", tx("De ondertekening van deze plugin klopt niet: hij is gewijzigd na het ondertekenen. Hij draait niet.")]);
  else if (p.signature === "missing") items.push([p.dev_mode ? "info" : "bad", p.dev_mode ? tx("Ontwikkelversie: niet ondertekend. Draait alleen in de ontwikkelomgeving; bouw hem met plugin_build voor gebruik elders.") : tx("Niet ondertekend: alleen plugins van onze ontwikkelaar draaien hier.")]);
  if (p.compat === "outdated") items.push(["warn", tx("Niet meer up-to-date: deze plugin is gemaakt voor systeemversie {0}, het systeem is nu {1}. Werk de plugin bij.", p.built_for, p.system_version)]);
  else if (p.compat === "incompatible") items.push(["bad", tx("Deze plugin is gemaakt voor systeemversie {0} en werkt niet met versie {1}. Werk de plugin bij.", p.built_for, p.system_version)]);
  else if (p.compat === "newer") items.push(["warn", tx("Deze plugin is gemaakt voor een nieuwere systeemversie ({0}); het systeem is {1}. Werk het systeem bij.", p.built_for, p.system_version)]);
  if (p.languages?.missing?.length) items.push(["warn", tx("Niet in alle talen vertaald. Ontbreekt: {0}.", p.languages.missing.join(", "))]);
  return items.map(([k, text], i) => <div key={i} className={k === "bad" ? "alert" : k === "info" ? "alert ok" : "alert"} style={k === "warn" ? { background: "#fef3c7", color: "#78350f" } : undefined}>{text}</div>);
}

// Settings of one plugin; they are saved by themselves
export function PluginConfig({ p, onSaved }) {
  const [cfg, setCfg] = useState(p.config);
  const save = async () => { try { onSaved(await api(`/plugins/${p.name}/`, { method: "PATCH", body: { config: cfg } })); } catch { return false; } };
  const auto = useAutoSave(cfg, save, { delay: 1000 });
  if (!p.config_schema.length) return <p className="muted" style={{ margin: 0 }}>{tx("Deze plugin heeft geen instellingen.")}</p>;
  return (
    <div className="form">
      {p.config_schema.map((c) => <Field key={c.key} c={c} value={cfg[c.key]} onChange={(v) => setCfg((x) => ({ ...x, [c.key]: v }))} />)}
      <SaveStatus auto={auto} />
    </div>
  );
}


const GROUPS = [["mine", "Mijn community"], ["contact", "Contact"], ["other", "Los in het menu (zonder groep)"]];

// Where the plugin sits in the member dashboard, and whether it may be put on a page as a system object (each change is saved at once)
export function PluginPlacement({ p, onSaved }) {
  const [err, setErr] = useState("");
  const patch = async (body) => { setErr(""); try { onSaved(await api(`/plugins/${p.name}/`, { method: "PATCH", body })); window.dispatchEvent(new Event("plugins-changed")); } catch (e) { setErr(e?.message || tx("Opslaan mislukt.")); } }; // (the menus follow at once)
  return (
    <div className="form">
      {err && <div className="alert">{err}</div>}
      <h3 style={{ margin: 0 }}>{tx("Beheer: menu en tegels")}</h3>
      <label>{tx("Plaats de beheerpagina van deze plugin bij")}
        <select value={p.section} onChange={(e) => patch({ admin_section: e.target.value })}>{Object.entries(SECTION_LABEL).map(([k, l]) => <option key={k} value={k}>{tx(l)}{k === p.section_default ? ` (${tx("standaard")})` : ""}</option>)}</select>
      </label>
      <small className="muted">{tx("Hier staat de plugin in het Admin-menu en op de tegelpagina van die groep (bijvoorbeeld Orders bij Webshop).")}</small>
      <h3 style={{ margin: ".6rem 0 0" }}>{tx("Menu van het gebruikersdashboard")}</h3>
      {p.menu ? (
        <>
          <label>{tx("Plaats de pagina van deze plugin in")}
            <select value={p.menu_group} onChange={(e) => patch({ menu_group: e.target.value })}>{GROUPS.map(([k, l]) => <option key={k} value={k}>{tx(l)}</option>)}</select>
          </label>
          <small className="muted">{tx("Zichtbaar voor")} {p.menu.access === "members" ? tx("alle leden") : tx("alleen beheer")} · {tx("naam in het menu")}: {p.menu.label}</small>
        </>
      ) : <p className="muted" style={{ margin: 0 }}>{tx("Deze plugin heeft geen pagina in het menu van het gebruikersdashboard.")}</p>}
      {p.public_path && (
        <>
          <h3 style={{ margin: ".6rem 0 0" }}>{tx("Wie ziet de pagina")}</h3>
          <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={p.page_public} onChange={(e) => patch({ page_public: e.target.checked })} /><span /></span><span>{tx("Pagina publiek beschikbaar")} <small className="muted">{p.page_public ? tx("Iedereen opent de pagina op /{0}.", p.public_path) : tx("Alleen leden achter de login, op /dashboard/{0}.", p.public_path)}</small></span></label>
        </>
      )}
      <h3 style={{ margin: ".6rem 0 0" }}>{tx("Systeemobject voor een pagina")}</h3>
      {p.page_object_offered ? (
        <>
          <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={p.page_object} onChange={(e) => patch({ page_object: e.target.checked })} /><span /></span><span>{tx("Deze plugin mag als systeemobject op een pagina worden gezet")}</span></label>
          <small className="muted">{tx("Daarna kies je hem in de paginabewerker bij Systeemobject. Beheer: Admin → Systeemobjecten.")}</small>
        </>
      ) : <p className="muted" style={{ margin: 0 }}>{tx("Deze plugin biedt zichzelf niet aan als systeemobject (page_object in plugin.json).")}</p>}
    </div>
  );
}

export const SECTION_LABEL = { users: "Gebruikers", website: "Website", community: "Community", shop: "Webshop", subscription: "Subscription", system: "Systeem" };
const LANGS = { nl: "Nederlands", en: "English", ar: "العربية", de: "Deutsch", es: "Español", fr: "Français", pt: "Português", zh: "中文" };
const SIG = { valid: "Ondertekend door onze ontwikkelaar", invalid: "Ondertekening klopt niet", missing: "Niet ondertekend" };
const COMPAT = { current: "Up-to-date", outdated: "Niet meer up-to-date", incompatible: "Werkt niet met deze systeemversie", newer: "Gemaakt voor een nieuwere systeemversie" };

const Row = ({ label, children }) => <div className="plugin-row"><span className="muted">{label}</span><span>{children}</span></div>;

// Overview: what the plugin is and in what state it stands
export function PluginOverview({ p }) {
  return (
    <div className="stack-sm">
      <p style={{ margin: 0 }}>{p.description || tx("Geen omschrijving.")}</p>
      <div className="plugin-rows">
        <Row label={tx("Onderdeel")}>{tx(SECTION_LABEL[p.section] || p.section)}</Row>
        <Row label={tx("Plugin")}>{p.version}</Row>
        <Row label={tx("Gemaakt voor systeem")}>{p.built_for} <span className="muted">· {tx("nu")} {p.system_version}</span> <span className={`badge ${p.compat === "current" ? "ok" : "off"}`}>{tx(COMPAT[p.compat])}</span></Row>
        {p.author && <Row label={tx("Door")}>{p.author}</Row>}
        {p.menu && <Row label={tx("Menu gebruikers")}>{tx(GROUPS.find((g) => g[0] === p.menu_group)?.[1] || "")}</Row>}
        <Row label={tx("Systeemobject")}>{p.page_object ? tx("Ja, mag op een pagina") : tx("Nee")}</Row>
        <Row label={tx("Status")}><span className={`badge ${p.enabled ? "ok" : "off"}`}>{p.enabled ? tx("Aan") : tx("Uit")}</span></Row>
      </div>
      <PluginWarnings p={p} />
      {p.error && <div className="alert">{p.error}</div>}
    </div>
  );
}

// Details: signature, languages, what it uses
export function PluginDetails({ p }) {
  return (
    <div className="plugin-rows">
      <Row label={tx("Ondertekening")}><span className={`badge ${p.signature === "valid" ? "ok" : "off"}`}>{tx(SIG[p.signature])}</span>{p.dev_mode ? ` · ${tx("ontwikkelversie")}` : ""}</Row>
      <Row label={tx("Plugin")}>{p.version}</Row>
      <Row label={tx("Gemaakt voor systeem")}>{p.built_for}</Row>
      <Row label={tx("Systeemversie nu")}>{p.system_version}</Row>
      <Row label={tx("Talen")}>{p.languages.have.map((c) => LANGS[c] || c).join(", ")}{p.languages.missing.length ? <> · <strong>{tx("ontbreekt")}:</strong> {p.languages.missing.join(", ")}</> : ""}</Row>
      <Row label={tx("Onderdelen")}>{[p.has_python && tx("programma"), p.has_web && tx("eigen pagina"), p.admin_web && tx("beheerpagina")].filter(Boolean).join(", ") || "—"}</Row>
      {p.menu && <Row label={tx("Menu")}>{p.menu.label} · {p.menu.access === "admin" ? tx("alleen beheer") : tx("alle leden")}</Row>}
      <Row label={tx("Reageert op")}>{p.events.length ? p.events.map((e) => <span key={e} className="chip" style={{ cursor: "default", marginRight: ".3rem" }}>{e}</span>) : "—"}</Row>
      <Row label={tx("Gebruikt")}>{p.permissions.length ? p.permissions.map((x) => <span key={x} className="chip" style={{ cursor: "default", marginRight: ".3rem" }}>{x}</span>) : "—"}</Row>
    </div>
  );
}

// The tabs of one plugin, the same in the list and on its admin page: Overzicht, Instellingen, Details (+ extra tabs the page adds in front)
// The options of an item (a game) as a form: text, long text, number, on/off, choice and colour
function OptionField({ c, value, onChange }) {
  if (c.type === "bool") return <label className="check"><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /><span>{tx(c.label)} {c.hint && <small className="muted">{tx(c.hint)}</small>}</span></label>;
  return (
    <label>{tx(c.label)}
      {c.type === "select" ? <select value={value} onChange={(e) => onChange(e.target.value)}>{c.options.map((o) => <option key={o.value} value={o.value}>{tx(o.label)}</option>)}</select>
        : c.type === "textarea" ? <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
        : c.type === "color" ? <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ height: "2.6rem", padding: 2 }} />
        : <input type={c.type === "number" ? "number" : "text"} min={c.min ?? undefined} max={c.max ?? undefined} value={value} onChange={(e) => onChange(c.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)} />}
      {c.hint && c.type !== "bool" && <small className="muted">{tx(c.hint)}</small>}
    </label>
  );
}

// A game as a preview: the game runs in its own frame; this window answers the game like the games page does (nothing is saved)
function GamePreview({ p, item, config, onClose }) {
  const frame = useRef(null);
  const [src, setSrc] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { api(`/plugins/${p.name}/items/${item.name}/preview/`, { method: "POST" }).then((r) => setSrc(`${apiBase()}${r.path}`)).catch((e) => setErr(e?.message || tx("Het voorbeeld kon niet worden geladen."))); }, [p.name, item.name]);
  const { user } = useAuth();
  const settings = Object.fromEntries((item.settings_schema || []).map((c) => [c.key, c.default]));
  useEffect(() => {
    const on = (e) => {
      if (e.source !== frame.current?.contentWindow) return;
      const d = e.data || {}, reply = (data) => frame.current?.contentWindow?.postMessage({ game: "reply", id: d.id, ok: true, data }, "*");
      if (d.game === "hello") frame.current.contentWindow.postMessage({ game: "init", user: { id: user?.id, name: user?.first_name || user?.email }, best: null, state: null, lang: "nl", config, settings }, "*");
      else if (d.game === "score") reply({ best: d.score, rank: 1, isBest: true, top: [] });
      else if (d.game === "save" || d.game === "load") reply(null);
      else if (d.game === "fullscreen") { try { frame.current.requestFullscreen(); } catch {} }
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [config, user]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="overlay" style={{ zIndex: 4000 }} onClick={onClose}>
      <div className="card modal" style={{ maxWidth: 820, width: "100%" }} onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: "space-between" }}><h2 style={{ margin: 0 }}>{tx("Voorbeeld")}: {item.title}</h2><button type="button" className="btn" onClick={onClose}>{tx("Sluiten")}</button></div>
        <small className="muted">{tx("Zo ziet een lid het spel met de huidige configuratie. Scores en voortgang worden hier niet bewaard.")}</small>
        <div style={{ position: "relative", height: "min(62vh, 560px)", background: "#000", borderRadius: 12, overflow: "hidden" }}>
          {err && <div className="alert" style={{ margin: "1rem" }}>{err}</div>}
          {src && <iframe ref={frame} title={item.title} sandbox="allow-scripts allow-pointer-lock" allow="fullscreen" allowFullScreen style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} src={src} />}
        </div>
      </div>
    </div>
  );
}

// The settings of one item in a window, in tabs: Basis (picture, title and explanation in every language, system object),
// Spel (everything that influences the game: its configuration) and Spelers (alone or with more, chat in the game, direct mode)
function ItemSettings({ p, item, onSaved, onClose, onPreview }) {
  const [tab, setTab] = useState("base");
  const [vals, setVals] = useState(item.config);
  const [meta, setMeta] = useState({ titles: item.meta?.titles || {}, descriptions: item.meta?.descriptions || {}, about: { layout: item.meta?.about?.layout || "right", texts: item.meta?.about?.texts || {} } });
  const [pl2, setPl2] = useState(""); // the language of the explanation preview
  const [cover, setCover] = useState(""); // address of the cover for this window
  const [lt, setLt] = useState(""); // the language that is open
  const langs = p.active_languages?.length ? p.active_languages : [{ code: "nl", name: "Nederlands", native_name: "Nederlands", is_default: true }]; // the languages that are on
  const [overwrite, setOverwrite] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [note, setNote] = useState("");
  const { user } = useAuth();
  const [err, setErr] = useState("");
  const save = async (v) => { try { onSaved(await api(`/plugins/${p.name}/items/${item.name}/`, { method: "PATCH", body: { config: v } })); } catch { return false; } };
  const saveMeta = async (m) => { try { onSaved(await api(`/plugins/${p.name}/items/${item.name}/`, { method: "PATCH", body: { meta: m } })); } catch { return false; } };
  const auto = useAutoSave(vals, save, { delay: 700 });
  const autoMeta = useAutoSave(meta, saveMeta, { delay: 800 });
  const patch = async (body) => { try { onSaved(await api(`/plugins/${p.name}/items/${item.name}/`, { method: "PATCH", body })); } catch {} };
  useEffect(() => { api(`/plugins/${p.name}/items/${item.name}/preview/`, { method: "POST" }).then((r) => setCover(`${apiBase()}${r.base}`)).catch(() => {}); }, [p.name, item.name]);
  const picture = item.meta?.image || item.thumb_file || "";
  async function upload(files) {
    setErr("");
    try { const fd = new FormData(); fd.append("file", files[0]); onSaved(await api(`/plugins/${p.name}/items/${item.name}/image/`, { method: "POST", body: fd })); } catch (e) { setErr(e?.message || tx("Uploaden mislukt.")); }
  }
  async function translateAll() {
    setAiBusy(true); setErr(""); setNote("");
    try {
      const r = await api(`/plugins/${p.name}/items/${item.name}/translate/`, { method: "POST", body: { overwrite } });
      const it = (r.content_items || []).find((x) => x.name === item.name);
      if (it) setMeta({ titles: it.meta.titles, descriptions: it.meta.descriptions, about: { layout: it.meta.about.layout, texts: it.meta.about.texts } });
      onSaved(r); setNote(r.translated ? tx("{0} talen zijn ingevuld.", r.translated) : tx("Alle talen waren al ingevuld."));
    } catch (e) { setErr(e?.message || tx("Vertalen mislukt.")); }
    setAiBusy(false);
  }
  async function addAbout(files) {
    setErr("");
    try { let r; for (const f of Array.from(files)) { const fd = new FormData(); fd.append("file", f); r = await api(`/plugins/${p.name}/items/${item.name}/about-image/`, { method: "POST", body: fd }); } if (r) onSaved(r); } catch (e) { setErr(e?.message || tx("Uploaden mislukt.")); }
  }
  async function dropAbout(path) { try { onSaved(await api(`/plugins/${p.name}/items/${item.name}/about-image/${path.split("/").pop()}/`, { method: "DELETE" })); } catch (e) { setErr(e?.message || tx("Verwijderen mislukt.")); } }
  async function removeCover() { try { onSaved(await api(`/plugins/${p.name}/items/${item.name}/image/`, { method: "DELETE" })); } catch (e) { setErr(e?.message || tx("Verwijderen mislukt.")); } }
  const cap = item.players_cap || { min: 1, max: 1 }, pl = item.players || { mode: "single", max: 1, chat: false, direct: false };
  const canMulti = cap.max > 1, canDirect = cap.max >= 2 && cap.min <= 2;
  const setText = (key, code, v) => setMeta((m) => ({ ...m, [key]: { ...m[key], [code]: v } }));
  return (
    <div className="overlay" onClick={onClose}>
      <div className="card modal form" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>{item.title} · {tx("Instellingen")}</h2>
          <button type="button" className="btn sm" title={tx("Voorbeeld")} onClick={() => onPreview(item, vals)}><IconEye /> {tx("Voorbeeld")}</button>
        </div>
        <Tabs value={tab} onChange={setTab} tabs={[["base", "Basis", <IconSettings key="b" />], ["about", "Uitleg", <IconGrid key="a" />], ["game", "Spel", <IconGrid key="g" />], ["players", "Spelers", <IconGrid key="p" />]]} />
        {err && <div className="alert">{err}</div>}

        {tab === "base" && (
          <>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "nowrap", gap: "1rem" }}>
              <span style={{ width: 160, height: 100, background: "var(--bg)", borderRadius: 10, display: "grid", placeItems: "center", overflow: "hidden", flex: "none" }}>
                {picture && cover ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={`${cover}${picture}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <small className="muted">{tx("Geen afbeelding")}</small>}
              </span>
              <span style={{ flex: 1 }}><strong>{tx("Afbeelding")}</strong><br /><small className="muted">{tx("De afbeelding van het spel in het overzicht van de leden. Zonder eigen afbeelding geldt die van het spel zelf.")}</small></span>
              <span className="col-actions" style={{ display: "grid", gap: ".4rem", width: 110, flex: "none" }}>
                <MediaField onFiles={upload} />
                {item.meta?.image ? <button type="button" className="btn sm danger" onClick={removeCover}>{tx("Verwijder")}</button> : <span />}
              </span>
            </div>
            <div className="row" style={{ justifyContent: "space-between" }}><strong>{tx("Titel en uitleg in alle talen")}</strong><SaveStatus auto={autoMeta} /></div>
            {user?.is_staff && (
              <div className="row" style={{ justifyContent: "flex-start", alignItems: "center" }}>
                <button type="button" className="btn sm primary" disabled={aiBusy} onClick={translateAll}>{aiBusy ? tx("Claude vertaalt…") : tx("Alle talen invullen met AI")}</button>
                <label className="check" style={{ fontWeight: 500 }}><input type="checkbox" checked={overwrite} disabled={aiBusy} onChange={(e) => setOverwrite(e.target.checked)} /> {tx("Ook ingevulde talen overschrijven")}</label>
              </div>
            )}
            {aiBusy && <div className="imp-bar imp-wait" role="progressbar"><span /></div>}
            {note && <div className="alert ok">{note}</div>}
            <small className="muted" style={{ marginTop: "-.4rem" }}>{tx("Alleen de talen die aan staan. Een taal die je leeg laat, valt terug op het Nederlands en daarna op de tekst van het spel zelf.")}</small>
            {(() => {
              const cur = langs.find((l) => l.code === lt) || langs[0];
              if (!cur) return null;
              return (
                <>
                  <Tabs value={cur.code} onChange={setLt} tabs={langs.map((l) => [l.code, l.native_name || l.name || l.code, null, meta.titles[l.code] || meta.descriptions[l.code] ? "✓" : undefined])} />
                  <div className="form">
                    <label>{tx("Titel")}<input value={meta.titles[cur.code] || ""} maxLength={80} placeholder={cur.code === "nl" ? item.title : ""} onChange={(e) => setText("titles", cur.code, e.target.value)} dir={cur.rtl ? "rtl" : undefined} /></label>
                    <label>{tx("Uitleg")}<textarea rows={4} value={meta.descriptions[cur.code] || ""} maxLength={600} placeholder={cur.code === "nl" ? item.description : ""} onChange={(e) => setText("descriptions", cur.code, e.target.value)} dir={cur.rtl ? "rtl" : undefined} /></label>
                  </div>
                </>
              );
            })()}
            <label>{tx("Leeftijdsgrens")}
              <select value={item.min_age || 0} onChange={(e) => patch({ min_age: Number(e.target.value) })}>{[0, 6, 8, 10, 12, 14, 16, 18, 21].map((a) => <option key={a} value={a}>{a ? `${a}+` : tx("Geen")}</option>)}</select>
            </label>
            <small className="muted" style={{ marginTop: "-.4rem" }}>{tx("Leden die volgens hun profiel te jong zijn, kunnen het spel niet spelen en krijgen een waarschuwing. Is de geboortedatum onbekend, dan bevestigt het lid eerst zijn leeftijd.")}</small>
            <label className="check sec-toggle" style={{ marginTop: ".2rem" }}>
              <span className="switch"><input type="checkbox" checked={!!item.public} onChange={(e) => patch({ public: e.target.checked })} /><span /></span>
              <span>{tx("Publiek zichtbaar")} <small className="muted">{item.public ? tx("Iedereen ziet dit spel, ook bezoekers zonder account.") : tx("Alleen zichtbaar achter de login van een account.")}</small></span>
            </label>
            <label className="check sec-toggle" style={{ marginTop: ".2rem" }}>
              <span className="switch"><input type="checkbox" checked={item.object} disabled={!item.enabled} onChange={(e) => patch({ object: e.target.checked })} /><span /></span>
              <span>{tx("Systeemobject")} <small className="muted">{item.enabled ? tx("Dit spel kan als systeemobject op een pagina worden gezet (paginabewerker, Admin → Systeemobjecten).") : tx("Zet het spel eerst aan.")}</small></span>
            </label>
          </>
        )}

        {tab === "about" && (() => {
          const all = langs; // only the languages that are on are shown; the button still creates every language
          const imgs = item.meta?.about?.images || [];
          const lay = meta.about.layout;
          const cur = all.find((l) => l.code === pl2) || all[0];
          const missing = all.filter((l) => !meta.about.texts[l.code]).length;
          const block = (l) => {
            const title = meta.titles[l.code] || meta.titles.nl || item.title;
            const text = meta.about.texts[l.code] || meta.about.texts.nl || meta.descriptions[l.code] || meta.descriptions.nl || item.description;
            const pics = imgs.map((f) => <img key={f} src={`${cover}${f}`} alt="" style={{ width: "100%", height: lay === "gallery" || lay === "top" ? 110 : 90, objectFit: "cover", borderRadius: "var(--radius, 10px)" }} />);
            const grid = <div style={{ display: "grid", gridTemplateColumns: lay === "gallery" || lay === "top" ? "repeat(auto-fill,minmax(110px,1fr))" : "1fr", gap: ".4rem", width: lay === "gallery" || lay === "top" ? "100%" : 130, flex: "none" }}>{pics}</div>;
            return (
              <div className="card" dir={l.rtl ? "rtl" : undefined} style={{ display: "flex", flexDirection: lay === "gallery" ? "column" : lay === "top" ? "column-reverse" : lay === "left" ? "row" : "row-reverse", gap: ".8rem", alignItems: "flex-start" }}>
                {lay === "top" && grid}
                {(lay === "left" || lay === "right") && pics.length > 0 && grid}
                <div style={{ flex: 1, minWidth: 0 }}><strong>{title}</strong><p style={{ margin: ".3rem 0 0", whiteSpace: "pre-wrap" }}>{text}</p></div>
                {lay === "gallery" && pics.length > 0 && grid}
              </div>
            );
          };
          return (
            <>
              <div className="row" style={{ justifyContent: "space-between" }}><strong>{tx("Uitlegblok met afbeeldingen")}</strong><SaveStatus auto={autoMeta} /></div>
              <small className="muted" style={{ marginTop: "-.4rem" }}>{tx("Het blok krijgt de blokstijl van de gekozen website. Je kunt meerdere afbeeldingen plaatsen (maximaal 8).")}</small>
              <Tabs value={lay} onChange={(v) => setMeta((m) => ({ ...m, about: { ...m.about, layout: v } }))} tabs={[["right", tx("Afbeeldingen rechts")], ["left", tx("Afbeeldingen links")], ["top", tx("Afbeeldingen boven")], ["gallery", tx("Galerij onder")]]} />
              <div className="row" style={{ justifyContent: "flex-start", alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ width: 110 }}><MediaField onFiles={addAbout} /></div>
                {imgs.map((f) => (
                  <span key={f} style={{ position: "relative", width: 64, height: 64, flex: "none" }}>
                    {cover && /* eslint-disable-next-line @next/next/no-img-element */ <img src={`${cover}${f}`} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8 }} />}
                    <button type="button" className="btn sm danger" aria-label={tx("Verwijder")} title={tx("Verwijder")} style={{ position: "absolute", top: -6, right: -6, padding: "0 .4rem", minWidth: 0 }} onClick={() => dropAbout(f)}>×</button>
                  </span>
                ))}
              </div>
              {user?.is_staff && (
                <div className="row" style={{ justifyContent: "flex-start", alignItems: "center" }}>
                  <button type="button" className="btn sm primary" disabled={aiBusy} onClick={translateAll}>{aiBusy ? tx("Claude vertaalt…") : tx("Alle talen aanmaken (ook niet zichtbare)")}</button>
                  <label className="check" style={{ fontWeight: 500 }}><input type="checkbox" checked={overwrite} disabled={aiBusy} onChange={(e) => setOverwrite(e.target.checked)} /> {tx("Ook ingevulde talen overschrijven")}</label>
                </div>
              )}
              {aiBusy && <div className="imp-bar imp-wait" role="progressbar"><span /></div>}
              {note && <div className="alert ok">{note}</div>}
              <small className="muted">{missing ? tx("{0} talen hebben nog geen uitleg.", missing) : tx("Alle talen hebben een uitleg.")} {tx("Je ziet alleen de talen die aan staan. De knop maakt de uitleg voor alle talen van het systeem, ook de talen die uit staan.")}</small>
              {cur && (
                <>
                  <Tabs value={cur.code} onChange={setPl2} tabs={all.map((l) => [l.code, `${l.native_name || l.name || l.code}`, null, meta.about.texts[l.code] ? "✓" : undefined])} />
                  <label>{tx("Uitleg")}<textarea rows={5} value={meta.about.texts[cur.code] || ""} maxLength={4000} dir={cur.rtl ? "rtl" : undefined} onChange={(e) => setMeta((m) => ({ ...m, about: { ...m.about, texts: { ...m.about.texts, [cur.code]: e.target.value } } }))} /></label>
                  <strong>{tx("Voorbeeld")}</strong>
                  {block(cur)}
                </>
              )}
              <details><summary>{tx("Voorbeeld in alle talen")}</summary><div style={{ display: "grid", gap: ".6rem", marginTop: ".6rem" }}>{all.map((l) => <div key={l.code}><small className="muted">{l.native_name || l.name || l.code}</small>{block(l)}</div>)}</div></details>
            </>
          );
        })()}

        {tab === "game" && (
          <>
            <small className="muted">{tx("Alles wat het spel beïnvloedt. Deze waarden gelden voor alle leden.")}</small>
            {item.config_schema.length ? <div className="form">{item.config_schema.map((c) => <OptionField key={c.key} c={c} value={vals[c.key]} onChange={(v) => setVals((x) => ({ ...x, [c.key]: v }))} />)}</div> : <p className="muted" style={{ margin: 0 }}>{tx("Dit spel heeft geen eigen configuratie.")}</p>}
            {item.settings_schema?.length > 0 && <small className="muted">{tx("Leden stellen zelf in")}: {item.settings_schema.map((c) => tx(c.label)).join(", ")}.</small>}
          </>
        )}

        {tab === "players" && (
          <div className="form">
            <small className="muted">{cap.max > 1 ? tx("Dit spel kan met {0} tot {1} spelers worden gespeeld.", cap.min, cap.max) : tx("Dit spel is gemaakt voor één speler (game.json: players). Voor meerdere spelers moet het spel dat ondersteunen.")}</small>
            <label>{tx("Spelers")}
              <select value={pl.mode} disabled={!canMulti} onChange={(e) => patch({ players: { mode: e.target.value } })}>
                <option value="single">{tx("Alleen: één speler tegelijk")}</option>
                <option value="multi">{tx("Met meerdere spelers (kamers met een code)")}</option>
              </select>
            </label>
            {pl.mode === "multi" && cap.max > 2 && (
              <label>{tx("Maximaal aantal spelers")}
                <input type="number" min={Math.max(2, cap.min)} max={cap.max} value={pl.max} onChange={(e) => e.target.value !== "" && patch({ players: { max: Number(e.target.value) } })} />
              </label>
            )}
            <label className="check sec-toggle">
              <span className="switch"><input type="checkbox" checked={pl.chat} disabled={pl.mode !== "multi"} onChange={(e) => patch({ players: { chat: e.target.checked } })} /><span /></span>
              <span>{tx("Chat in het spel")} <small className="muted">{pl.mode === "multi" ? tx("Spelers in dezelfde kamer kunnen naast het spel met elkaar chatten.") : tx("Alleen beschikbaar bij meerdere spelers.")}</small></span>
            </label>
            <label className="check sec-toggle">
              <span className="switch"><input type="checkbox" checked={pl.direct} disabled={!canDirect} onChange={(e) => patch({ players: { direct: e.target.checked } })} /><span /></span>
              <span>{tx("Direct mode")} <small className="muted">{canDirect ? tx("Twee personen die via een link of code direct verbonden zijn (Directe verbinding) kunnen dit spel samen spelen.") : tx("Dit spel ondersteunt geen spel met twee personen.")}</small></span>
            </label>
          </div>
        )}

        <div className="row" style={{ justifyContent: "space-between" }}>{tab === "game" ? <SaveStatus auto={auto} /> : <span />}<button type="button" className="btn" onClick={onClose}>{tx("Sluiten")}</button></div>
      </div>
    </div>
  );
}

// The things a plugin holds in its content folder (for the games plugin: the games in its games folder), also while the plugin is switched off.
// Every item can be switched on or off, can become a system object, has its own settings window (gear) and a preview (eye).
export function PluginContent({ p, onSaved }) {
  const items = p.content_items || [];
  const [edit, setEdit] = useState(null);   // item name
  const [view, setView] = useState(null);   // {item, config}
  const [err, setErr] = useState("");
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const file = useRef(null);
  const patch = async (item, body) => { setErr(""); try { onSaved(await api(`/plugins/${p.name}/items/${item.name}/`, { method: "PATCH", body })); } catch (e) { setErr(e?.message || tx("Opslaan mislukt.")); } };
  // add a game from a zip (a folder with game.json), like uploading a plugin
  const upload = async (files) => {
    const f = [...(files || [])].find((x) => /\.zip$/i.test(x.name));
    if (!f) { setErr(tx("Kies een zipbestand met een spel.")); return; }
    setBusy(true); setErr("");
    try { const fd = new FormData(); fd.append("file", f); const r = await api(`/plugins/${p.name}/items/upload/`, { method: "POST", body: fd }); onSaved(r); } catch (e) { setErr(errorText(e)); }
    setBusy(false);
  };
  const remove = async (i) => {
    if (!(await confirmDialog(tx("Spel \"{0}\" verwijderen? De bestanden gaan weg; scores en voortgang van leden worden daarna opgeruimd.", i.title), { danger: true }))) return;
    setErr("");
    try { onSaved(await api(`/plugins/${p.name}/items/${i.name}/`, { method: "DELETE" })); } catch (e) { setErr(errorText(e)); }
  };
  const cur = items.find((i) => i.name === edit);
  return (
    <div className="stack-sm">
      <p className="muted" style={{ margin: 0 }}>{tx("Gevonden in de map van deze plugin: {0}. Upload een zip met een map met een game.json erbij, of zet de map er zelf in; ze worden vanzelf herkend.", items.length)}</p>
      <div className={`drop${over ? " over" : ""}`} style={{ padding: "1rem" }} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files); }}>
        <input ref={file} type="file" accept=".zip,application/zip" hidden onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
        <button type="button" className="btn primary" disabled={busy} onClick={() => file.current?.click()}>{busy ? tx("Bezig…") : tx("Spel uploaden (zip)")}</button>
        <small className="muted" style={{ display: "block", marginTop: ".4rem" }}>{tx("Of sleep het zipbestand hierheen. Een spel met dezelfde naam wordt bijgewerkt; je instellingen en afbeelding blijven.")}</small>
      </div>
      {err && <div className="alert">{err}</div>}
      {items.length ? (
        <div className="plugin-items">
          {items.map((i) => (
            <div key={i.name} className="plugin-item">
              <span className="pi-main">
                <strong>{i.title}</strong>{i.version && <small className="muted"> v{i.version}</small>}
                <small className="muted">{i.name}{i.author ? ` · ${i.author}` : ""}</small>
                <span className="pi-desc">{i.problem ? <span className="badge off">{tx("game.json is niet te lezen")}</span> : i.description}{(i.categories || []).map((c) => <span key={c} className="chip" style={{ cursor: "default", marginLeft: ".4rem" }}>{c}</span>)}</span>
              </span>
              <span className="pi-actions">
                <label className="pack-switch" title={tx("Het spel voor leden aan of uit zetten")}>
                  <span className="switch"><input type="checkbox" checked={i.enabled} disabled={i.problem} onChange={(e) => patch(i, { enabled: e.target.checked })} /><span /></span><small>{i.enabled ? tx("Aan") : tx("Uit")}</small>
                </label>
                <button type="button" className="btn sm icon" title={tx("Instellingen")} aria-label={tx("Instellingen")} disabled={i.problem} onClick={() => setEdit(i.name)}><IconSettings /></button>
                <button type="button" className="btn sm icon" title={tx("Voorbeeld")} aria-label={tx("Voorbeeld")} disabled={i.problem} onClick={() => setView({ item: i, config: i.config })}><IconEye /></button>
                {user?.is_staff && <button type="button" className="btn sm" title={tx("Download als zip")} onClick={() => downloadFile(`/plugins/${p.name}/items/${i.name}/download/`, `${i.name}.zip`).catch((e) => setErr(errorText(e)))}>{tx("Download")}</button>}
                <button type="button" className="btn sm danger" onClick={() => remove(i)}>{tx("Verwijder")}</button>
              </span>
            </div>
          ))}
        </div>
      ) : <p className="muted">{tx("Er zijn nog geen items in de map van deze plugin.")}</p>}
      {cur && <ItemSettings key={cur.name} p={p} item={cur} onSaved={onSaved} onClose={() => setEdit(null)} onPreview={(item, config) => setView({ item, config })} />}
      {view && <GamePreview p={p} item={view.item} config={view.config} onClose={() => setView(null)} />}
    </div>
  );
}

export function PluginTabs({ p, onSaved, extra = [], first = "overview", children }) {
  const [tab, setTab] = useState(first);
  return (
    <>
      <Tabs value={tab} onChange={setTab} tabs={[...extra.map(([k, l, i]) => [k, l, i]), ...(p.content_items ? [["content", p.content_label || "Inhoud", <IconGrid key="c" />, p.content_items.length]] : []), ["overview", "Overzicht", <IconEye key="o" />], ["placement", "Plaatsing", <IconGrid key="p" />], ...(p.settings_web && !p.config_schema?.length ? [] : [["settings", "Instellingen", <IconSettings key="s" />]]), ["details", "Details", <IconGrid key="d" />]]} />
      <div style={{ marginTop: "1rem" }}>
        {tab === "overview" && <PluginOverview p={p} />}
        {tab === "content" && <PluginContent p={p} onSaved={onSaved} />}
        {tab === "placement" && <PluginPlacement p={p} onSaved={onSaved} />}
        {tab === "settings" && <PluginConfig p={p} onSaved={onSaved} />}
        {tab === "details" && <PluginDetails p={p} />}
        {children && children(tab)}
      </div>
    </>
  );
}
