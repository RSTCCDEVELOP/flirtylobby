"use client";

import { tx } from "../../../../lib/t";
import { useEffect, useState } from "react";
import Tabs from "../../../../components/Tabs";
import { Widgets } from "../../../../components/StatWidgets";
import { api, errorText } from "../../../../lib/api";

const PERIODS = [7, 30, 90];

export default function StatistiekenPage() {
  const [tabs, setTabs] = useState(null);
  const [main, setMain] = useState("general"); // general | seo | modules | plugins
  const [mod, setMod] = useState("");
  const [plg, setPlg] = useState("");
  const [open, setOpen] = useState(null); // null: the section of the chosen module
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => { api("/stats/tabs/").then((t) => { setTabs(t); setMod(t.modules.find((m) => m.on)?.key || t.modules[0]?.key || ""); setPlg(t.plugins[0]?.key || ""); }).catch((e) => setErr(errorText(e))); }, []);

  const url = main === "general" ? "general" : main === "seo" ? "module/seo" : main === "modules" ? (mod && `module/${mod}`) : (plg && `plugin/${plg}`);
  useEffect(() => {
    if (!url) { setData({ widgets: [] }); return; }
    let live = true;
    setData(null); setErr("");
    api(`/stats/${url}/?days=${days}`).then((d) => live && setData(d)).catch((e) => live && setErr(errorText(e)));
    return () => { live = false; };
  }, [url, days]);

  const groups = {};
  (tabs?.modules || []).forEach((m) => { (groups[m.group || "Overig"] ||= []).push(m); });

  const item = (k, label, on, cur, set) => <button key={k} type="button" className={`stat-nav-item ${cur === k ? "active" : ""} ${on ? "" : "off"}`} onClick={() => { set(k); setOpen(null); }} title={on ? "" : tx("Staat uit")}><span>{label}</span>{!on && <i aria-hidden="true" />}</button>;
  // sections of the menu: one open at a time (the one with the chosen module opens by itself)
  const ownGroup = (tabs?.modules.find((m) => m.key === mod)?.group) || "Overig";
  const shown = open ?? ownGroup;
  const nav = main === "modules" && tabs
    ? Object.entries(groups).map(([g, list]) => (
        <div key={g} className={`stat-nav-group ${shown === g ? "open" : ""}`}>
          <button type="button" className="stat-nav-head" aria-expanded={shown === g} onClick={() => setOpen(shown === g ? "" : g)}><span>{tx(g)}</span><em>{list.length}</em><b aria-hidden="true">›</b></button>
          {shown === g && <div className="stat-nav-list">{list.map((m) => item(m.key, m.label, m.on, mod, setMod))}</div>}
        </div>))
    : main === "plugins" && tabs && tabs.plugins.length
    ? <div className="stat-nav-group open"><div className="stat-nav-list">{tabs.plugins.map((p) => item(p.key, p.label, p.on, plg, setPlg))}</div></div>
    : null;
  const title = main === "modules" ? tabs?.modules.find((m) => m.key === mod)?.label : main === "plugins" ? tabs?.plugins.find((p) => p.key === plg)?.label : "";

  return (
    <div className="stat-page">
      <div className="stat-head">
        <div><h1>{tx("Statistieken")}</h1><p className="muted">{tx("Bezoekers, zoekmachines, AI-verkeer en gebruik per module en plugin. Zonder cookies en zonder persoonlijke profielen.")}</p></div>
        <div className="stat-period" role="group" aria-label={tx("Periode")}>
          {PERIODS.map((p) => <button key={p} type="button" className={`btn sm ${days === p ? "primary" : ""}`} onClick={() => setDays(p)}>{tx("{0} dagen", p)}</button>)}
        </div>
      </div>
      <Tabs value={main} onChange={setMain} tabs={[["general", "Algemeen"], ["seo", "Bezoekers & SEO"], ["modules", "Modules"], ["plugins", "Plugins"]]} />
      {err && <div className="alert">{err}</div>}
      <div className={nav ? "stat-split" : ""}>
        {nav && <nav className="stat-nav" aria-label={tx("Kies een onderdeel")}>{nav}</nav>}
        <div className="stat-body">
          {main === "plugins" && tabs && !tabs.plugins.length && <p className="muted">{tx("Er zijn geen plugins geïnstalleerd.")}</p>}
          {!data && !err ? <p className="muted">{tx("Laden…")}</p> : data && (
            <>
              {title && <h2 className="stat-title">{title}</h2>}
              <Widgets widgets={data.widgets} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
