// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../lib/t";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, errorText } from "../lib/api";
import { confirmDialog } from "../lib/dialog";
import { TILES, LEVEL_LABEL } from "../lib/admin-tiles";
import { lvl } from "../lib/perms";
import { useAuth } from "./AuthContext";
import { useModules } from "./Modules";
import Paged from "./Paged";
import ViewBar from "./ViewBar";
import { useView } from "../lib/useView";

// Only modules that are switched on are shown (switch them on/off at Super admin -> Modules).
// `all`: every active tile (super admin). Otherwise only the modules this user has access to.
export default function AdminTiles({ all = false }) {
  const { user } = useAuth();
  const mods = useModules();
  const view = useView(all ? "admin-tiles-all" : "admin-tiles");
  const router = useRouter();
  const [state, setState] = useState(null); // super admin: {module key: {enabled, core, label}} for the on/off switch of every tile
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const loadState = useCallback(() => (all ? api("/modules/all/").then((l) => setState(Object.fromEntries(l.map((m) => [m.key, m])))).catch(() => {}) : null), [all]);
  useEffect(() => { loadState(); }, [loadState]);
  const tiles = TILES.map((t) => {
    const on = all && state ? t.modules.every((m) => state[m]?.enabled !== false) : t.modules.some((m) => mods[m] !== false);
    const level = Math.max(...t.modules.map((m) => (mods[m] === false ? 0 : lvl(user, m))));
    const locked = t.modules.every((m) => state?.[m]?.core);
    return { ...t, on, level, locked };
  }).filter((t) => (all ? true : t.on && t.level >= 1));
  const flip = async (t) => {
    const next = !t.on, keys = t.modules.filter((m) => !state?.[m]?.core);
    if (!next && !(await confirmDialog(tx("\"{0}\" uitzetten? De functie is dan overal inactief.", t.title)))) return;
    setBusy(t.href); setMsg("");
    try { for (const k of keys) await api(`/modules/${k}/`, { method: "PATCH", body: { enabled: next } }); await loadState(); router.refresh(); } // menus and the website read the module state from the server layout
    catch (e) { setMsg(errorText(e)); }
    setBusy("");
  };
  const shown = tiles.filter((t) => view.match(tx(t.title), tx(t.big), tx(t.small)));

  return (
    <>
    {msg && <div className="alert">{msg}</div>}
    <ViewBar view={view} count={`${shown.length}/${tiles.length}`} />
    <Paged id={all ? "admin-tiles-all" : "admin-tiles"} query={view.q}>
    <div className={`cards${view.cls}`} style={{ marginTop: 0 }}>
      {shown.map((t) => (
        <div key={t.href} className={`card stat link-card tile-wrap ${all && !t.on ? "tile-off" : ""}`}>
          <Link href={t.href} className="tile-link">
            <span>{t.title}</span>
            <strong style={{ fontSize: "1.25rem" }}>{t.big}</strong>
            <small>{t.small}</small>
          </Link>
          {all ? (
            <label className="switch tile-switch" title={t.locked ? tx("Kernonderdeel: altijd aan") : t.on ? tx("Uitzetten") : tx("Aanzetten")}>
              <input type="checkbox" checked={t.on} disabled={t.locked || busy === t.href || !state} onChange={() => flip(t)} /><span />
            </label>
          ) : <span className="tile-level">{LEVEL_LABEL[t.level]}</span>}
        </div>
      ))}
      {!tiles.length && <p className="muted">{tx("Je hebt nog geen toegang tot beheeronderdelen.")}</p>}
      {tiles.length > 0 && !shown.length && <p className="muted">{tx("Niets gevonden.")}</p>}
    </div>
    </Paged>
    </>
  );
}
