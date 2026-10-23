// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, errorText } from "../lib/api";
import { confirmDialog } from "../lib/dialog";
import { tx } from "../lib/t";
import PagePreview from "./PagePreview";
import PageSettingsModal from "./PageSettingsModal";

// The website pages of a plugin (public_pages with a `page` key in its plugin.json) and the links to its other admin screens (admin_links):
// look at a page, edit it in this screen (blocks, texts, layout), change its layout or put it back to the theme's default.
// Everything it shows comes from the plugin, so an update of the plugin updates this screen.
export default function PluginPages({ p }) {
  const items = (p.public_pages || []).filter((x) => x.page).map((x) => ({ key: x.page, title: x.title, description: x.description, path: `/${x.path}` }));
  // a plugin with one page of its own (blocks_page): its address is public_path, on the website or behind the login
  if (p.blocks_page && p.public_path) items.push({ key: p.blocks_page, pageKey: `plugin-${p.name}`, title: p.title, description: p.description, path: p.page_public ? `/${p.public_path}` : `/dashboard/${p.public_path}` });
  return <PagesPanel items={items} links={p.admin_links} enabled={p.enabled} />;
}

// The same screen for any part of the system: items = [{key (page key), title, description, path}], links = [{href, title, description}]
export function PagesPanel({ items, links = [], enabled = true }) {
  const [pages, setPages] = useState([]);
  const [langs, setLangs] = useState({ languages: [], default: "nl" });
  const [settings, setSettings] = useState(null);
  const [view, setView] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = useCallback(() => api("/pages/?scope=public").then((d) => setPages(d.pages)).catch((e) => setMsg({ ok: false, text: errorText(e) })), []);
  useEffect(() => { load(); api("/languages/").then(setLangs).catch(() => {}); }, [load]);

  const find = (k, alt) => pages.find((x) => x.key === (alt || k));
  const show = (pg, name, edit, blocks) => { setView({ key: blocks || pg.key, url: pg.path.includes("<") ? `/${pg.path.split("/")[1]}` : pg.path, title: tx(name), edit }); setTimeout(() => document.getElementById("pp-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); };
  const reset = async (k) => {
    if (!(await confirmDialog(tx("De indeling van deze pagina terugzetten naar de standaard van het thema? Je eigen verplaatsingen gaan verloren."), { danger: true }))) return;
    try { await api(`/pages/layout/${encodeURIComponent(k)}/preset/`, { method: "POST", body: { preset: "auto" } }); setMsg({ ok: true, text: tx("De standaardindeling is teruggezet.") }); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  };

  return (
    <>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}
      <div id="pp-anchor" />
      {view && <PagePreview key={`${view.key}-${view.edit}`} pageKey={view.key} path={view.url} title={view.title} startEdit={view.edit} onClose={() => setView(null)} />}
      <h2 className="dash-section">{tx("Voorkant: de website")}</h2>
      <div className="plugin-items">
        {items.map((x) => {
          const pg = find(x.key, x.pageKey);
          const on = enabled && pg?.available !== false;
          return (
            <div key={x.key} className="plugin-item">
              <span className="pi-main">
                <strong>{x.title}</strong>
                <small className="muted">{pg ? pg.path : x.path}</small>
                {x.description && <span className="pi-desc">{x.description}</span>}
              </span>
              <span className="pi-actions">
                <span className={`badge ${on ? "ok" : "off"}`}>{on ? tx("Aan") : tx("Uit")}</span>
                {pg && enabled && <button type="button" className="btn sm" onClick={() => show(pg, x.title, false, x.key)}>{tx("Bekijken")}</button>}
                {pg && enabled && <button type="button" className="btn sm primary" onClick={() => show(pg, x.title, true, x.key)}>{tx("Bewerken")}</button>}
                {pg && <button type="button" className="btn sm" onClick={() => setSettings(pg)}>{tx("Opmaak")}</button>}
                {pg && <button type="button" className="btn sm" onClick={() => reset(x.key)}>{tx("Herstel")}</button>}
              </span>
            </div>
          );
        })}
      </div>
      <small className="muted">{tx("Bekijken en Bewerken openen de pagina hier in dit scherm: sleep blokken en objecten, pas teksten aan en kies bovenaan de opmaak.")}</small>

      {!!links?.length && (
        <>
          <h2 className="dash-section">{tx("Achterkant: het beheer")}</h2>
          <div className="plugin-items">
            {links.map((l) => (
              <div key={l.href} className="plugin-item">
                <span className="pi-main"><strong>{l.title}</strong><small className="muted">{l.href}</small>{l.description && <span className="pi-desc">{l.description}</span>}</span>
                <span className="pi-actions"><Link className="btn sm primary" href={l.href}>{tx("Openen")}</Link></span>
              </div>
            ))}
          </div>
        </>
      )}
      {settings && <PageSettingsModal page={settings} languages={langs.languages} defaultLang={langs.default} canSeo={false} onClose={() => setSettings(null)} onSaved={async () => { setSettings(null); await load(); setMsg({ ok: true, text: tx("Pagina-instellingen opgeslagen.") }); }} />}
    </>
  );
}
