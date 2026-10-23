// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../lib/t";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

let cache = null; // the list of objects is the same for every widget on the page
const load = () => (cache ||= api("/sysobjects/").catch(() => { cache = null; return []; }));
export const resetSysObjects = () => { cache = null; };

const langNow = () => { try { return localStorage.getItem("lang") || "nl"; } catch { return "nl"; } };
const PER = { week: "per week", month: "per maand", quarter: "per kwartaal", year: "per jaar", once: "eenmalig" };

function Widget({ obj, layout = "1" }) {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const lang = langNow();
  const d = obj.data;
  const route = usePageRoute();
  if (obj.kind === "calculator") return <PriceCalculator layout={layout} />;
  if (obj.kind === "pricelist") return <PriceList />;
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

// One system object by its slug (used by the page blocks)
// layout "1" to "4": four looks to choose from per system object on a page. The marketing tile and the calculation form draw them themselves; the other objects get the look from the wrapper (card, banner, compact).
export function SysObjectBySlug({ slug, layout = "1" }) {
  const on = useModule("sysobjects");
  const [objs, setObjs] = useState([]);
  useEffect(() => { if (on) load().then(setObjs); }, [on]);
  const o = objs.find((x) => x.slug === slug);
  const own = o && (o.kind === "marketing" || o.kind === "calculator" || o.kind === "pricelist" || o.kind === "installation");
  const n = ["1", "2", "3", "4"].includes(String(layout)) ? String(layout) : "1";
  return on && o ? <div className={`so so-${own ? "own" : n}`} data-layout={n}><Widget obj={o} layout={n} /></div> : null;
}

// Rich text from a page, with the system objects placed in it (<div data-sysobject="slug">) shown as real widgets.
export default function RichHtml({ html, className }) {
  const ref = useRef(null);
  const on = useModule("sysobjects");
  const [slots, setSlots] = useState([]);
  const [objs, setObjs] = useState([]);
  useEffect(() => { if (on && html.includes("data-sysobject")) load().then(setObjs); }, [on, html]);
  useLayoutEffect(() => {
    if (!ref.current) return;
    setSlots([...ref.current.querySelectorAll("[data-sysobject]")].map((el) => ({ el, slug: el.getAttribute("data-sysobject") })));
  }, [html, objs]);
  return (
    <>
      <div ref={ref} className={className} dangerouslySetInnerHTML={{ __html: html }} />
      {on && slots.map(({ el, slug }) => { const o = objs.find((x) => x.slug === slug); return o ? createPortal(<Widget obj={o} />, el, slug) : null; })}
    </>
  );
}
