// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../lib/t";
import { IconGrid, IconMenu, IconSearch } from "./Icons";

// Filter box + tiles/list switch for every overview screen. `extra`: more filters (selects), `count`: how many items are shown, `after`: something (e.g. a "new" button) behind the switch.
export default function ViewBar({ view, placeholder, count, extra, after, className = "" }) {
  return (
    <div className={`view-bar ${className}`}>
      <div className="view-search">
        <IconSearch />
        <input type="search" value={view.q} onChange={(e) => view.setQ(e.target.value)} placeholder={placeholder || tx("Zoeken…")} aria-label={tx("Zoeken")} />
      </div>
      {extra}
      {count !== undefined && <span className="muted view-count">{count}</span>}
      <div className="view-switch" role="group" aria-label={tx("Weergave")}>
        <button type="button" className={view.mode === "tiles" ? "active" : ""} onClick={() => view.setMode("tiles")} title={tx("Tegels")} aria-pressed={view.mode === "tiles"}><IconGrid /></button>
        <button type="button" className={view.mode === "list" ? "active" : ""} onClick={() => view.setMode("list")} title={tx("Lijst")} aria-pressed={view.mode === "list"}><IconMenu /></button>
      </div>
      {after}
    </div>
  );
}
