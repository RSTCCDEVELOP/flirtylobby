// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useState } from "react";
import { tx } from "../lib/t";

// tiles or a list: the choice is remembered
export function useWidgetView() {
  const [view, set] = useState(() => { try { return localStorage.getItem("widgetView") === "list" ? "list" : "tiles"; } catch { return "tiles"; } });
  return [view, (v) => { set(v); try { localStorage.setItem("widgetView", v); } catch { /* ok */ } }];
}

export function ViewToggle({ view, onChange }) {
  const I = (d) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
  return (
    <div className="lg-seg wc-view" role="group" aria-label={tx("Weergave")}>
      <button type="button" className={view === "tiles" ? "on" : ""} aria-pressed={view === "tiles"} onClick={() => onChange("tiles")} title={tx("Tegels")}>{I(<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>)}<span>{tx("Tegels")}</span></button>
      <button type="button" className={view === "list" ? "on" : ""} aria-pressed={view === "list"} onClick={() => onChange("list")} title={tx("Lijst")}>{I(<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />)}<span>{tx("Lijst")}</span></button>
    </div>
  );
}

// The categories and sub categories of the widgets, to find one quickly: the library (Admin > Thema > Widgets, Super admin > Bibliotheek) and the page editor (Toevoegen > Widgets) use this.
// `items` is a list of anything with a category and a sub category (getCat / getSub say where). Returns the chips and the helpers to filter and group.
export function widgetTree(items, getCat, getSub) {
  const tree = [];
  items.forEach((it) => {
    const c = getCat(it) || "Overig", s = sub ? (getSub(it) || "") : "";  // headings per category only, so the tiles fill the rows
    let node = tree.find((x) => x.cat === c);
    if (!node) { node = { cat: c, n: 0, subs: [] }; tree.push(node); }
    node.n += 1;
    if (s) { let sn = node.subs.find((x) => x.sub === s); if (!sn) { sn = { sub: s, n: 0 }; node.subs.push(sn); } sn.n += 1; }
  });
  tree.sort((a, b) => a.cat.localeCompare(b.cat)); tree.forEach((n) => n.subs.sort((a, b) => a.sub.localeCompare(b.sub)));
  return tree;
}

// the groups to show: [{cat, sub, items}], only what matches the chosen category and sub category (and is shown under a heading "Category › Sub")
export function widgetGroups(items, getCat, getSub, cat, sub) {
  const out = [];
  items.filter((it) => (!cat || (getCat(it) || "Overig") === cat) && (!sub || getSub(it) === sub)).forEach((it) => {
    const c = getCat(it) || "Overig", s = getSub(it) || "";
    let g = out.find((x) => x.cat === c && x.sub === s);
    if (!g) { g = { cat: c, sub: s, items: [] }; out.push(g); }
    g.items.push(it);
  });
  out.forEach((g) => g.items.sort((a, b) => ((getSub(a) || "") + (a.title || a.name || "")).localeCompare((getSub(b) || "") + (b.title || b.name || ""))));
  return out.sort((a, b) => (a.cat + a.sub).localeCompare(b.cat + b.sub));
}

export default function WidgetCategories({ tree, total, cat, sub, onCat, onSub }) {
  const node = tree.find((x) => x.cat === cat);
  return (
    <div className="wc">
      <div className="lg-seg wc-row" role="group" aria-label={tx("Categorie")}>
        <button type="button" className={!cat ? "on" : ""} aria-pressed={!cat} onClick={() => { onCat(""); onSub(""); }}>{tx("Alles")} <small>{total}</small></button>
        {tree.map((n) => <button type="button" key={n.cat} className={cat === n.cat ? "on" : ""} aria-pressed={cat === n.cat} onClick={() => { onCat(n.cat); onSub(""); }}>{tx(n.cat)} <small>{n.n}</small></button>)}
      </div>
      {node && node.subs.length > 0 && (
        <div className="lg-seg wc-row wc-sub" role="group" aria-label={tx("Subcategorie")}>
          <button type="button" className={!sub ? "on" : ""} aria-pressed={!sub} onClick={() => onSub("")}>{tx("Alle")} {tx(node.cat).toLowerCase()}</button>
          {node.subs.map((s) => <button type="button" key={s.sub} className={sub === s.sub ? "on" : ""} aria-pressed={sub === s.sub} onClick={() => onSub(s.sub)}>{tx(s.sub)} <small>{s.n}</small></button>)}
        </div>
      )}
    </div>
  );
}
