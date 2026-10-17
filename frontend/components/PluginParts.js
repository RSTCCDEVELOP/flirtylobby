"use client";

import { useState } from "react";
import { api } from "../lib/api";
import { useAutoSave } from "../lib/autosave";
import { tx } from "../lib/t";
import { IconEye, IconGrid, IconSettings } from "./Icons";
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
  const patch = async (body) => { setErr(""); try { onSaved(await api(`/plugins/${p.name}/`, { method: "PATCH", body })); } catch (e) { setErr(e?.message || tx("Opslaan mislukt.")); } };
  return (
    <div className="form">
      {err && <div className="alert">{err}</div>}
      <h3 style={{ margin: 0 }}>{tx("Menu van het gebruikersdashboard")}</h3>
      {p.menu ? (
        <>
          <label>{tx("Plaats de pagina van deze plugin in")}
            <select value={p.menu_group} onChange={(e) => patch({ menu_group: e.target.value })}>{GROUPS.map(([k, l]) => <option key={k} value={k}>{tx(l)}</option>)}</select>
          </label>
          <small className="muted">{tx("Zichtbaar voor")} {p.menu.access === "members" ? tx("alle leden") : tx("alleen beheer")} · {tx("naam in het menu")}: {p.menu.label}</small>
        </>
      ) : <p className="muted" style={{ margin: 0 }}>{tx("Deze plugin heeft geen pagina in het menu van het gebruikersdashboard.")}</p>}
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
export function PluginTabs({ p, onSaved, extra = [], first = "overview", children }) {
  const [tab, setTab] = useState(first);
  return (
    <>
      <Tabs value={tab} onChange={setTab} tabs={[...extra.map(([k, l, i]) => [k, l, i]), ["overview", "Overzicht", <IconEye key="o" />], ["placement", "Plaatsing", <IconGrid key="p" />], ["settings", "Instellingen", <IconSettings key="s" />], ["details", "Details", <IconGrid key="d" />]]} />
      <div style={{ marginTop: "1rem" }}>
        {tab === "overview" && <PluginOverview p={p} />}
        {tab === "placement" && <PluginPlacement p={p} onSaved={onSaved} />}
        {tab === "settings" && <PluginConfig p={p} onSaved={onSaved} />}
        {tab === "details" && <PluginDetails p={p} />}
        {children && children(tab)}
      </div>
    </>
  );
}
