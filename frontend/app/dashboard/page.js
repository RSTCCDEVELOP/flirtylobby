// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { Busy } from "../../components/PageLoader";
import { tx } from "../../lib/t";
import { confirmDialog } from "../../lib/dialog";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDirectHost } from "../../components/DirectHost";
import { IconChat, IconX } from "../../components/Icons";
import { useAuth } from "../../components/AuthContext";
import { useChat } from "../../components/Chat";
import { useModules } from "../../components/Modules";
import DashboardSearch from "../../components/DashboardSearch";
import DashboardShortcuts from "../../components/DashboardShortcuts";
import DashboardLibrary from "../../components/DashboardLibrary";
import { byId, defaultLayout, themeLayout, WIDGETS } from "../../components/Widgets";
import { api, errorText } from "../../lib/api";

// The user's start page: blocks (charts, content, module items) that he can rearrange, extend and remove.
export default function DashboardHome() {
  const { user } = useAuth();
  const mods = useModules();
  const chat = useChat();
  const router = useRouter();
  const host = useDirectHost();
  const [meta, setMeta] = useState({ theme: "normal", swipe: false });
  const ctx = useMemo(() => ({ user, mods, chat: chat?.cfg, theme: meta.theme, swipe: meta.swipe }), [user, mods, chat?.cfg, meta]);
  const [state, setState] = useState(null); // {widgets, own, has_default, can_set_default}
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState(null);
  const [drag, setDrag] = useState(null);
  const timer = useRef(null);

  useEffect(() => { api("/dashboard/layout/").then((s) => { setState(s); setMeta({ theme: s.theme || "normal", swipe: !!s.swipe }); }).catch((e) => setMsg({ ok: false, text: errorText(e) })); }, []);
  if (!state) return msg ? <div className="alert">{msg.text}</div> : <Busy />;

  const columns = state.columns || 2;
  // every block gets a column: -1 = full width on top, 0..n-1 = column (legacy blocks are spread over the columns)
  const layout = (state.widgets || defaultLayout(ctx, state.theme)).filter((w) => byId[w.id]?.ok(ctx)) // blocks of switched-off modules disappear
    .map((w, i) => ({ id: w.id, col: typeof w.col === "number" ? Math.min(w.col, columns - 1) : w.size === 2 ? -1 : i % columns }));
  const colOf = (c) => layout.filter((w) => w.col === c);
  const save = (widgets, cols = columns) => {
    setState((s) => ({ ...s, widgets, columns: cols, own: true }));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => api("/dashboard/layout/", { method: "PUT", body: { widgets, columns: cols } }).catch((e) => setMsg({ ok: false, text: errorText(e) })), 400);
  };
  const flat = (cols) => [-1, ...Array.from({ length: columns }, (_, c) => c)].flatMap((c) => cols[c] || []);
  const grouped = () => Object.fromEntries([-1, ...Array.from({ length: columns }, (_, c) => c)].map((c) => [c, colOf(c)]));
  // move block `id` to column `col`, before block `before` (or to the end)
  const place = (id, col, before = null) => {
    const g = grouped();
    let item;
    for (const c of Object.keys(g)) { const f = g[c].find((w) => w.id === id); if (f) { item = f; g[c] = g[c].filter((w) => w.id !== id); } }
    if (!item && byId[id]?.ok(ctx)) item = { id, col };  // new block dragged in from the library
    if (!item) return;
    const list = g[col];
    const at = before ? list.findIndex((w) => w.id === before) : -1;
    list.splice(at < 0 ? list.length : at, 0, { ...item, col });
    save(flat(g));
  };
  const nudge = (id, d) => { // up/down inside the column
    const w = layout.find((x) => x.id === id), list = colOf(w.col), i = list.findIndex((x) => x.id === id), j = i + d;
    if (j < 0 || j >= list.length) return;
    place(id, w.col, d < 0 ? list[j].id : list[j + 1]?.id || null);
  };
  const side = (id, d) => { const w = layout.find((x) => x.id === id); place(id, Math.min(columns - 1, Math.max(0, (w.col < 0 ? 0 : w.col) + d))); };
  const setColumns = (n) => save(layout.map((w) => ({ ...w, col: w.col < 0 ? -1 : Math.min(w.col, n - 1) })), n);
  const remove = (id) => save(layout.filter((w) => w.id !== id));
  const add = (w) => save([...layout, { id: w.id, col: w.size === 2 ? -1 : [...Array(columns).keys()].sort((a, b) => colOf(a).length - colOf(b).length)[0] }]);
  const reset = async () => { if ((await confirmDialog(tx("Je dashboard terugzetten naar de standaardindeling?")))) setState(await api("/dashboard/layout/", { method: "DELETE" })); };
  const setDefault = async () => { if ((await confirmDialog(tx("Deze indeling als standaard instellen voor iedereen die nog geen eigen indeling heeft?")))) { await api("/dashboard/layout/default/", { method: "PUT", body: { widgets: layout, columns } }); setMsg({ ok: true, text: tx("Standaardindeling opgeslagen.") }); } };

  const applyLayout = (kind) => save(themeLayout(ctx, state.theme, kind).map((w, i) => ({ id: w.id, col: w.size === 2 ? -1 : i % columns })));

  // one direct connection at a time: while someone is connected a small tile shows up (under Swipen / the second column), also when the block is not on this dashboard
  const showTile = chat?.directActive?.length > 0 && !layout.some((l) => l.id === "direct");
  const tileCol = columns > 1 ? 1 : 0;
  const live = chat?.directActive?.[0];
  // "Chat" on the tile: the popup opens right here (or the direct page when that is the chosen view)
  const openLive = async () => {
    let page = false; try { page = localStorage.getItem("directView") === "page"; } catch {}
    if (page) return router.push(`/dashboard/community/direct?room=${live.token}`);
    try { host.open({ token: live.token, mode: "popup", info: await api(`/direct/${live.token}/`) }); host.setMini(false); } catch {}
  };
  const directTile = showTile && live && (
    <div className="dash-live-tile">
      <span className="dlt-av"><span>{(live.name || "?")[0].toUpperCase()}</span><i className="dlt-dot" aria-hidden="true" /></span>
      <span className="dlt-txt"><strong>{live.name}</strong><small>{tx("Rechtstreeks verbonden")}</small></span>
      <span className="dlt-actions">
        <button type="button" className="btn sm primary" onClick={openLive}><IconChat /> {tx("Chat")}</button>
        <button type="button" className="btn sm" title={tx("Verbreek verbinding")} aria-label={tx("Verbreek verbinding")}
          onClick={async () => { if (await confirmDialog(tx("De verbinding met {0} verbreken?", live.name), { title: tx("Verbinding verbreken"), okLabel: tx("Verbreken"), danger: true })) await api(`/direct/rooms/${live.token}/disconnect/`, { method: "POST" }).catch(() => {}); }}><IconX /></button>
      </span>
    </div>
  );
  const renderCol = (c) => {
    if (c === -1 && !colOf(-1).length && !editing) return null;
    return (
          <div key={c} className={c === -1 ? "dash-full" : "dash-col"} data-col={c} style={c === -1 ? undefined : { gridColumn: c + 1 }}
            onDragOver={(e) => editing && e.preventDefault()}
            onDrop={(e) => { if (!editing) return; e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (id) place(id, c); }}>
            {editing && c === -1 && !colOf(-1).length && <div className="dash-drop muted">{tx("Volle breedte: sleep een blok hierheen")}</div>}
            {editing && c >= 0 && !colOf(c).length && <div className="dash-drop muted">{tx("Sleep een blok hierheen")}</div>}
            {colOf(c).map((l) => {
              const w = byId[l.id], C = w.C;
              return (
                <section key={l.id} className={`card dash-widget ${editing ? "editing" : ""} ${drag === l.id ? "dragging" : ""}`}
                  draggable={editing} onDragStart={(e) => { e.dataTransfer.setData("text/plain", l.id); setDrag(l.id); }} onDragEnd={() => setDrag(null)}
                  onDragOver={(e) => editing && e.preventDefault()}
                  onDrop={(e) => { if (!editing) return; e.preventDefault(); e.stopPropagation(); const id = e.dataTransfer.getData("text/plain"); if (id && id !== l.id) place(id, c, l.id); }}>
                  {l.id !== "welcome" && <div className="widget-head"><h2>{tx(w.title)}</h2></div>}
                  {editing && (
                    <div className="widget-controls">
                      <span className="drag-handle" title={tx("Sleep om te verplaatsen")}>⠿</span>
                      <button className="btn sm" onClick={() => nudge(l.id, -1)} title={tx("Omhoog")}>↑</button>
                      <button className="btn sm" onClick={() => nudge(l.id, 1)} title={tx("Omlaag")}>↓</button>
                      {columns > 1 && <button className="btn sm" disabled={c === 0} onClick={() => side(l.id, -1)} title={tx("Kolom links")}>←</button>}
                      {columns > 1 && <button className="btn sm" disabled={c === columns - 1} onClick={() => side(l.id, 1)} title={tx("Kolom rechts")}>→</button>}
                      {columns > 1 && <button className="btn sm" onClick={() => place(l.id, c === -1 ? 0 : -1)}>{c === -1 ? tx("In kolom") : tx("Volle breedte")}</button>}
                      <button className="btn sm danger" onClick={() => remove(l.id)}>{tx("Weg")}</button>
                    </div>
                  )}
                  <C ctx={ctx} />
                </section>
              );
            })}
            {c === tileCol && !editing && directTile}
          </div>
    );
  };

  return (
    <>
      <div className="page-head">
        <div style={{ flex: "0 0 auto" }}><h1 style={{ margin: 0 }}>{tx("Dashboard")}</h1></div>
        <DashboardSearch />
        <div className="row">
          {editing && <button className="btn" onClick={reset}>{tx("Standaard herstellen")}</button>}
          {editing && state.can_set_default && <button className="btn" onClick={setDefault}>{tx("Opslaan als standaard voor iedereen")}</button>}
          <button className={`btn ${editing ? "primary" : ""}`} onClick={() => setEditing(!editing)}>{editing ? tx("Klaar") : tx("Dashboard aanpassen")}</button>
        </div>
      </div>
      <DashboardShortcuts />
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}

      {editing && <DashboardLibrary theme={state.theme} ctx={ctx} onDashIds={layout.map((l) => l.id)} onAdd={add} onLayout={applyLayout} />}

      {editing && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <div className="row" style={{ justifyContent: "flex-start", flexWrap: "nowrap" }}>
            <strong>{tx("Kolommen")}</strong>
            {[1, 2, 3, 4].map((n) => <button key={n} className={`btn sm ${columns === n ? "primary" : ""}`} onClick={() => setColumns(n)}>{n}</button>)}
            <small className="muted">{tx("Sleep blokken naar een andere plek of kolom, of gebruik de pijltjes.")}</small>
          </div>
        </div>
      )}
      {renderCol(-1)}
      <div className="dash-cols" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }, (_, c) => renderCol(c))}
      </div>
      {!layout.length && <p className="muted">{tx("Je dashboard is leeg. Kies \"Dashboard aanpassen\" en voeg blokken toe.")}</p>}
    </>
  );
}
