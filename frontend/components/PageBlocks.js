"use client";

import { tx } from "../lib/t";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorText } from "../lib/api";
import { alertDialog } from "../lib/dialog";
import { EditableImage, EditableText } from "./EditMode";
import { useModule } from "./Modules";
import { useSession } from "./Session";
import { SysObjectBySlug } from "./SysObjects";
import LayoutPresets from "./LayoutPresets";
import { BgControls, BgLayer } from "./SectionBg";

const uid = () => Math.random().toString(16).slice(2, 10).padEnd(8, "0");
const newCell = () => ({ id: uid(), width: "auto", halign: "left", valign: "top", items: [] });
const ROW_WIDTHS = ["default", "100", "90", "80", "70", "60", "50"];
const CELL_WIDTHS = ["auto", "20", "25", "30", "33", "40", "50", "60", "66", "70", "75", "80", "100"];

// grid columns from the cell widths: a percentage is that share of the row, "auto" cells share what is left
function columns(r) {
  const fixed = r.cells.reduce((s, c) => s + (c.width && c.width !== "auto" ? Number(c.width) : 0), 0);
  const autos = r.cells.filter((c) => !c.width || c.width === "auto").length;
  const share = autos ? Math.max(100 - fixed, 10 * autos) / autos : 0;
  return r.cells.map((c) => `minmax(0, ${c.width && c.width !== "auto" ? Number(c.width) : share}fr)`).join(" ");
}
const AL_H = { left: "flex-start", center: "center", right: "flex-end" };
const AL_V = { top: "flex-start", center: "center", bottom: "flex-end" };

// Blocks of a page: rows (a grid of 1-4 columns) with text, pictures and system objects in the cells.
// In edit mode: add rows, drag items between cells, set how items sit in a cell (left/centre/right, top/centre/bottom).
export default function PageBlocks({ pageKey, title = "" }) {
  const { editing } = useSession();
  const objOn = useModule("sysobjects");
  const [layout, setLayout] = useState(null);
  const [menu, setMenu] = useState(null); // cell id with the add-menu open
  const [objects, setObjects] = useState([]);
  const [saving, setSaving] = useState("");
  const root = useRef(null);
  const [h1, setH1] = useState("");
  const [dragging, setDragging] = useState(false); // while dragging, pictures and plugin frames must not catch the drop themselves
  const [over, setOver] = useState(null); // where a dragged item would land: {id, pos: before | after}
  const [dragOn, setDragOn] = useState(null); // the item whose handle is held: only then it can be dragged (text stays selectable)
  const drag = useRef(null);
  const timer = useRef(null);

  useEffect(() => { api(`/pages/layout/${encodeURIComponent(pageKey)}/`).then(setLayout).catch(() => setLayout({ rows: [] })); }, [pageKey]);
  const pageWide = layout?.page_width === "full";
  const pageSize = ["5", "10", "25", "100"].includes(String(layout?.page_size)) ? String(layout.page_size) : "all";
  const listView = layout?.list?.view === "rows" ? "rows" : "grid", listCenter = !!layout?.list?.center;
  useEffect(() => { // how the lists of the page (games, products, plans ...) are shown: the page and the plugin frames read it from these attributes
    const par = root.current?.parentElement;
    if (!par) return undefined;
    par.dataset.list = listView; par.dataset.center = listCenter ? "1" : "0"; par.dataset.width = pageWide ? "full" : "column"; par.dataset.pagesize = pageSize; document.documentElement.dataset.pagesize = pageSize;
    document.documentElement.dataset.list = listView; document.documentElement.dataset.center = listCenter ? "1" : "0";
    return () => { delete par.dataset.list; delete par.dataset.center; delete par.dataset.width; delete par.dataset.pagesize; delete document.documentElement.dataset.pagesize; delete document.documentElement.dataset.list; delete document.documentElement.dataset.center; };
  }, [layout, listView, listCenter, pageWide, pageSize]);
  const NO_HERO = ["home", "hero-games"];
  const heroOff = !!layout?.hero_off || NO_HERO.includes(pageKey);
  const heroRow = layout?.rows?.find((r) => r.hero);
  const heroTheme = heroOff ? "" : heroRow?.hero || (layout ? layout.theme || "normal" : ""); // every page has a hero unless it is switched off; a page without a hero row gets the title in a banner
  useEffect(() => { // with a hero the title is in the banner: the title of the page itself above it is hidden and its text is used
    const par = root.current?.parentElement;
    if (!heroTheme || !par) return undefined;
    const h = [...par.children].find((e) => e.tagName === "H1");
    if (h) setH1(h.textContent || "");
    par.dataset.hero = "1";
    document.documentElement.dataset.hero = "1";
    return () => { delete par.dataset.hero; delete document.documentElement.dataset.hero; };
  }, [heroTheme, layout, title]);
  useEffect(() => { if (editing && objOn) api("/sysobjects/").then(setObjects).catch(() => {}); }, [editing, objOn]);

  // every change is saved a moment later
  const change = useCallback((fn) => {
    setLayout((cur) => {
      const next = fn(JSON.parse(JSON.stringify(cur || { rows: [] })));
      clearTimeout(timer.current);
      setSaving("saving");
      timer.current = setTimeout(async () => {
        try { await api(`/pages/layout/${encodeURIComponent(pageKey)}/`, { method: "PUT", body: next }); setSaving("saved"); setTimeout(() => setSaving(""), 1500); }
        catch (e) { setSaving(""); alertDialog(errorText(e)); }
      }, 600);
      return next;
    });
  }, [pageKey]);

  const rowOf = (l, id) => l.rows.find((r) => r.cells.some((c) => c.id === id));
  const move = (itemId, toCell, before) => change((l) => {
    let item = null;
    l.rows.forEach((r) => r.cells.forEach((c) => { const i = c.items.findIndex((x) => x.id === itemId); if (i >= 0) item = c.items.splice(i, 1)[0]; }));
    if (!item) return l;
    const cell = l.rows.flatMap((r) => r.cells).find((c) => c.id === toCell);
    if (!cell) return l;
    const at = before ? cell.items.findIndex((x) => x.id === before) : -1;
    cell.items.splice(at < 0 ? cell.items.length : at, 0, item);
    return l;
  });
  const addRow = (cols) => change((l) => { l.rows.push({ id: uid(), cols, gap: "md", cells: Array.from({ length: cols }, newCell) }); return l; });
  const setRow = (rid, patch) => change((l) => {
    const r = l.rows.find((x) => x.id === rid);
    Object.assign(r, patch);
    if (patch.cols) { while (r.cells.length < r.cols) r.cells.push(newCell()); while (r.cells.length > r.cols) { const gone = r.cells.pop(); r.cells[r.cells.length - 1].items.push(...gone.items); } }
    return l;
  });
  const moveRow = (rid, d) => change((l) => { const i = l.rows.findIndex((x) => x.id === rid), j = i + d; if (j >= 0 && j < l.rows.length) [l.rows[i], l.rows[j]] = [l.rows[j], l.rows[i]]; return l; });
  const delRow = (rid) => change((l) => { l.rows = l.rows.filter((x) => x.id !== rid); return l; });
  const setCell = (cid, patch) => change((l) => { Object.assign(l.rows.flatMap((r) => r.cells).find((c) => c.id === cid), patch); return l; });
  const addItem = (cid, type, ref = "") => { setMenu(null); change((l) => { l.rows.flatMap((r) => r.cells).find((c) => c.id === cid).items.push({ id: uid(), type, ref }); return l; }); };
  const delItem = (iid) => change((l) => { l.rows.forEach((r) => r.cells.forEach((c) => { c.items = c.items.filter((x) => x.id !== iid); })); return l; });

  if (!layout) return null;
  if (!editing && !layout.rows.some((r) => r.cells.some((c) => c.items.length))) return null;

  const renderItem = (c, it) => {
    const key = `layout.${pageKey}.${it.id}`;
    const body = it.type === "text" ? <EditableText id={key} as="div" rich fallback={editing ? tx("Klik om tekst te typen") : ""} className="pb-text" />
      : it.type === "image" ? <EditableImage id={key} className="pb-img" fallback={editing ? <div className="pb-ph">{tx("Klik om een afbeelding te kiezen")}</div> : null} />
      : <SysObjectBySlug slug={it.ref} />;
    if (!editing) return <div className={`pb-item${it.type === "object" ? " obj" : ""}`} key={it.id} style={{ textAlign: c.halign }}>{body}</div>;
    const label = it.type === "text" ? tx("Tekst") : it.type === "image" ? tx("Afbeelding") : (objects.find((o) => o.slug === it.ref)?.data?.name || it.ref);
    const shown = over?.id === it.id ? ` drop-${over.pos}` : "";
    const hover = (e) => { // above the middle of the item = before it, below = after it
      if (!drag.current || drag.current === it.id) return;
      e.preventDefault(); e.stopPropagation();
      const r = e.currentTarget.getBoundingClientRect();
      const pos = e.clientY < r.top + r.height / 2 ? "before" : "after";
      if (over?.id !== it.id || over.pos !== pos) setOver({ id: it.id, pos });
    };
    const drop = (e) => {
      e.preventDefault(); e.stopPropagation();
      const from = drag.current, pos = over?.id === it.id ? over.pos : "before";
      drag.current = null; setOver(null); setDragOn(null); setDragging(false);
      if (!from || from === it.id) return;
      const next = pos === "before" ? it.id : c.items[c.items.findIndex((x) => x.id === it.id) + 1]?.id;
      move(from, c.id, next === from ? null : next || null);
    };
    return (
      <div className={`pb-item edit${it.type === "object" ? " obj" : ""}${shown}${dragOn === it.id ? " dragging" : ""}`} key={it.id} style={{ textAlign: c.halign }}
        onDragOver={hover} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver((o) => (o?.id === it.id ? null : o)); }} onDrop={drop}>
        <div className="pb-itembar">
          <span className="pb-grip" title={tx("Sleep om te verplaatsen")} draggable
            onDragStart={(e) => { drag.current = it.id; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", it.id); const box = e.currentTarget.closest(".pb-item"); if (box) e.dataTransfer.setDragImage(box, 16, 16); setTimeout(() => { setDragOn(it.id); setDragging(true); }, 0); }}
            onDragEnd={() => { drag.current = null; setOver(null); setDragOn(null); setDragging(false); }}>⋮⋮ <small>{label}</small></span>
          <button type="button" className="btn sm danger pb-x" title={tx("Dit onderdeel van de pagina verwijderen")} onClick={() => delItem(it.id)}>{tx("Verwijder")}</button>
        </div>
        {body}
        {it.type === "object" && !objects.some((o) => o.slug === it.ref) && <small className="muted">{tx("Dit systeemobject bestaat niet meer of staat uit.")}</small>}
      </div>
    );
  };

  return (
    <section ref={root} data-t={layout.auto || heroTheme || undefined} className={`pb${editing ? " editing" : ""}${dragging ? " is-dragging" : ""}`}>
      {editing && (
        <div className="pb-layout"><div className="pb-listopts"><span className="muted">{tx("Items per pagina")}:</span><select value={pageSize} aria-label={tx("Items per pagina")} onChange={(e) => change((x) => { if (e.target.value === "all") delete x.page_size; else x.page_size = e.target.value; return x; })}>{["5", "10", "25", "100", "all"].map((v) => <option key={v} value={v}>{v === "all" ? tx("Alles") : v}</option>)}</select>
          <span className="muted">{tx("Breedte van de pagina")}:</span><span className="pb-seg">{[["column", "In de kolom"], ["full", "Paginabreed"]].map(([k, l]) => <button type="button" key={k} className={(pageWide ? "full" : "column") === k ? "on" : ""} onClick={() => change((x) => { if (k === "full") x.page_width = "full"; else delete x.page_width; return x; })}>{tx(l)}</button>)}</span>
          <span className="muted">{tx("Items zoals spelletjes en producten")}:</span>
          <span className="pb-seg">{[["grid", "Raster"], ["rows", "Rijen"]].map(([k, l]) => <button type="button" key={k} className={listView === k ? "on" : ""} onClick={() => change((x) => { x.list = { view: k, center: !!x.list?.center }; return x; })}>{tx(l)}</button>)}</span>
          <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={listCenter} onChange={(e) => change((x) => { x.list = { view: x.list?.view || "grid", center: e.target.checked }; return x; })} /><span /></span><span>{tx("Centreren")}</span></label></div>
          <label className="check sec-toggle" style={{ marginBottom: ".6rem" }}><span className="switch"><input type="checkbox" checked={!layout.hero_off} disabled={NO_HERO.includes(pageKey)} onChange={(e) => change((l) => { if (e.target.checked) delete l.hero_off; else l.hero_off = true; return l; })} /><span /></span><span>{tx("Hero tonen")} <small className="muted">{tx("De banner met de titel bovenaan de pagina.")}</small></span></label><LayoutPresets pageKey={pageKey} current={layout.preset || (layout.auto ? "auto" : "")} standard={!!layout.auto || ["community", "search", "payment", "members", "products", "product", "cart", "checkout", "subscriptions", "donations", "games"].includes(pageKey)} onApplied={(d) => setLayout(d)} /></div>
      )}
      {heroTheme && !heroRow && (title || h1) && (
        <div className="pb-rowwrap hero" data-t={heroTheme}><h1 className="pb-hero-title">{title || h1}</h1></div>
      )}
      {layout.rows.filter((r) => !(heroOff && r.hero)).map((r, ri) => (
        <div className={`pb-rowwrap${r.bg?.url ? " has-bg" : ""}${r.hero ? " hero" : r.cols > 1 ? " multi" : ""}`} data-t={r.hero || undefined} key={r.id} style={r.width && r.width !== "default" ? { width: `${r.width}%`, maxWidth: "none" } : undefined}>
          <BgLayer bg={r.bg} />
          {editing && (
            <div className="pb-rowbar">
              <strong>{tx("Raster")}</strong>
              <label>{tx("Kolommen")}<select value={r.cols} onChange={(e) => setRow(r.id, { cols: Number(e.target.value) })}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
              <label>{tx("Breedte")}<select value={r.width || "default"} onChange={(e) => setRow(r.id, { width: e.target.value })}>{ROW_WIDTHS.map((w) => <option key={w} value={w}>{w === "default" ? tx("Standaard") : w === "100" ? tx("100% (paginabreed)") : `${w}%`}</option>)}</select></label>
              <label>{tx("Ruimte")}<select value={r.gap} onChange={(e) => setRow(r.id, { gap: e.target.value })}><option value="sm">{tx("Klein")}</option><option value="md">{tx("Normaal")}</option><option value="lg">{tx("Groot")}</option></select></label>
              <BgControls bg={r.bg} onChange={(bg) => setRow(r.id, { bg })} />
              <span className="pb-spacer" />
              <button type="button" className="btn sm" disabled={ri === 0} onClick={() => moveRow(r.id, -1)} title={tx("Omhoog")}>↑</button>
              <button type="button" className="btn sm" disabled={ri === layout.rows.length - 1} onClick={() => moveRow(r.id, 1)} title={tx("Omlaag")}>↓</button>
              <button type="button" className="btn sm danger" onClick={() => delRow(r.id)}>{tx("Rij verwijderen")}</button>
            </div>
          )}
          {r.hero && (title || h1) && <h1 className="pb-hero-title">{title || h1}</h1>}
          <div className={`pb-row gap-${r.gap}`} style={{ "--cols": r.cols, "--tpl": columns(r) }}>
            {r.cells.map((c) => (
              <div className={`pb-cell${editing ? " edit" : ""}`} key={c.id} style={{ "--ha": AL_H[c.halign], "--jv": AL_V[c.valign], textAlign: c.halign }}
                onDragOver={(e) => { if (drag.current) e.preventDefault(); }}
                onDrop={(e) => { e.preventDefault(); if (drag.current) move(drag.current, c.id, null); drag.current = null; setOver(null); setDragOn(null); setDragging(false); }}>
                {editing && (
                  <div className="pb-cellbar" onClick={(e) => e.stopPropagation()}>
                    <span className="pb-seg" title={tx("Horizontaal uitlijnen")}>{[["left", "⇤", "Links"], ["center", "↔", "Midden"], ["right", "⇥", "Rechts"]].map(([k, g, l]) => <button type="button" key={k} className={c.halign === k ? "on" : ""} title={tx(l)} onClick={() => setCell(c.id, { halign: k })}>{g}</button>)}</span>
                    <span className="pb-seg" title={tx("Verticaal uitlijnen")}>{[["top", "⤒", "Boven"], ["center", "↕", "Midden"], ["bottom", "⤓", "Onder"]].map(([k, g, l]) => <button type="button" key={k} className={c.valign === k ? "on" : ""} title={tx(l)} onClick={() => setCell(c.id, { valign: k })}>{g}</button>)}</span>
                    <label className="pb-w" title={tx("Breedte van deze kolom")}>{tx("Kolom")}<select value={c.width || "auto"} onChange={(e) => setCell(c.id, { width: e.target.value })}>{CELL_WIDTHS.map((w) => <option key={w} value={w}>{w === "auto" ? tx("Gelijk") : `${w}%`}</option>)}</select></label>
                    <span className="pb-add">
                      <button type="button" className="btn sm primary" onClick={() => setMenu(menu === c.id ? null : c.id)}>+ {tx("Toevoegen")}</button>
                      {menu === c.id && (
                        <div className="pb-menu">
                          <button type="button" onClick={() => addItem(c.id, "text")}>{tx("Tekst")}</button>
                          <button type="button" onClick={() => addItem(c.id, "image")}>{tx("Afbeelding")}</button>
                          {objOn && <div className="pb-menu-h">{tx("Systeemobjecten")}</div>}
                          {objOn && objects.map((o) => <button type="button" key={o.slug} onClick={() => addItem(c.id, "object", o.slug)}>{o.names?.[Object.keys(o.names || {})[0]] || o.data?.name || o.slug} <small className="muted">{o.kind === "donation" ? tx("Donatie") : (o.kind === "plugin" || o.kind === "plugin_item") ? tx("Plugin") : tx("Abonnement")}</small></button>)}
                          {objOn && !objects.length && <small className="muted" style={{ padding: ".3rem .6rem" }}>{tx("Nog geen systeemobjecten (zie Admin → Systeemobjecten).")}</small>}
                        </div>
                      )}
                    </span>
                  </div>
                )}
                {c.items.map((it) => renderItem(c, it))}
                {editing && !c.items.length && <div className="pb-empty">{tx("Leeg: sleep hier iets naartoe of voeg iets toe")}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
      {editing && (
        <div className="pb-addrow">
          <strong>{tx("Blok of raster toevoegen")}:</strong>
          {[1, 2, 3, 4].map((n) => <button type="button" key={n} className="btn sm" onClick={() => addRow(n)}>{n === 1 ? tx("Blok") : `${n} ${tx("kolommen")}`}</button>)}
          {saving && <span className="muted">{saving === "saving" ? tx("Opslaan…") : tx("Opgeslagen")}</span>}
        </div>
      )}
    </section>
  );
}
