// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../lib/t";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { money } from "../lib/format";
import { pick } from "../lib/i18n";
import { Campaign, localised } from "./Donate";
import { useModule } from "./Modules";
import { useSession } from "./Session";
import { usePageRoute } from "./PageRoute";
import PluginFrame from "./PluginFrame";
import SysButton from "./SysButton";
import MediaView from "./MediaViews";
import PriceList from "./PriceList";
import InstallationCard from "./InstallationCard";
import PriceCalculator from "./PriceCalculator";
import MarketingTile from "./MarketingTile";
import AiBlock from "./AiBlock";
import EnergyBlock from "./EnergyBlocks";
import WidgetFrame from "./WidgetFrame";
import { useEntity, variableValue } from "../lib/entity";

let cache = null; // the list of objects is the same for every widget on the page
const load = () => (cache ||= api("/sysobjects/").catch(() => { cache = null; return []; }));
export const resetSysObjects = () => { cache = null; };

const langNow = () => { try { return localStorage.getItem("lang") || "nl"; } catch { return "nl"; } };
const PER = { week: "per week", month: "per maand", quarter: "per kwartaal", year: "per jaar", once: "eenmalig" };

// A variable of the company ({{organisatie.*}}) or of the person who looks ({{user.*}}) as a piece of text in the page.
function VariableValue({ name, user }) {
  const ent = useEntity();
  return <span className="sys-variable" data-variable={name}>{variableValue(name, ent, user)}</span>;
}

function Widget({ obj, layout = "1" }) {
  const { user, editing } = useSession();
  const [open, setOpen] = useState(false);
  const lang = langNow();
  const d = obj.data;
  const route = usePageRoute();
  if (obj.kind === "widget") return d.enabled === false ? null : <WidgetFrame doc={d.doc} height={d.popup && !editing ? 0 : d.height} preview={!!d.popup && !!editing} title={d.title} />;  // a widget of the library (Admin > Thema > Widgets)
  if (obj.kind === "variable") return <VariableValue name={d.variable} user={user} />;
  if (obj.kind === "calculator") return <PriceCalculator layout={layout} />;
  if (obj.kind === "pricelist") return <PriceList />;
  if (obj.kind === "ai") return <AiBlock block={d.block} />;
  if (obj.kind === "energy") return <EnergyBlock layout={d.layout} />;
  if (obj.kind === "installation") return <InstallationCard d={d} />;
  if (obj.kind === "marketing") return <MarketingTile module={d.module} layout={layout} />;
  if (obj.kind === "media") return <MediaView type={d.type} settings={d.settings} items={d.items} />;
  if (obj.kind === "plugin_part") return d.enabled === false ? null : <PluginFrame name={d.name} file={d.file} title={d.title} route={{ path: "/", params: {}, ...(route || {}), query: { ...((route || {}).query || {}), ...(d.query || {}) } }} bare />;  // a block of a plugin page (the product overview, the cart ...), movable on the page
  if (obj.kind === "plugin") return <PluginFrame name={d.name} title={d.title} />;
  if (obj.kind === "plugin_item" && d.public === false && !user) return <div className="card" style={{ display: "grid", gap: ".5rem" }}><strong>{d.title}</strong><small className="muted">{tx("Dit spel is alleen voor leden. Log in met je account om te spelen.")}</small><Link href="/login" className="btn sm primary" style={{ justifySelf: "start" }}>{tx("Inloggen")}</Link></div>;
  if (obj.kind === "plugin_item") return <PluginFrame name={d.name} title={d.title} route={{ path: "/", params: {}, query: { item: d.item } }} />;  // one game of a plugin: the plugin page opens it at once
  if (obj.kind === "donation") {
    const label = obj.button?.labels?.[lang] || obj.button?.labels?.nl || Object.values(obj.button?.labels || {})[0] || tx("Doneer");
    const camp = { ...localised(d), recent: [] };
    if (!obj.button?.as_button) return <Campaign c={camp} currency="EUR" user={user} />;
    return (
      <>
        <SysButton button={obj.button} label={label} onClick={() => setOpen(true)} />
        {open && (
          <div className="overlay" onClick={() => setOpen(false)}>
            <div className="modal" style={{ padding: 0 }} onClick={(e) => e.stopPropagation()}>
              <Campaign c={camp} currency="EUR" user={user} onClose={() => setOpen(false)} />
            </div>
          </div>
        )}
      </>
    );
  }
  return (
    <div className="card plan-card sys-plan">
      <h3 style={{ margin: 0 }}>{d.name}</h3>
      <div className="plan-price">{money(d.price)} <small>{tx(PER[d.interval])}</small></div>
      <ul className="plan-grants">{d.grants.map((g, i) => <li key={i}>{tx(g.label)}</li>)}</ul>
      <SysButton button={{ icon: "star", variant: "primary", ...(obj.button || {}) }} as={Link} href="/abonnementen" label={obj.button?.labels?.[lang] || tx("Bekijk dit abonnement")} />
    </div>
  );
}

// A widget that is not installed or is switched off, in a place on a page: the people who edit the page see a block with its name (the visitors see nothing).
let namesCache = null;
const loadNames = () => (namesCache ||= api("/sysobjects/widget-names/").catch(() => { namesCache = null; return {}; }));
export function InactiveWidget({ slug }) {
  const { canEdit } = useSession();
  const [names, setNames] = useState(null);
  useEffect(() => { if (canEdit && String(slug).startsWith("widget-")) loadNames().then(setNames); }, [canEdit, slug]);
  if (!canEdit || !String(slug).startsWith("widget-") || !names) return null;
  const w = names[slug];
  return (
    <div className="so-inactive" role="note">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 12h8" /></svg>
      <span><strong>{w ? w.name : slug}</strong><small>{tx("Dit widget is niet actief. Installeer het bij Admin → Website → Widgets; bezoekers zien hier nu niets.")}</small></span>
    </div>
  );
}

// One system object by its slug (used by the page blocks)
// layout "1" to "4": four looks to choose from per system object on a page. The marketing tile and the calculation form draw them themselves; the other objects get the look from the wrapper (card, banner, compact).
export function SysObjectBySlug({ slug, layout = "1" }) {
  const on = useModule("sysobjects");
  const [objs, setObjs] = useState([]);
  useEffect(() => { if (on) load().then(setObjs); }, [on]);
  const o = objs.find((x) => x.slug === slug);
  const own = o && (o.kind === "widget" || o.kind === "marketing" || o.kind === "calculator" || o.kind === "pricelist" || o.kind === "installation" || o.kind === "ai" || o.kind === "energy" || o.kind === "variable");
  const n = ["1", "2", "3", "4"].includes(String(layout)) ? String(layout) : "1";
  return on && o ? <div className={`so so-${own ? "own" : n}`} data-layout={n}><Widget obj={o} layout={n} /></div> : (on && !o && objs.length ? <InactiveWidget slug={slug} /> : null);
}

// Rich text from a page, with the system objects placed in it (<div data-sysobject="slug">) shown as real widgets.
// The text is cut at every placeholder and the widgets are drawn in between by React itself (a widget in a portal inside the text got lost when the text was drawn again).
const SLOT = /<div[^>]*data-sysobject="([^"]+)"[^>]*>\s*<\/div>/g;
export default function RichHtml({ html, className }) {
  const on = useModule("sysobjects");
  const [objs, setObjs] = useState([]);
  useEffect(() => { if (on && html.includes("data-sysobject")) load().then(setObjs); }, [on, html]);
  const parts = html.split(SLOT);  // text, slug, text, slug ... (odd places are slugs)
  return (
    <div className={className}>
      {parts.map((p, i) => {
        if (i % 2 === 0) return p ? <div key={i} style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: p }} /> : null;
        const o = on && objs.find((x) => x.slug === p);
        return o ? <Widget key={i} obj={o} /> : (on && objs.length ? <InactiveWidget key={i} slug={p} /> : null);
      })}
    </div>
  );
}
