// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useCallback, useEffect, useState } from "react";
import { IconCart, IconCheck, IconGlobe, IconGrid, IconHeart, IconRefresh, IconSettings, IconStar, IconUsers } from "./Icons";
import Loading from "./Loading";
import { SECTION_LABEL } from "./PluginParts";
import { api, errorText } from "../lib/api";
import { sourceError } from "../lib/sourceNotice";
import { getLanguage, tx } from "../lib/t";

// One picture (single colour, like every icon) per kind of plugin
const SECTION_ICON = { users: IconUsers, website: IconGlobe, community: IconHeart, shop: IconCart, subscription: IconStar, system: IconSettings };
const NAME_SECTION = { webshop: "shop", orders: "shop", finance: "shop", marketplace: "shop", subscriptions: "subscription", community: "community", "profile-themes": "community", games: "community", agenda: "community", "age-gates": "users", documents: "website", faq: "website", seo: "website", showcase: "website", siteimport: "website", mailform: "website", statistics: "system" };  // the library does not tell the kind of a plugin: by its name
const PlugIcon = ({ section, name }) => { const I = SECTION_ICON[section || NAME_SECTION[name]] || IconGrid; return <I />; };
const STATE_LABEL = { new: ["Nieuw", ""], update: ["Update beschikbaar", "warn"], current: ["Geïnstalleerd", "ok"], bundle: ["Beschikbaar", ""] };
const OLD = ["outdated", "incompatible", "newer"];

const describe = (p) => (p.descriptions && (p.descriptions[getLanguage()] || p.descriptions.en)) || p.description || "";

// The plugins that are installed on this site: one tile each, with the switch on the tile. "Beheren" opens the settings of the plugin.
export function InstalledTiles({ plugins, onToggle, onManage }) {
  const [q, setQ] = useState("");
  const list = plugins.filter((p) => !q.trim() || `${p.title} ${p.name} ${describe(p)}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="pl-wrap">
      {plugins.length > 6 && <input type="search" className="pl-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Zoeken…")} />}
      <div className="pl-grid">
        {list.map((p) => {
          const old = OLD.includes(p.compat);
          const blocked = !p.enabled && (!!p.blocked || (p.requires_missing || []).length > 0);
          return (
            <div key={p.name} className={`pl-tile ${p.enabled ? "on" : "off"}`}>
              <div className="pl-top">
                <span className="pl-ico"><PlugIcon section={p.section} name={p.name} /></span>
                <label className="switch" title={p.enabled ? tx("Actief") : tx("Uit")}>
                  <input type="checkbox" checked={!!p.enabled} disabled={blocked} onChange={(e) => onToggle(p, e.target.checked)} aria-label={p.title} />
                  <span />
                </label>
              </div>
              <strong className="pl-title">{p.title}</strong>
              <p className="pl-desc">{describe(p)}</p>
              <div className="pl-meta">
                <span className="badge">{tx("versie")} {p.version}</span>
                <span className="badge">{tx(SECTION_LABEL[p.section] || p.section)}</span>
                {old && <span className="badge warn">{tx("Update beschikbaar")}</span>}
                <span className={`badge ${p.enabled ? "ok" : ""}`}>{p.enabled ? tx("Aan") : tx("Uit")}</span>
              </div>
              <div className="pl-actions">
                <button type="button" className="btn sm primary" onClick={() => onManage(p)}>{tx("Beheren")}</button>
                {p.enabled && p.has_web && p.menu && <a className="btn sm" href={`/dashboard/plugins/${p.name}`}>{tx("Open")}</a>}
              </div>
            </div>
          );
        })}
      </div>
      {!list.length && <p className="muted">{tx("Niets gevonden in de bibliotheek.")}</p>}
    </div>
  );
}

// The settings of one installed plugin in a pop-up (tabs): the same settings as before, now away from the tiles.
export function ManageModal({ p, onClose, onSaved, children }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="card modal wide pl-modal" onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ alignItems: "center" }}>
          <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: ".6rem" }}><span className="pl-ico sm"><PlugIcon section={p.section} name={p.name} /></span>{p.title}</h2>
          <button type="button" className="btn sm" onClick={onClose}>{tx("Sluiten")}</button>
        </div>
        <span className="muted" style={{ fontSize: ".85rem" }}>{tx("Plugin")} {p.version} · {tx("voor systeem")} {p.built_for} · {tx(SECTION_LABEL[p.section] || p.section)}</span>
        {children}
      </div>
    </div>
  );
}

// The library (what can be installed from the folder resource/plugins): its own tiles, clearly apart from what is installed.
export function PluginLibrary({ onChanged }) {
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  const [srcErr, setSrcErr] = useState("");  // the easy2edit server does not give the library now (a quiet note: only installing gives a pop-up)
  const load = useCallback(() => api("/resource/").then((d) => { setRows(d?.kinds?.plugins || []); setSrcErr(d?.source?.error || ""); }).catch(() => setRows([])), []);
  useEffect(() => { load(); }, [load]);
  if (!rows) return <Loading fill />;
  const updates = rows.filter((r) => r.state === "update").length;
  const count = (s) => rows.filter((r) => r.state === s).length;
  const list = rows.filter((r) => (filter === "all" || r.state === filter) && (!q.trim() || `${r.title} ${r.name} ${r.description}`.toLowerCase().includes(q.trim().toLowerCase())));
  const install = async (r) => {
    setBusy(r.name); setMsg(null);
    try { const d = await api("/resource/install/", { method: "POST", body: { kind: "plugins", name: r.name } }); setMsg({ ok: true, text: tx("{0} is geïnstalleerd.", d.installed.join(", ")) }); await load(); onChanged?.(); }
    catch (e) { if (!sourceError(e)) setMsg({ ok: false, text: errorText(e) }); }
    setBusy("");
  };
  const updateAll = async () => {
    setBusy("*"); setMsg(null);
    try { const d = await api("/resource/update/", { method: "POST", body: { kind: "plugins" } }); setMsg({ ok: true, text: d.updated.length ? tx("Bijgewerkt: {0}.", d.updated.join(", ")) : tx("Alles is al actueel.") }); await load(); onChanged?.(); }
    catch (e) { if (!sourceError(e)) setMsg({ ok: false, text: errorText(e) }); }
    setBusy("");
  };
  const chips = [["all", "Alles", rows.length], ["new", "Nieuw", count("new")], ["update", "Update beschikbaar", count("update")], ["current", "Geïnstalleerd", count("current")]];
  return (
    <div className="pl-wrap">
      <div className="pl-bar">
        <div className="pl-chips" role="tablist">
          {chips.map(([k, l, n]) => <button key={k} type="button" role="tab" aria-selected={filter === k} className={`pl-chip ${filter === k ? "active" : ""}`} onClick={() => setFilter(k)}>{tx(l)} <span className="pl-n">{n}</span></button>)}
        </div>
        <input type="search" className="pl-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Zoeken…")} />
        <button type="button" className="btn" disabled={!!busy || !updates} onClick={updateAll}><IconRefresh /> {tx("Updaten")}{updates ? ` (${updates})` : ""}</button>
      </div>
      {srcErr && <small className="muted">{tx("De easy2edit-server geeft de bibliotheek nu niet: je ziet alleen wat op deze site is gemaakt. Bij installeren krijg je uitleg.")}</small>}
      {msg && <div className={`alert ${msg.ok ? "ok" : ""}`}>{msg.text}</div>}
      <div className="pl-grid">
        {list.map((r) => {
          const [label, cls] = STATE_LABEL[r.state] || STATE_LABEL.new;
          return (
            <div key={r.file} className={`pl-tile lib ${r.state}`}>
              <div className="pl-top">
                <span className="pl-ico"><PlugIcon section={r.section} name={r.name} /></span>
                <span className={`badge ${cls}`}>{r.state === "current" && <IconCheck />} {tx(label)}</span>
              </div>
              <strong className="pl-title">{r.title}</strong>
              <p className="pl-desc">{r.description}</p>
              <div className="pl-meta">
                <span className="badge">{tx("versie")} {r.version}{r.installed_version && r.installed_version !== r.version ? ` (${r.installed_version})` : ""}</span>
              </div>
              <div className="pl-actions">
                {r.state === "current"
                  ? <span className="muted pl-done"><IconCheck /> {tx("Geïnstalleerd")}</span>
                  : <button type="button" className="btn sm primary" disabled={!!busy} onClick={() => install(r)}>{busy === r.name ? tx("Bezig…") : r.state === "update" ? tx("Updaten") : tx("Installeren")}</button>}
              </div>
            </div>
          );
        })}
      </div>
      {!list.length && <p className="muted">{tx("Niets gevonden in de bibliotheek.")}</p>}
    </div>
  );
}
