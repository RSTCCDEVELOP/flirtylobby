"use client";

import { tx } from "../lib/t";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorText } from "../lib/api";
import { alertDialog } from "../lib/dialog";
import { EditableImage, EditableText } from "./EditMode";
import { useModule } from "./Modules";
import { useSession } from "./Session";
import { SysObjectBySlug } from "./SysObjects";

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
export default function PageBlocks({ pageKey }) {
  const { editing } = useSession();
  const objOn = useModule("sysobjects");
  const [layout, setLayout] = useState(null);
  const [menu, setMenu] = useState(null); // cell id with the add-menu open
  const [objects, setObjects] = useState([]);
  const [saving, setSaving] = useState("");
  const drag = useRef(null);
  const timer = useRef(null);

  useEffect(() => { api(`/pages/layout/${encodeURIComponent(pageKey)}/`).then(setLayout).catch(() => setLayout({ rows: [] })); }, [pageKey]);
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
    if (!editing) return <div className="pb-item" key={it.id} style={{ textAlign: c.halign }}>{body}</div>;
    return (
      <div className="pb-item edit" key={it.id} style={{ textAlign: c.halign }} draggable
        onDragStart={(e) => { drag.current = it.id; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", it.id); }}
        onDragEnd={() => { drag.current = null; }}
        onDragOver={(e) => { if (drag.current) { e.preventDefault(); e.stopPropagation(); } }}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (drag.current && drag.current !== it.id) move(drag.current, c.id, it.id); drag.current = null; }}>
        <span className="pb-grip" title={tx("Sleep om te verplaatsen")}>⋮⋮</span>
        <button type="button" className="pb-x" title={tx("Verwijderen")} onClick={() => delItem(it.id)}>×</button>
        {body}
        {it.type === "object" && !objects.some((o) => o.slug === it.ref) && <small className="muted">{tx("Dit systeemobject bestaat niet meer of staat uit.")}</small>}
      </div>
    );
  };

  return (
    <section className={`pb${editing ? " editing" : ""}`}>
      {layout.rows.map((r, ri) => (
        <div className="pb-rowwrap" key={r.id} style={r.width && r.width !== "default" ? { width: `${r.width}%`, maxWidth: "none" } : undefined}>
          {editing && (
            <div className="pb-rowbar">
              <strong>{tx("Raster")}</strong>
              <label>{tx("Kolommen")}<select value={r.cols} onChange={(e) => setRow(r.id, { cols: Number(e.target.value) })}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
              <label>{tx("Breedte")}<select value={r.width || "default"} onChange={(e) => setRow(r.id, { width: e.target.value })}>{ROW_WIDTHS.map((w) => <option key={w} value={w}>{w === "default" ? tx("Standaard") : w === "100" ? tx("100% (paginabreed)") : `${w}%`}</option>)}</select></label>
              <label>{tx("Ruimte")}<select value={r.gap} onChange={(e) => setRow(r.id, { gap: e.target.value })}><option value="sm">{tx("Klein")}</option><option value="md">{tx("Normaal")}</option><option value="lg">{tx("Groot")}</option></select></label>
              <span className="pb-spacer" />
              <button type="button" className="btn sm" disabled={ri === 0} onClick={() => moveRow(r.id, -1)} title={tx("Omhoog")}>↑</button>
              <button type="button" className="btn sm" disabled={ri === layout.rows.length - 1} onClick={() => moveRow(r.id, 1)} title={tx("Omlaag")}>↓</button>
              <button type="button" className="btn sm danger" onClick={() => delRow(r.id)}>{tx("Rij verwijderen")}</button>
            </div>
          )}
          <div className={`pb-row gap-${r.gap}`} style={{ "--cols": r.cols, "--tpl": columns(r) }}>
            {r.cells.map((c) => (
              <div className={`pb-cell${editing ? " edit" : ""}`} key={c.id} style={{ "--ha": AL_H[c.halign], "--jv": AL_V[c.valign], textAlign: c.halign }}
                onDragOver={(e) => { if (drag.current) e.preventDefault(); }}
                onDrop={(e) => { e.preventDefault(); if (drag.current) move(drag.current, c.id, null); drag.current = null; }}>
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
                          {objOn && objects.map((o) => <button type="button" key={o.slug} onClick={() => addItem(c.id, "object", o.slug)}>{o.names?.[Object.keys(o.names || {})[0]] || o.data?.name || o.slug} <small className="muted">{o.kind === "donation" ? tx("Donatie") : tx("Abonnement")}</small></button>)}
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
