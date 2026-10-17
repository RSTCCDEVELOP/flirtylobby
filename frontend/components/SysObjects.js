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
import PluginFrame from "./PluginFrame";
import SysButton from "./SysButton";

let cache = null; // the list of objects is the same for every widget on the page
const load = () => (cache ||= api("/sysobjects/").catch(() => { cache = null; return []; }));
export const resetSysObjects = () => { cache = null; };

const langNow = () => { try { return localStorage.getItem("lang") || "nl"; } catch { return "nl"; } };
const PER = { week: "per week", month: "per maand", quarter: "per kwartaal", year: "per jaar", once: "eenmalig" };

function Widget({ obj }) {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const lang = langNow();
  const d = obj.data;
  if (obj.kind === "plugin") return <PluginFrame name={d.name} title={d.title} />;
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
export function SysObjectBySlug({ slug }) {
  const on = useModule("sysobjects");
  const [objs, setObjs] = useState([]);
  useEffect(() => { if (on) load().then(setObjs); }, [on]);
  const o = objs.find((x) => x.slug === slug);
  return on && o ? <Widget obj={o} /> : null;
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
