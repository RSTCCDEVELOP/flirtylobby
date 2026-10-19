"use client";

import { tx } from "../lib/t";
import { useState } from "react";
import { DASH_LAYOUTS, DASH_THEMES, suggestedFor, WIDGETS } from "./Widgets";
import { IconBag, IconBolt, IconChat, IconFlask, IconGrid, IconHeart, IconImage, IconLink, IconMail, IconReceipt, IconSearch, IconSend, IconSmile, IconTruck, IconUser, IconUsers } from "./Icons";
import Tabs from "./Tabs";

const ICON = {
  welcome: <IconSmile />, notice: <IconSend />, shortcuts: <IconGrid />, profile: <IconUser />, messages: <IconMail />, chat: <IconChat />, direct: <IconLink />,
  matches: <IconHeart />, swipe: <IconHeart />, find: <IconSearch />, visits_chart: <IconBolt />, users_stats: <IconUsers />, users_chart: <IconUsers />, orders_chart: <IconReceipt />, orders_recent: <IconBag />,
  low_stock: <IconTruck />, media_usage: <IconImage />, sandbox: <IconFlask />, modules: <IconGrid />,
};

// Library of dashboard elements: drag a card onto a column of the dashboard (or click +). What shows depends on the profile type
// (community theme) and on the modules / rights of the user. Elements that are already on the dashboard are marked.
export default function DashboardLibrary({ theme, ctx, onDashIds, onAdd, onLayout }) {
  const [tab, setTab] = useState("suggested");
  const [q, setQ] = useState("");
  const usable = WIDGETS.filter((w) => w.ok(ctx));
  const suggestedIds = suggestedFor(theme);
  const groups = [...new Set(usable.map((w) => w.group))];
  const list = usable.filter((w) => (tab === "suggested" ? suggestedIds.includes(w.id) : tab === "all" || w.group === tab))
    .filter((w) => !q || `${tx(w.title)} ${tx(w.desc)}`.toLowerCase().includes(q.toLowerCase()));
  const tabs = [["suggested", "Aanbevolen"], ["all", "Alle"], ...groups.map((g) => [g, g])];

  return (
    <div className="card dash-panel dash-lib" style={{ marginBottom: "1rem" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>{tx("Bibliotheek met blokken")} <span className="badge">{tx(DASH_THEMES[theme] || DASH_THEMES.normal)}</span></h2>
        <span className="row" style={{ gap: ".4rem" }}>
          <small className="muted">{tx("Indeling")}:</small>
          {DASH_LAYOUTS.map(([k, l]) => <button key={k} className="btn sm" onClick={() => onLayout(k)}>{tx(l)}</button>)}
        </span>
      </div>
      <p className="muted" style={{ margin: 0 }}>{tx("Sleep een blok naar je dashboard of klik op +. Een nieuw dashboard begint simpel; voeg alleen toe wat je nodig hebt.")}</p>
      <Tabs tabs={tabs.map(([k, l]) => [k, l])} value={tab} onChange={setTab} />
      <input type="search" placeholder={tx("Zoek een blok…")} value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 320 }} />
      <div className="lib-grid">
        {list.map((w) => {
          const on = onDashIds.includes(w.id);
          return (
            <div key={w.id} className={`lib-item ${on ? "on" : ""}`} draggable={!on} onDragStart={(e) => { e.dataTransfer.setData("text/plain", w.id); e.dataTransfer.effectAllowed = "copy"; }} title={tx(w.desc)}>
              <span className="lib-ico">{ICON[w.id] || <IconGrid />}</span>
              <span className="lib-txt"><strong>{tx(w.title)}</strong><small className="muted">{tx(w.desc)}</small></span>
              {on ? <span className="badge ok">{tx("Op dashboard")}</span> : <button type="button" className="btn sm" onClick={() => onAdd(w)} aria-label={tx("Toevoegen")}>+</button>}
            </div>
          );
        })}
        {!list.length && <p className="muted" style={{ margin: 0 }}>{tx("Geen blokken gevonden.")}</p>}
      </div>
      <small className="muted">{tx("Blokken verschijnen alleen voor modules die aan staan en waar je toegang toe hebt.")}</small>
    </div>
  );
}
