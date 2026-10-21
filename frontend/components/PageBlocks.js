"use client";

import { tx } from "../lib/t";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorText } from "../lib/api";
import { alertDialog, confirmDialog } from "../lib/dialog";
import { EditableImage, EditableText } from "./EditMode";
import { useModule } from "./Modules";
import { Logo } from "./BrandingContext";
import { useSession } from "./Session";
import { dragFixed, setMoved } from "../lib/moved";
import { pushUndo } from "../lib/undo";
import { SysObjectBySlug } from "./SysObjects";
import LayoutPresets from "./LayoutPresets";
import { BgControls, BgLayer } from "./SectionBg";
import Tabs from "./Tabs";
import PluginFrame from "./PluginFrame";
import MediaViewEditor from "./MediaViewEditor";
import BlockNav from "./BlockNav";
import { IconEdit, IconTrash } from "./Icons";
import { createPortal } from "react-dom";

const uid = () => Math.random().toString(16).slice(2, 10).padEnd(8, "0");
const newCell = () => ({ id: uid(), width: "auto", halign: "left", valign: "top", items: [] });
const TOKEN_VAR = { primary: "var(--blue)", secondary: "var(--orange)", card: "var(--card)", page: "var(--page, var(--bg))", text: "var(--text)", muted: "var(--muted)", ok: "var(--ok)", danger: "var(--danger)", white: "#ffffff", black: "#000000" };
const PALETTE = [["primary", "Primair"], ["secondary", "Secundair"], ["card", "Kaart"], ["page", "Pagina"], ["text", "Tekst"], ["muted", "Gedempt"], ["ok", "Succes"], ["danger", "Gevaar"], ["white", "Wit"], ["black", "Zwart"]];
const FONT_VAR = { body: "var(--font-body)", heading: "var(--font-heading)", serif: "Georgia, 'Times New Roman', serif", mono: "ui-monospace, Menlo, Consolas, monospace" };
const colorOf = (v) => (TOKEN_VAR[v] || v || "");
// the look of a block or hero as CSS
const styleCss = (st) => {
  if (!st) return {};
  const out = {};
  if (st.bg) out.background = `color-mix(in srgb, ${colorOf(st.bg)} ${st.bg_a ?? 100}%, transparent)`;
  if (st.color) { out.color = colorOf(st.color); out["--text"] = colorOf(st.color); }
  if (st.font) out.fontFamily = FONT_VAR[st.font];
  if (st.radius !== undefined && st.radius !== "") out.borderRadius = `${st.radius}px`;
  return out;
};
function ColorPick({ value, onChange }) {
  const custom = value && !TOKEN_VAR[value];
  return (
    <span className="pb-colorpick">
      <span className="pb-swatches">
        <button type="button" className={`pb-sw none${!value ? " on" : ""}`} title="Zoals het thema" onClick={() => onChange("")}>∅</button>
        {PALETTE.map(([k, l]) => <button key={k} type="button" className={`pb-sw${value === k ? " on" : ""}`} style={{ background: TOKEN_VAR[k] }} title={l} onClick={() => onChange(k)} />)}
        <input type="color" className={custom ? "on" : ""} value={custom ? value : "#888888"} onChange={(e) => onChange(e.target.value)} title="Eigen kleur" />
      </span>
    </span>
  );
}
// column layouts: the widths of the columns in % ("auto" = equal share)
const COLUMN_LAYOUTS = [["1", ["auto"]], ["50 / 50", ["50", "50"]], ["66 / 33", ["66", "33"]], ["33 / 66", ["33", "66"]], ["75 / 25", ["75", "25"]], ["25 / 75", ["25", "75"]], ["33 / 33 / 33", ["33", "33", "33"]], ["25 / 50 / 25", ["25", "50", "25"]], ["25 × 4", ["25", "25", "25", "25"]]];
const PAD_OPTS = [["none", "Geen"], ["sm", "Klein"], ["md", "Normaal"], ["lg", "Groot"], ["xl", "Extra groot"]];
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
  const [itemOpen, setItemOpen] = useState({}); // texts whose settings (text style, size, colour, font) are open
  const [pageOpen, setPageOpen] = useState(false); // the page settings (space, items per page, width, hero, layout) are folded away until the gear is clicked
  const [objPop, setObjPop] = useState(null); // {cell: id} while the system objects popup is open
  const [objQ, setObjQ] = useState("");
  const [objTab, setObjTab] = useState("");
  const [mediaEdit, setMediaEdit] = useState(null); // a media system object (photo book, carousel ...) being edited in a popup
  const [objEdit, setObjEdit] = useState(null); // the system object that is being edited in a popup
  const objDirty = useRef(false);
  const closeObjEdit = () => { setObjEdit(null); if (objDirty.current) { objDirty.current = false; window.location.reload(); } }; // something changed: the page shows the new version
  const [panelTab, setPanelTab] = useState({}); // the tab of the settings panel per row
  const [barOpen, setBarOpen] = useState({}); // rows whose settings panel is open (the gear in the corner): {rowId: true}
  const toggleBar = (id) => setBarOpen((m) => ({ ...m, [id]: !m[id] }));
  const rowDrag = useRef(null); // a whole row (block, hero) that is being dragged
  const [overRow, setOverRow] = useState(null); // {id, pos: before | after}
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
  useEffect(() => { if (layout) setMoved(pageKey, layout.moved || []); }, [layout, pageKey]);
  const heroOff = !!layout?.hero_off || NO_HERO.includes(pageKey);
  const own = (r) => r.hero && r.hero !== "custom" && r.hero !== "plain"; // the banner of the page itself; "custom" (a hero) and "plain" (a grid with a height, without the hero look) are blocks like any other
  const heroRow = layout?.rows?.find(own); // the banner of the page itself; extra heroes ("custom") are blocks like any other
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
  useEffect(() => { // a link with #anchor goes to that block (also when the blocks arrive a moment after the page)
    if (!layout || typeof window === "undefined" || !window.location.hash) return;
    const h = decodeURIComponent(window.location.hash.slice(1));
    const t = setTimeout(() => document.getElementById(h)?.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
    return () => clearTimeout(t);
  }, [layout?.rows?.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (editing && objOn) api("/sysobjects/").then(setObjects).catch(() => {}); }, [editing, objOn]);

  // every change is saved a moment later
  const layoutRef = useRef(null);
  layoutRef.current = layout;
  const saveNow = async (data) => { try { await api(`/pages/layout/${encodeURIComponent(pageKey)}/`, { method: "PUT", body: data }); } catch (e) { alertDialog(errorText(e)); } };
  const change = useCallback((fn) => {
    const before = layoutRef.current ? JSON.parse(JSON.stringify(layoutRef.current)) : null;
    if (before) pushUndo(tx("Wijziging aan de pagina"), async () => { clearTimeout(timer.current); setLayout(before); await saveNow(before); }, { key: `layout:${pageKey}`, merge: 1500 });
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
  const addHero = () => change((l) => { l.rows.push({ id: uid(), cols: 1, gap: "md", hero: "custom", h_mode: "pct", h: 50, cells: [{ ...newCell(), halign: "center", valign: "center", items: [{ id: uid(), type: "text", ref: "" }] }] }); return l; });
  const addGrid = () => change((l) => { l.rows.push({ id: uid(), cols: 3, gap: "md", hero: "plain", h_mode: "pct", h: 50, cells: Array.from({ length: 3 }, newCell) }); return l; });
  const setColumns = (rid, widths) => change((l) => {
    const r = l.rows.find((x) => x.id === rid);
    r.cols = widths.length;
    while (r.cells.length < r.cols) r.cells.push(newCell());
    while (r.cells.length > r.cols) { const gone = r.cells.pop(); r.cells[r.cells.length - 1].items.push(...gone.items); }
    r.cells.forEach((c, i) => { c.width = widths[i] === "auto" ? "auto" : widths[i]; });
    return l;
  });
  const heroNo = useRef({}); // the number of each hero on the page: a hero without a name of its own is "hero", "hero-2" ...
  const anchorOf = (r) => r.anchor || (r.hero ? (heroNo.current[r.id] > 1 ? `hero-${heroNo.current[r.id]}` : "hero") : "");
  const rowNavId = (r, i) => anchorOf(r) || `blok-${i + 1}`; // every block can be reached: its own anchor, else blok-1, blok-2 ...
  const titleOf = (r) => r.title || (r.hero ? (heroNo.current[r.id] > 1 ? `Hero ${heroNo.current[r.id]}` : "Hero") : "");
  const setRow = (rid, patch) => change((l) => {
    const r = l.rows.find((x) => x.id === rid);
    Object.assign(r, patch);
    if (patch.cols) { while (r.cells.length < r.cols) r.cells.push(newCell()); while (r.cells.length > r.cols) { const gone = r.cells.pop(); r.cells[r.cells.length - 1].items.push(...gone.items); } }
    return l;
  });
  const moveRow = (rid, d) => change((l) => { const i = l.rows.findIndex((x) => x.id === rid), j = i + d; if (j >= 0 && j < l.rows.length) [l.rows[i], l.rows[j]] = [l.rows[j], l.rows[i]]; return l; });
  const dropRow = (toId, pos) => { const from = rowDrag.current; if (from && from !== toId) moveRowTo(from, toId, pos); };
  const moveRowTo = (from, toId, pos) => change((l) => {
    const i = l.rows.findIndex((x) => x.id === from);
    if (i < 0) return l;
    const [row] = l.rows.splice(i, 1);
    const j = l.rows.findIndex((x) => x.id === toId);
    l.rows.splice(j < 0 ? l.rows.length : pos === "after" ? j + 1 : j, 0, row);
    return l;
  });
  // removing a hero: an extra hero is deleted; the banner of the page itself is switched off (it can be switched on again with "Hero tonen")
  const removeRow = async (r) => {
    if (!(await confirmDialog(r.hero === "plain" ? tx("Dit raster verwijderen?") : r.hero ? tx("Deze hero verwijderen?") : tx("Deze rij verwijderen?"), { danger: true }))) return;
    if (own(r)) change((l) => { l.hero_off = true; l.rows = l.rows.filter((x) => x.id !== r.id); return l; });
    else delRow(r.id);
  };
  const delRow = (rid) => change((l) => { l.rows = l.rows.filter((x) => x.id !== rid); return l; });
  const setAllCells = (rid, patch) => change((l) => { const row = l.rows.find((x) => x.id === rid); if (row) row.cells.forEach((c) => Object.assign(c, patch)); return l; });
  const setCell = (cid, patch) => change((l) => { Object.assign(l.rows.flatMap((r) => r.cells).find((c) => c.id === cid), patch); return l; });
  const addItem = (cid, type, ref = "") => { setMenu(null); change((l) => { l.rows.flatMap((r) => r.cells).find((c) => c.id === cid).items.push({ id: uid(), type, ref, ...(type === "heading" ? { style: { tag: "k2" } } : {}) }); return l; }); };
  const setItem = (iid, patch) => change((l) => { l.rows.forEach((r) => r.cells.forEach((c) => c.items.forEach((x) => { if (x.id === iid) { x.style = { ...(x.style || {}), ...patch }; Object.keys(x.style).forEach((k) => { if (x.style[k] === "" || x.style[k] == null) delete x.style[k]; }); if (!Object.keys(x.style).length) delete x.style; } }))); return l; });
  const dropFixed = (cid, before) => { // a fixed element of the page (logo, title, intro) is dropped in a cell
    const f = dragFixed();
    if (!f || f.page !== pageKey) return false;
    dragFixed(null); document.documentElement.classList.remove("fixed-dragging");
    change((l) => {
      const cell = l.rows.flatMap((r) => r.cells).find((c) => c.id === cid);
      if (!cell) return l;
      const item = { id: uid(), type: f.type, ref: f.id };
      const at = before ? cell.items.findIndex((x) => x.id === before) : -1;
      cell.items.splice(at < 0 ? cell.items.length : at, 0, item);
      l.moved = [...new Set([...(l.moved || []), f.id])];
      return l;
    });
    return true;
  };
  const delItem = (iid) => change((l) => { l.rows.forEach((r) => r.cells.forEach((c) => { const gone = c.items.find((x) => x.id === iid); if (gone?.ref && gone.type !== "object") l.moved = (l.moved || []).filter((k) => k !== gone.ref); c.items = c.items.filter((x) => x.id !== iid); })); if (!(l.moved || []).length) delete l.moved; return l; });

  if (!layout) return null;
  if (!editing && !layout.rows.some((r) => r.cells.some((c) => c.items.length))) return null;

  const renderItem = (c, it) => {
    const key = it.ref && it.type !== "object" ? it.ref : `layout.${pageKey}.${it.id}`; // a fixed element that was dragged in keeps its own content key
    const body = it.type === "text" ? <div className={`pb-tstyle${it.style?.tag ? ` ts-${it.style.tag}` : ""}${it.style?.size ? " ts-size" : ""}${it.style?.color ? " ts-color" : ""}${it.style?.font ? " ts-font" : ""}`} style={{ ...(it.style?.size ? { "--ti-size": `${it.style.size}rem` } : {}), ...(it.style?.color ? { "--ti-color": colorOf(it.style.color) } : {}), ...(it.style?.font ? { "--ti-font": FONT_VAR[it.style.font] } : {}) }}><EditableText id={key} removable={false} as="div" rich fallback={editing ? tx("Klik om tekst te typen") : ""} className="pb-text" /></div>
      : it.type === "heading" ? <div className={`pb-tstyle ts-${it.style?.tag || "k2"}${it.style?.size ? " ts-size" : ""}${it.style?.color ? " ts-color" : ""}${it.style?.font ? " ts-font" : ""}${it.style?.weight ? " ts-weight" : ""}`} style={{ ...(it.style?.size ? { "--ti-size": `${it.style.size}rem` } : {}), ...(it.style?.color ? { "--ti-color": colorOf(it.style.color) } : {}), ...(it.style?.font ? { "--ti-font": FONT_VAR[it.style.font] } : {}), ...(it.style?.weight ? { "--ti-weight": it.style.weight } : {}), textAlign: it.style?.align || c.halign, ...(it.style?.mb !== undefined ? { marginBottom: `${it.style.mb}rem` } : {}) }}><EditableText id={key} removable={false} as={{ k1: "h2", k2: "h3", k3: "h4", k4: "h5" }[it.style?.tag || "k2"] || "h3"} fallback={editing ? tx("Klik om een kop te typen") : ""} className="pb-text pb-heading" /></div>
      : it.type === "image" ? <div className={`pb-imgstyle${it.style?.w ? " has-w" : ""}`} style={{ ...(it.style?.align ? { justifyContent: { left: "flex-start", center: "center", right: "flex-end" }[it.style.align] } : {}), "--ii-w": it.style?.w || "auto", "--ii-o": (it.style?.opacity ?? 100) / 100, "--ii-r": it.style?.radius !== undefined ? `${it.style.radius}px` : "inherit" }}><EditableImage id={key} removable={false} className="pb-img" fallback={it.ref === "home.hero" ? <Logo /> : editing ? <div className="pb-ph">{tx("Klik om een afbeelding te kiezen")}</div> : null} /></div>
      : <SysObjectBySlug slug={it.ref} />;
    if (!editing) return <div className={`pb-item${it.type === "object" ? " obj" : ""}`} key={it.id} style={{ textAlign: c.halign }}>{body}</div>;
    const label = it.type === "heading" ? tx("Kop") : it.type === "text" ? tx("Tekst") : it.type === "image" ? tx("Afbeelding") : (objects.find((o) => o.slug === it.ref)?.data?.name || it.ref);
    const shown = over?.id === it.id ? ` drop-${over.pos}` : "";
    const hover = (e) => { // above the middle of the item = before it, below = after it
      if ((!drag.current && !dragFixed()) || drag.current === it.id) return;
      e.preventDefault(); e.stopPropagation();
      const r = e.currentTarget.getBoundingClientRect();
      const pos = e.clientY < r.top + r.height / 2 ? "before" : "after";
      if (over?.id !== it.id || over.pos !== pos) setOver({ id: it.id, pos });
    };
    const drop = (e) => {
      e.preventDefault(); e.stopPropagation();
      const from = drag.current, pos = over?.id === it.id ? over.pos : "before";
      if (!from && dragFixed()) { const nx = pos === "before" ? it.id : c.items[c.items.findIndex((x) => x.id === it.id) + 1]?.id; dropFixed(c.id, nx || null); setOver(null); return; }
      drag.current = null; setOver(null); setDragOn(null); setDragging(false);
      if (!from || from === it.id) return;
      const next = pos === "before" ? it.id : c.items[c.items.findIndex((x) => x.id === it.id) + 1]?.id;
      move(from, c.id, next === from ? null : next || null);
    };
    return (
      <div className={`pb-item edit${it.type === "object" ? " obj" : ""}${shown}${dragOn === it.id ? " dragging" : ""}`} key={it.id} style={{ textAlign: c.halign }}
        onDragOver={hover} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver((o) => (o?.id === it.id ? null : o)); }} onDrop={drop}>
        <div className="pb-itembar">
          <span className="pb-itemleft">
          <span className="pb-grip" title={tx("Sleep om te verplaatsen")} draggable
            onDragStart={(e) => { drag.current = it.id; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", it.id); const box = e.currentTarget.closest(".pb-item"); if (box) e.dataTransfer.setDragImage(box, 16, 16); setTimeout(() => { setDragOn(it.id); setDragging(true); }, 0); }}
            onDragEnd={() => { drag.current = null; setOver(null); setDragOn(null); setDragging(false); }}>⋮⋮ <small>{label}</small></span>
          {(it.type === "text" || it.type === "heading") && <button type="button" className={`pb-gear sm${itemOpen[it.id] ? " on" : ""}`} onClick={() => setItemOpen((m) => ({ ...m, [it.id]: !m[it.id] }))} aria-expanded={!!itemOpen[it.id]} title={tx("Tekstinstellingen")} aria-label={tx("Tekstinstellingen")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>
          </button>}
          {it.type === "object" && (() => { // a system object (product overview, donation, subscription ...): its settings, in a popup (a donation or subscription: its own admin page)
            const o = objects.find((x) => x.slug === it.ref);
            if (!o) return null;
            const plug = o.kind === "plugin" || o.kind === "plugin_item" || o.kind === "plugin_part";
            const href = o.kind === "donation" ? "/dashboard/admin/donations" : o.kind === "plan" ? "/dashboard/admin/subscriptions" : "";
            if (o.kind === "media") return <button type="button" className="btn sm pb-edit" title={tx("Dit systeemobject bewerken")} aria-label={tx("Dit systeemobject bewerken")} onClick={() => api("/mediaviews/").then((vs) => { const v = vs.find((x) => x.name === o.data?.name); if (v) setMediaEdit(v); })}><IconEdit width={13} height={13} /></button>;
            if (plug && o.data?.admin_web) return <button type="button" className="btn sm pb-edit" title={tx("Dit systeemobject bewerken")} aria-label={tx("Dit systeemobject bewerken")} onClick={() => setObjEdit(o)}><IconEdit width={13} height={13} /></button>;
            return href ? <a className="btn sm pb-edit" href={href} target="_blank" rel="noreferrer" title={tx("Dit systeemobject bewerken")} aria-label={tx("Dit systeemobject bewerken")}><IconEdit width={13} height={13} /></a> : null;
          })()}
          </span>
          <button type="button" className="btn sm danger pb-x pb-trash" title={tx("Dit onderdeel van de pagina verwijderen")} aria-label={tx("Dit onderdeel van de pagina verwijderen")} onClick={() => delItem(it.id)}><IconTrash width={22} height={22} /></button>
        </div>
        {it.type === "image" && itemOpen[it.id] && (
          <div className="pb-stylebox" onMouseDown={(e) => e.stopPropagation()}>
            <strong>{tx("Afbeeldingsinstellingen")}</strong>
            <div className="pb-stylerow"><span>{tx("Uitlijnen")}</span>
              <span className="pb-seg">{[["left", "⇤", "Links"], ["center", "↔", "Midden"], ["right", "⇥", "Rechts"]].map(([k, g, l]) => <button type="button" key={k} className={(it.style?.align || "") === k ? "on" : ""} title={tx(l)} onClick={() => setItem(it.id, { align: it.style?.align === k ? "" : k })}>{g} {tx(l)}</button>)}</span></div>
            <div className="pb-stylerow"><span>{tx("Grootte")}</span>
              <input type="number" min={1} max={4000} value={parseInt(it.style?.w) || ""} placeholder={tx("Auto")} onChange={(e) => setItem(it.id, { w: e.target.value === "" ? "" : `${e.target.value}${(it.style?.w || "").endsWith("%") ? "%" : "px"}` })} style={{ width: "6rem" }} />
              <select value={(it.style?.w || "").endsWith("%") ? "%" : "px"} onChange={(e) => it.style?.w && setItem(it.id, { w: `${parseInt(it.style.w)}${e.target.value}` })}><option value="px">px</option><option value="%">%</option></select>
              {[["25%", "Klein"], ["50%", "Middel"], ["75%", "Groot"], ["100%", "Volledig"]].map(([v, l]) => <button type="button" className={`btn sm${it.style?.w === v ? " primary" : ""}`} key={v} onClick={() => setItem(it.id, { w: v })}>{tx(l)}</button>)}</div>
            <div className="pb-stylerow"><span>{tx("Doorzichtigheid")}</span>
              <input type="range" min={0} max={100} step={5} value={it.style?.opacity ?? 100} onChange={(e) => setItem(it.id, { opacity: Number(e.target.value) })} style={{ width: 160 }} /><small className="muted">{it.style?.opacity ?? 100}% {tx("zichtbaar")}</small></div>
            <div className="pb-stylerow"><span>{tx("Ronde hoeken")}</span>
              <input type="number" min={0} max={200} step={2} value={it.style?.radius ?? ""} placeholder={tx("Thema")} onChange={(e) => setItem(it.id, { radius: e.target.value === "" ? "" : Number(e.target.value) })} style={{ width: "6rem" }} /><small className="muted">px</small>
              <button type="button" className="btn sm" disabled={!it.style} onClick={() => change((l) => { l.rows.forEach((r) => r.cells.forEach((c) => c.items.forEach((x) => { if (x.id === it.id) delete x.style; }))); return l; })}>{tx("Terug naar standaard")}</button></div>
          </div>
        )}
        {(it.type === "text" || it.type === "heading") && itemOpen[it.id] && (
          <div className="pb-stylebox" onMouseDown={(e) => e.stopPropagation()}>
            <strong>{it.type === "heading" ? tx("Titel setup") : tx("Tekstinstellingen")}</strong>
            <div className="pb-stylerow"><span>{it.type === "heading" ? tx("Niveau") : tx("Opmaak")}</span>
              <select value={it.type === "heading" ? it.style?.tag || "k2" : it.style?.tag || ""} onChange={(e) => setItem(it.id, { tag: e.target.value })}>
                {it.type !== "heading" && <option value="">{tx("Zoals in de tekst")}</option>}<option value="k1">{tx("Kop 1")}</option><option value="k2">{tx("Kop 2")}</option><option value="k3">{tx("Kop 3")}</option><option value="k4">{tx("Kop 4")}</option>{it.type !== "heading" && <option value="p">{tx("Alinea")}</option>}
              </select></div>
            {it.type === "heading" && (
              <>
                <div className="pb-stylerow"><span>{tx("Uitlijnen")}</span>
                  <span className="pb-seg">{[["", "Zoals de kolom"], ["left", "Links"], ["center", "Midden"], ["right", "Rechts"]].map(([k, l]) => <button type="button" key={k || "col"} className={(it.style?.align || "") === k ? "on" : ""} onClick={() => setItem(it.id, { align: k })}>{tx(l)}</button>)}</span></div>
                <div className="pb-stylerow"><span>{tx("Dikte")}</span>
                  <select value={it.style?.weight || ""} onChange={(e) => setItem(it.id, { weight: e.target.value })}>
                    <option value="">{tx("Zoals het thema")}</option><option value="400">{tx("Normaal")}</option><option value="500">{tx("Medium")}</option><option value="600">{tx("Halfvet")}</option><option value="700">{tx("Vet")}</option><option value="800">{tx("Extra vet")}</option>
                  </select></div>
                <div className="pb-stylerow"><span>{tx("Ruimte eronder")}</span>
                  <input type="range" min={0} max={4} step={0.25} value={it.style?.mb ?? 0.5} onChange={(e) => setItem(it.id, { mb: Number(e.target.value) })} style={{ width: 160 }} /><small className="muted">{it.style?.mb ?? 0.5} rem</small></div>
              </>
            )}
            <div className="pb-stylerow"><span>{tx("Lettergrootte")}</span>
              <input type="number" min={0.6} max={6} step={0.1} value={it.style?.size || ""} placeholder={tx("Thema")} onChange={(e) => setItem(it.id, { size: e.target.value === "" ? "" : Number(e.target.value) })} style={{ width: "6rem" }} /><small className="muted">rem</small></div>
            <div className="pb-stylerow"><span>{tx("Kleur")}</span><ColorPick value={it.style?.color || ""} onChange={(v) => setItem(it.id, { color: v })} /></div>
            <div className="pb-stylerow"><span>{tx("Lettertype")}</span>
              <select value={it.style?.font || ""} onChange={(e) => setItem(it.id, { font: e.target.value })}>
                <option value="">{tx("Zoals het thema")}</option><option value="body">{tx("Lettertype van de tekst")}</option><option value="heading">{tx("Lettertype van de koppen")}</option><option value="serif">Serif</option><option value="mono">Monospace</option>
              </select>
              <button type="button" className="btn sm" disabled={!it.style} onClick={() => change((l) => { l.rows.forEach((r) => r.cells.forEach((c) => c.items.forEach((x) => { if (x.id === it.id) delete x.style; }))); return l; })}>{tx("Terug naar thema")}</button></div>
          </div>
        )}
        {body}
        {it.type === "object" && !objects.some((o) => o.slug === it.ref) && <small className="muted">{tx("Dit systeemobject bestaat niet meer of staat uit.")}</small>}
      </div>
    );
  };

  return (
    <section ref={root} data-pad={layout.pad || undefined} data-t={layout.auto || heroTheme || undefined} className={`pb${editing ? " editing" : ""}${dragging ? " is-dragging" : ""}`}>
      {editing && (
        <button type="button" className={`pb-pagegear${pageOpen ? " on" : ""}`} onClick={() => setPageOpen(!pageOpen)} aria-expanded={pageOpen} title={pageOpen ? tx("Pagina-instellingen verbergen") : tx("Pagina-instellingen tonen")} aria-label={tx("Pagina-instellingen")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /><circle cx="9" cy="6" r="2" fill="var(--card)" /><circle cx="15" cy="12" r="2" fill="var(--card)" /><circle cx="8" cy="18" r="2" fill="var(--card)" /></svg>
        </button>
      )}
      {editing && pageOpen && (
        <div className="pb-layout"><div className="pb-listopts"><span className="muted">{tx("Ruimte (padding)")}:</span><select value={layout.pad || "md"} aria-label={tx("Ruimte (padding)")} onChange={(e) => change((x) => { if (e.target.value === "md") delete x.pad; else x.pad = e.target.value; return x; })}>{PAD_OPTS.map(([k, l]) => <option key={k} value={k}>{tx(l)}</option>)}</select>
          <span className="muted">{tx("Items per pagina")}:</span><select value={pageSize} aria-label={tx("Items per pagina")} onChange={(e) => change((x) => { if (e.target.value === "all") delete x.page_size; else x.page_size = e.target.value; return x; })}>{["5", "10", "25", "100", "all"].map((v) => <option key={v} value={v}>{v === "all" ? tx("Alles") : v}</option>)}</select>
          <span className="muted">{tx("Breedte van de pagina")}:</span><span className="pb-seg">{[["column", "In de kolom"], ["full", "Paginabreed"]].map(([k, l]) => <button type="button" key={k} className={(pageWide ? "full" : "column") === k ? "on" : ""} onClick={() => change((x) => { if (k === "full") x.page_width = "full"; else delete x.page_width; return x; })}>{tx(l)}</button>)}</span>
          <span className="muted">{tx("Items zoals spelletjes en producten")}:</span>
          <span className="pb-seg">{[["grid", "Raster"], ["rows", "Rijen"]].map(([k, l]) => <button type="button" key={k} className={listView === k ? "on" : ""} onClick={() => change((x) => { x.list = { view: k, center: !!x.list?.center }; return x; })}>{tx(l)}</button>)}</span>
          <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={listCenter} onChange={(e) => change((x) => { x.list = { view: x.list?.view || "grid", center: e.target.checked }; return x; })} /><span /></span><span>{tx("Centreren")}</span></label></div>
          <label className="check sec-toggle" style={{ marginBottom: ".6rem" }}><span className="switch"><input type="checkbox" checked={!layout.hero_off} disabled={NO_HERO.includes(pageKey)} onChange={(e) => change((l) => { if (e.target.checked) delete l.hero_off; else l.hero_off = true; return l; })} /><span /></span><span>{tx("Hero tonen")} <small className="muted">{tx("De banner met de titel bovenaan de pagina.")}</small></span></label><LayoutPresets pageKey={pageKey} current={layout.preset || (layout.auto ? "auto" : "")} standard={!!layout.auto || ["community", "search", "payment", "members", "products", "product", "cart", "checkout", "subscriptions", "donations", "games"].includes(pageKey)} onApplied={(d) => setLayout(d)} /></div>
      )}
      {heroTheme && !heroRow && (title || h1) && (
        <div className="pb-rowwrap hero" data-t={heroTheme}><h1 className="pb-hero-title">{title || h1}</h1></div>
      )}
      {(() => { // number the heroes; the blocks that have a name or an anchor go in the list at the top left
        heroNo.current = {}; let n = 0; layout.rows.forEach((x) => { if (x.hero) heroNo.current[x.id] = ++n; });
        const shown = layout.rows.filter((r) => !(heroOff && own(r)) && (editing || r.hero || r.bg?.url || r.cells.some((c) => c.items.length)));
        return <BlockNav items={shown.map((r) => ({ id: layout.rows.filter((x) => !(heroOff && own(x))).indexOf(r) >= 0 ? rowNavId(r, layout.rows.filter((x) => !(heroOff && own(x))).indexOf(r)) : "", title: titleOf(r) || `${tx("Blok")} ${layout.rows.filter((x) => !(heroOff && own(x))).indexOf(r) + 1}` })).filter((i) => i.id)} />;
      })()}
      {layout.rows.filter((r) => !(heroOff && own(r))).map((r, ri) => (
        <div id={rowNavId(r, ri)} className={`pb-rowwrap${r.bg?.url ? " has-bg" : ""}${r.hero ? " hero" : r.cols > 1 ? " multi" : ""}${r.h_mode ? " sized" : ""}${r.hero === "custom" ? " custom" : ""}${r.hero === "plain" ? " plain" : ""}${r.style?.bg || r.style?.radius !== undefined ? " styled" : ""}${r.style?.color ? " tcolor" : ""}${overRow?.id === r.id ? ` row-drop-${overRow.pos}` : ""}`} data-t={r.hero || undefined} key={r.id} onDragOver={(e) => { if (!rowDrag.current || rowDrag.current === r.id) return; e.preventDefault(); const b = e.currentTarget.getBoundingClientRect(); const pos = e.clientY < b.top + b.height / 2 ? "before" : "after"; if (overRow?.id !== r.id || overRow.pos !== pos) setOverRow({ id: r.id, pos }); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOverRow((o) => (o?.id === r.id ? null : o)); }}
          onDrop={(e) => { if (!rowDrag.current) return; e.preventDefault(); e.stopPropagation(); const pos = overRow?.id === r.id ? overRow.pos : "before"; dropRow(r.id, pos); rowDrag.current = null; setOverRow(null); setDragging(false); }}
          data-sqm={r.sq_mobile ? "1" : undefined} data-pad={r.pad || undefined} data-fx={r.fx || undefined} data-v={r.v || undefined} data-touch={r.top === "touch" ? "1" : undefined} data-prev={r.top === "prev" ? "1" : undefined} style={{ ...styleCss(r.style), ...(r.mt !== undefined && r.mt !== null && r.top !== "touch" ? { marginTop: `calc(${r.mt}px - var(--pbg, 1.2rem))` } : {}), ...(r.padding ? { ...(r.padding.t != null ? { paddingTop: `${r.padding.t}px` } : {}), ...(r.padding.r != null ? { paddingRight: `${r.padding.r}px` } : {}), ...(r.padding.b != null ? { paddingBottom: `${r.padding.b}px` } : {}), ...(r.padding.l != null ? { paddingLeft: `${r.padding.l}px` } : {}) } : {}), ...(r.screen ? { width: `${r.width && r.width !== "default" ? r.width : 100}vw`, maxWidth: "none", marginLeft: "calc(50% - 50vw)", marginRight: "calc(50% - 50vw)", paddingLeft: 0, paddingRight: 0 } : r.width && r.width !== "default" ? { width: `${r.width}%`, maxWidth: "none" } : {}), ...(r.h_mode ? { justifyContent: { top: "flex-start", center: "center", bottom: "flex-end" }[r.v || "center"], minHeight: r.h_mode === "px" ? `${r.h || 400}px` : r.h_mode === "pct" ? `${r.h || 50}vh` : "100svh" } : {}) }}>
          <BgLayer bg={r.bg} />
          {editing && (
            <div className="pb-corner">
              <span className="pb-rowgrip" draggable title={tx("Sleep dit blok naar een andere plek, ook naar boven")}
                onDragStart={(e) => { rowDrag.current = r.id; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", r.id); const box = e.currentTarget.closest(".pb-rowwrap"); if (box) e.dataTransfer.setDragImage(box, 16, 16); setTimeout(() => setDragging(true), 0); }}
                onDragEnd={() => { rowDrag.current = null; setOverRow(null); setDragging(false); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.7" /><circle cx="15" cy="6" r="1.7" /><circle cx="9" cy="12" r="1.7" /><circle cx="15" cy="12" r="1.7" /><circle cx="9" cy="18" r="1.7" /><circle cx="15" cy="18" r="1.7" /></svg>
              </span>
              <button type="button" className={`pb-gear${barOpen[r.id] ? " on" : ""}`} onClick={() => toggleBar(r.id)} aria-expanded={!!barOpen[r.id]} title={tx("Instellingen")} aria-label={tx("Instellingen")}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>
              </button>
            </div>
          )}
          {editing && mediaEdit && r === layout.rows[0] && <MediaViewEditor view={mediaEdit} onClose={() => setMediaEdit(null)} onSaved={() => window.location.reload()} />}
          {editing && objEdit && typeof document !== "undefined" && r === layout.rows[0] && createPortal(
            <div className="pb-objback" onMouseDown={(e) => { if (e.target === e.currentTarget) closeObjEdit(); }}>
              <div className="pb-objpop" role="dialog" aria-label={tx("Systeemobject bewerken")} style={{ width: "min(860px, 100%)" }}>
                <div className="pb-objhead"><strong>{objEdit.data?.title || objEdit.names?.[""] || objEdit.slug}</strong><span style={{ flex: 1 }} /><button type="button" className="pb-panelx" onClick={closeObjEdit} aria-label={tx("Sluiten")}>×</button></div>
                <PluginFrame name={objEdit.data.name} file={objEdit.data.admin_web} bare route={{ params: {}, query: { popup: "1", ...(objEdit.data.query?.design ? { tab: "designs", edit: objEdit.data.query.design } : {}) } }} onWrite={() => { objDirty.current = true; }} />
              </div>
            </div>, document.body)}
          {editing && objPop && objPop.row === r.id && typeof document !== "undefined" && createPortal(
            <div className="pb-objback" onMouseDown={(e) => { if (e.target === e.currentTarget) setObjPop(null); }}>
              <div className="pb-objpop" role="dialog" aria-label={tx("Systeemobjecten")}>
                <div className="pb-objhead"><strong>{tx("Systeemobjecten")}</strong>
                  <input type="search" value={objQ} onChange={(e) => setObjQ(e.target.value)} placeholder={tx("Zoeken")} autoFocus />
                  <button type="button" className="pb-panelx" onClick={() => setObjPop(null)} aria-label={tx("Sluiten")}>×</button></div>
                {!objects.length && <small className="muted">{tx("Nog geen systeemobjecten (zie Admin → Systeemobjecten).")}</small>}
                {(() => { // one tab per module: donations, subscriptions and every plugin on its own
                  const nameOf = (o) => `${o.names?.[Object.keys(o.names || {})[0]] || o.data?.name || o.slug}`;
                  const tabOf = (o) => (o.kind === "plugin" || o.kind === "plugin_item" || o.kind === "plugin_part") ? `plugin:${o.data?.name || "plugin"}` : o.kind;
                  const labelOf = (o) => o.kind === "donation" ? "Donaties" : o.kind === "plan" ? "Abonnementen" : (o.data?.plugin_title || o.data?.title || o.data?.name || "Plugin");
                  const hits = objects.filter((o) => !objQ || nameOf(o).toLowerCase().includes(objQ.toLowerCase()));
                  const tabs = [];
                  for (const o of hits) if (!tabs.some((x) => x[0] === tabOf(o))) tabs.push([tabOf(o), labelOf(o), null, 0]);
                  tabs.forEach((x) => { x[3] = hits.filter((o) => tabOf(o) === x[0]).length; });
                  const cur = tabs.some((x) => x[0] === objTab) ? objTab : tabs[0]?.[0];
                  return <>
                    {tabs.length > 0 && <Tabs value={cur} onChange={setObjTab} tabs={tabs.map(([k, l, i, n]) => [k, tx(l), i || undefined, n])} />}
                    <div className="pb-objgrid" style={{ marginTop: ".7rem" }}>{hits.filter((o) => tabOf(o) === cur).map((o) => <button type="button" key={o.slug} onClick={() => { addItem(objPop.cell, "object", o.slug); setObjPop(null); }}>{nameOf(o)}</button>)}</div>
                    {objQ && !tabs.length && <small className="muted">{tx("Niets gevonden.")}</small>}
                  </>;
                })()}
              </div>
            </div>, document.body)}
          {editing && (anchorOf(r) || titleOf(r)) && <span className="pb-rowtag" title={tx("Het adres van dit blok")}>{titleOf(r)}{anchorOf(r) && <b> #{anchorOf(r)}</b>}</span>}
          {editing && barOpen[r.id] && typeof document !== "undefined" && createPortal(
            <div className="pb-popback" onMouseDown={(e) => { if (e.target === e.currentTarget) toggleBar(r.id); }}>
            <div className="pb-rowbar pop pb-center" role="dialog" aria-label={tx("Instellingen")} onMouseDown={(e) => e.stopPropagation()}>
              <div className="pb-panelhead"><strong>{r.hero === "plain" ? tx("Raster") : r.hero ? tx("Hero") : tx("Rij")}</strong>
                <button type="button" className="icon-btn pb-panelx" onClick={() => toggleBar(r.id)} aria-label={tx("Sluiten")} title={tx("Sluiten")}>✕</button>
                <Tabs className="pb-paneltabs" value={panelTab[r.id] || "layout"} onChange={(v) => setPanelTab((t) => ({ ...t, [r.id]: v }))} tabs={[["layout", "Indeling"], ["size", "Afmetingen"], ["align", "Uitlijning"], ["pad", "Ruimte"], ["style", "Opmaak"], ["bg", "Achtergrond"]]} />
              </div>
              {(panelTab[r.id] || "layout") === "layout" && (
                <div className="pb-panelbody">
              <div className="pb-aligngroup wide pb-anchorbox">
                <strong>{tx("Titel en adres van dit blok")}</strong>
                <div className="pb-anchorrow">
                  <label>{tx("Titel")}<input value={r.title ?? titleOf(r)} maxLength={80} placeholder={tx("Bijvoorbeeld: Over ons")} onChange={(e) => setRow(r.id, { title: e.target.value })} /></label>
                  <label>{tx("Anker")}<span className="pb-anchorin">#<input value={r.anchor ?? anchorOf(r)} maxLength={40} placeholder="over-ons" onChange={(e) => setRow(r.id, { anchor: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-") })} /></span></label>
                </div>
                {anchorOf(r) && <small className="muted">{tx("Link naar dit blok:")} <code>{typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}#${anchorOf(r)}` : `#${anchorOf(r)}`}</code>{" "}
                  <button type="button" className="btn sm" onClick={() => navigator.clipboard?.writeText(`${window.location.origin}${window.location.pathname}#${anchorOf(r)}`)}>{tx("Kopieer")}</button></small>}
              </div>
              <div className="pb-colchooser" role="group" aria-label={tx("Kolomindeling")}>
                <strong>{tx("Kolomindeling")}</strong>
                <span className="pb-coltiles">
                  {COLUMN_LAYOUTS.map(([name, widths]) => {
                    const on = r.cells.length === widths.length && r.cells.every((c, i) => (c.width || "auto") === widths[i] || (widths[i] === "auto" && (!c.width || c.width === "auto")) || (widths.every((w) => w === widths[0]) && r.cells.every((x) => (x.width || "auto") === "auto" || x.width === widths[0])));
                    return (
                      <button key={name} type="button" className={`pb-coltile${on ? " on" : ""}`} onClick={() => setColumns(r.id, widths)} title={`${widths.length} ${tx("kolommen")}: ${name}`}>
                        <span>{widths.map((w, i) => <i key={i} style={{ flex: w === "auto" ? 1 : Number(w) }} />)}</span>
                        <small>{name}</small>
                      </button>
                    );
                  })}
                </span>
              </div>
              <label>{tx("Kolommen")}<select value={r.cols} onChange={(e) => setRow(r.id, { cols: Number(e.target.value) })}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
              <label>{tx("Ruimte")}<select value={r.gap} onChange={(e) => setRow(r.id, { gap: e.target.value })}><option value="sm">{tx("Klein")}</option><option value="md">{tx("Normaal")}</option><option value="lg">{tx("Groot")}</option></select></label>
                </div>
              )}
              {panelTab[r.id] === "size" && (
                <div className="pb-panelbody">
              <label>{tx("Breedte is een deel van")}<select value={r.screen ? "screen" : "page"} onChange={(e) => setRow(r.id, { screen: e.target.value === "screen", width: e.target.value === "screen" && (!r.width || r.width === "default") ? "100" : r.width })}><option value="page">{tx("De pagina")}</option><option value="screen">{tx("De hele browser (volle breedte)")}</option></select></label>
              <label>{tx("Breedte")}<select value={r.width || "default"} onChange={(e) => setRow(r.id, { width: e.target.value })}>{ROW_WIDTHS.map((w) => <option key={w} value={w}>{w === "default" ? tx("Standaard") : w === "100" ? (r.screen ? "100% (hele browser)" : tx("100% (paginabreed)")) : `${w}%`}</option>)}</select></label>
              {true && (
                <label>{tx("Hoogte")}
                  <select value={r.h_mode || "auto"} onChange={(e) => { const m = e.target.value; setRow(r.id, m === "auto" ? { h_mode: "", h: 0 } : { h_mode: m, h: m === "px" ? 400 : m === "pct" ? 50 : 100 }); }}>
                    <option value="auto">{tx("Automatisch")}</option><option value="px">{tx("Pixels")}</option><option value="pct">{tx("Procent van het scherm")}</option><option value="full">{tx("Volledig scherm")}</option>
                  </select>
                  {(r.h_mode === "px" || r.h_mode === "pct") && <input type="number" min={r.h_mode === "pct" ? 10 : 80} max={r.h_mode === "pct" ? 100 : 1600} value={r.h || ""} onChange={(e) => e.target.value !== "" && setRow(r.id, { h: Number(e.target.value) })} style={{ width: "5rem" }} aria-label={tx("Hoogte")} />}
                  {(r.h_mode === "px" || r.h_mode === "pct") && <small className="muted">{r.h_mode === "px" ? "px" : "%"}</small>}
                </label>
              )}
              <label>{tx("Ruimte boven en onder")}<select value={r.pad || ""} onChange={(e) => setRow(r.id, { pad: e.target.value })}><option value="">{tx("Pagina")}</option>{PAD_OPTS.map(([k, l]) => <option key={k} value={k}>{tx(l)}</option>)}</select></label>
                </div>
              )}
              {panelTab[r.id] === "align" && (
                <div className="pb-panelbody">
                  <div className="pb-aligngroup">
                    <strong>{tx("Horizontaal in het blok")}</strong>
                    <span className="pb-seg">{[["left", "⇤", "Links"], ["center", "↔", "Midden"], ["right", "⇥", "Rechts"]].map(([k, g, l]) => <button type="button" key={k} className={r.cells.every((c) => c.halign === k) ? "on" : ""} title={tx(l)} onClick={() => setAllCells(r.id, { halign: k })}>{g} {tx(l)}</button>)}</span>
                  </div>
                  <div className="pb-aligngroup">
                    <strong>{tx("Verticaal in de kolommen")}</strong>
                    <span className="pb-seg">{[["top", "⤒", "Boven"], ["center", "↕", "Midden"], ["bottom", "⤓", "Onder"]].map(([k, g, l]) => <button type="button" key={k} className={r.cells.every((c) => c.valign === k) ? "on" : ""} title={tx(l)} onClick={() => setAllCells(r.id, { valign: k })}>{g} {tx(l)}</button>)}</span>
                  </div>
              {true && (<>
                <label>{tx("Plek van het blok op de pagina")}
                  <select value={r.v || "center"} onChange={(e) => setRow(r.id, { v: e.target.value })} disabled={!r.h_mode} title={!r.h_mode ? tx("Kies eerst een hoogte") : undefined}>
                    <option value="top">{tx("Boven")}</option><option value="center">{tx("Gecentreerd")}</option><option value="bottom">{tx("Onder")}</option>
                  </select>
                </label>
              
                  {true && (
                    <label>{tx("Plaats in het scherm")}
                      <select value={r.top || ""} onChange={(e) => setRow(r.id, { top: e.target.value })}>
                        <option value="">{tx("Onder de header / het vorige blok (met ruimte)")}</option><option value="touch">{tx("Direct tegen de header")}</option><option value="prev">{tx("Tegen het vorige blok")}</option>
                      </select>
                    </label>
                  )}
                  <label className="pb-padslider wide">{tx("Ruimte tussen de blokken")}
                    <input type="range" min={0} max={200} step={4} value={r.mt ?? 24} onChange={(e) => setRow(r.id, { mt: Number(e.target.value) })} aria-label={tx("Ruimte tussen de blokken")} />
                    <small className="muted">{r.mt === undefined || r.mt === null ? tx("standaard") : `${r.mt} px`}</small>
                  </label>
                  {r.mt !== undefined && r.mt !== null && <button type="button" className="btn sm" onClick={() => setRow(r.id, { mt: null })}>{tx("Ruimte terug naar standaard")}</button>}
                </>)}
                </div>
              )}
              {panelTab[r.id] === "pad" && (
                <div className="pb-panelbody">
                  <div className="pb-aligngroup wide">
                    <strong>{tx("Ruimte binnen het blok (padding)")}</strong>
                    <div className="pb-padgrid">
                  <label className="pb-padslider">{tx("Boven")}
                    <input type="range" min={0} max={200} step={4} value={r.padding?.t ?? 0} onChange={(e) => setRow(r.id, { padding: { ...(r.padding || {}), t: Number(e.target.value) } })} aria-label={tx("Boven")} />
                    <small className="muted">{r.padding?.t ?? 0} px</small>
                  </label>
                  <label className="pb-padslider">{tx("Rechts")}
                    <input type="range" min={0} max={200} step={4} value={r.padding?.r ?? 0} onChange={(e) => setRow(r.id, { padding: { ...(r.padding || {}), r: Number(e.target.value) } })} aria-label={tx("Rechts")} />
                    <small className="muted">{r.padding?.r ?? 0} px</small>
                  </label>
                  <label className="pb-padslider">{tx("Onder")}
                    <input type="range" min={0} max={200} step={4} value={r.padding?.b ?? 0} onChange={(e) => setRow(r.id, { padding: { ...(r.padding || {}), b: Number(e.target.value) } })} aria-label={tx("Onder")} />
                    <small className="muted">{r.padding?.b ?? 0} px</small>
                  </label>
                  <label className="pb-padslider">{tx("Links")}
                    <input type="range" min={0} max={200} step={4} value={r.padding?.l ?? 0} onChange={(e) => setRow(r.id, { padding: { ...(r.padding || {}), l: Number(e.target.value) } })} aria-label={tx("Links")} />
                    <small className="muted">{r.padding?.l ?? 0} px</small>
                  </label>
                    </div>
                    <button type="button" className="btn sm" disabled={!r.padding} onClick={() => setRow(r.id, { padding: null })}>{tx("Terug naar standaard")}</button>
                  </div>
                </div>
              )}
              {panelTab[r.id] === "style" && (
                <div className="pb-panelbody">
              <div className="pb-stylebox">
                <strong>{tx("Opmaak van dit blok")}</strong>
                <div className="pb-stylerow"><span>{tx("Achtergrondkleur")}</span><ColorPick value={r.style?.bg || ""} onChange={(v) => setRow(r.id, { style: { ...(r.style || {}), bg: v, bg_a: r.style?.bg_a ?? 100 } })} />
                  {r.style?.bg && <label className="pb-alpha">{tx("Doorzichtigheid")}<input type="range" min={0} max={100} step={5} value={r.style?.bg_a ?? 100} onChange={(e) => setRow(r.id, { style: { ...r.style, bg_a: Number(e.target.value) } })} /><small>{r.style?.bg_a ?? 100}% {tx("zichtbaar")}</small></label>}</div>
                <div className="pb-stylerow"><span>{tx("Tekstkleur")}</span><ColorPick value={r.style?.color || ""} onChange={(v) => setRow(r.id, { style: { ...(r.style || {}), color: v } })} /></div>
                <div className="pb-stylerow"><span>{tx("Ronde hoeken")}</span>
                  <input type="number" min={0} max={200} step={2} value={r.style?.radius ?? ""} placeholder={tx("Thema")} onChange={(e) => setRow(r.id, { style: { ...(r.style || {}), radius: e.target.value === "" ? "" : Number(e.target.value) } })} style={{ width: "6rem" }} /><small className="muted">px</small>
                  <input type="range" min={0} max={80} step={2} value={r.style?.radius ?? 0} onChange={(e) => setRow(r.id, { style: { ...(r.style || {}), radius: Number(e.target.value) } })} style={{ width: 140 }} aria-label={tx("Ronde hoeken")} />
                </div>
                <div className="pb-stylerow pb-mobradius"><span>{tx("Ronde hoeken op mobiel")}</span>
                  <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={!r.sq_mobile} onChange={(e) => setRow(r.id, { sq_mobile: !e.target.checked })} /><span /></span><span>{r.sq_mobile ? tx("Uit: op een telefoon zijn de hoeken recht") : tx("Aan: ook op een telefoon")}</span></label>
                </div>
                <div className="pb-stylerow"><span>{tx("Lettertype")}</span>
                  <select value={r.style?.font || ""} onChange={(e) => setRow(r.id, { style: { ...(r.style || {}), font: e.target.value } })}>
                    <option value="">{tx("Zoals het thema")}</option><option value="body">{tx("Lettertype van de tekst")}</option><option value="heading">{tx("Lettertype van de koppen")}</option><option value="serif">Serif</option><option value="mono">Monospace</option>
                  </select>
                  <button type="button" className="btn sm" disabled={!r.style || !Object.keys(r.style).length} onClick={() => setRow(r.id, { style: {} })}>{tx("Terug naar thema")}</button>
                </div>
              </div>
              <label>{tx("Scrolleffect")}
                <select value={r.fx || ""} onChange={(e) => setRow(r.id, { fx: e.target.value })}>
                  <option value="">{tx("Zoals het thema")}</option><option value="none">{tx("Geen effect")}</option><option value="fade">{tx("Vervagen")}</option><option value="up">{tx("Omhoog schuiven")}</option><option value="down">{tx("Omlaag schuiven")}</option><option value="left">{tx("Van links")}</option><option value="right">{tx("Van rechts")}</option><option value="zoom">{tx("Inzoomen")}</option><option value="blur">{tx("Scherp worden")}</option>
                </select>
              </label>
                </div>
              )}
              {panelTab[r.id] === "bg" && (
                <div className="pb-panelbody">
              <BgControls bg={r.bg} onChange={(bg) => setRow(r.id, { bg })} />
                  <small className="muted">{tx("Een afbeelding of video achter dit blok, met de donkerte erover.")}</small>
                </div>
              )}
              <div className="pb-panelfoot">
                <button type="button" className="btn sm" disabled={ri === 0} onClick={() => moveRow(r.id, -1)} title={tx("Omhoog")}>↑</button>
                <button type="button" className="btn sm" disabled={ri === layout.rows.length - 1} onClick={() => moveRow(r.id, 1)} title={tx("Omlaag")}>↓</button>
                <span className="pb-spacer" />
              <button type="button" className="btn sm danger pb-trash" onClick={() => removeRow(r)} title={r.hero === "plain" ? tx("Raster verwijderen") : r.hero ? tx("Hero verwijderen") : tx("Rij verwijderen")} aria-label={r.hero === "plain" ? tx("Raster verwijderen") : r.hero ? tx("Hero verwijderen") : tx("Rij verwijderen")}><IconTrash width={22} height={22} /></button>
              </div>
            </div>
            </div>, document.body
          )}
          {own(r) && (title || h1) && <h1 className="pb-hero-title">{title || h1}</h1>}
          <div className={`pb-row gap-${r.gap}`} style={{ "--cols": r.cols, "--tpl": columns(r) }}>
            {r.cells.map((c) => (
              <div className={`pb-cell${editing ? " edit" : ""}`} key={c.id} style={{ "--ha": AL_H[c.halign], "--jv": AL_V[c.valign], textAlign: c.halign }}
                onDragOver={(e) => { if (drag.current || dragFixed()) e.preventDefault(); }}
                onDrop={(e) => { e.preventDefault(); if (dragFixed() && !drag.current) { dropFixed(c.id, null); return; } if (drag.current) move(drag.current, c.id, null); drag.current = null; setOver(null); setDragOn(null); setDragging(false); }}>
                {editing && (
                  <div className="pb-cellbar" onClick={(e) => e.stopPropagation()}>
                    <span className="pb-seg" title={tx("Horizontaal uitlijnen")}>{[["left", "⇤", "Links"], ["center", "↔", "Midden"], ["right", "⇥", "Rechts"]].map(([k, g, l]) => <button type="button" key={k} className={c.halign === k ? "on" : ""} title={tx(l)} onClick={() => setCell(c.id, { halign: k })}>{g}</button>)}</span>
                    <span className="pb-seg" title={tx("Verticaal uitlijnen")}>{[["top", "⤒", "Boven"], ["center", "↕", "Midden"], ["bottom", "⤓", "Onder"]].map(([k, g, l]) => <button type="button" key={k} className={c.valign === k ? "on" : ""} title={tx(l)} onClick={() => setCell(c.id, { valign: k })}>{g}</button>)}</span>
                    <label className="pb-w" title={tx("Breedte van deze kolom")}>{tx("Kolom")}<select value={c.width || "auto"} onChange={(e) => setCell(c.id, { width: e.target.value })}>{CELL_WIDTHS.map((w) => <option key={w} value={w}>{w === "auto" ? tx("Gelijk") : `${w}%`}</option>)}</select></label>
                    <span className="pb-add">
                      <button type="button" className="btn sm primary" onClick={() => setMenu(menu === c.id ? null : c.id)}>+ {tx("Toevoegen")}</button>
                      {menu === c.id && (
                        <div className="pb-menu">
                          <button type="button" onClick={() => addItem(c.id, "heading")}>{tx("Kop")}</button>
                          <button type="button" onClick={() => addItem(c.id, "text")}>{tx("Tekst")}</button>
                          <button type="button" onClick={() => addItem(c.id, "image")}>{tx("Afbeelding")}</button>
                          <div className="pb-menu-h">{tx("Raster in dit blok")}</div>
                          <span className="pb-menu-cols">{[1, 2, 3, 4].map((n) => <button type="button" key={n} className={r.cols === n ? "on" : ""} onClick={() => { setMenu(null); setRow(r.id, { cols: n }); }} title={n === 1 ? tx("Eén kolom") : `${n} ${tx("kolommen")}`}>{n}</button>)}<small className="muted">{tx("kolommen")}</small></span>
                          {objOn && <button type="button" onClick={() => { setMenu(null); setObjQ(""); setObjPop({ cell: c.id, row: r.id }); }}>{tx("Systeemobjecten")}… <small className="muted">{objects.length}</small></button>}
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
          <button type="button" className="btn sm primary" onClick={addHero}>{tx("Hero")}</button>
          <button type="button" className="btn sm primary plain-btn" onClick={addGrid} title={tx("Een raster met een eigen hoogte, zonder hero")}>{tx("Raster")}</button>
          {saving && <span className="muted">{saving === "saving" ? tx("Opslaan…") : tx("Opgeslagen")}</span>}
        </div>
      )}
    </section>
  );
}
