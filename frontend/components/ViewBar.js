"use client";

import { tx } from "../lib/t";
import { IconGrid, IconMenu, IconSearch } from "./Icons";

// Filter box + tiles/list switch for every overview screen. `extra`: more filters (selects), `count`: how many items are shown.
export default function ViewBar({ view, placeholder, count, extra, className = "" }) {
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
    </div>
  );
}
