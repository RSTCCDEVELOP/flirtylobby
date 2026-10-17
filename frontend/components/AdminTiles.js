"use client";

import { tx } from "../lib/t";
import Link from "next/link";
import { TILES, LEVEL_LABEL } from "../lib/admin-tiles";
import { lvl } from "../lib/perms";
import { useAuth } from "./AuthContext";
import { useModules } from "./Modules";
import ViewBar from "./ViewBar";
import { useView } from "../lib/useView";

// Only modules that are switched on are shown (switch them on/off at Super admin -> Modules).
// `all`: every active tile (super admin). Otherwise only the modules this user has access to.
export default function AdminTiles({ all = false }) {
  const { user } = useAuth();
  const mods = useModules();
  const view = useView(all ? "admin-tiles-all" : "admin-tiles");
  const tiles = TILES.map((t) => {
    const on = t.modules.some((m) => mods[m] !== false);
    const level = Math.max(...t.modules.map((m) => (mods[m] === false ? 0 : lvl(user, m))));
    return { ...t, on, level };
  }).filter((t) => t.on && (all || t.level >= 1));
  const shown = tiles.filter((t) => view.match(tx(t.title), tx(t.big), tx(t.small)));

  return (
    <>
    <ViewBar view={view} count={`${shown.length}/${tiles.length}`} />
    <div className={`cards${view.cls}`} style={{ marginTop: 0 }}>
      {shown.map((t) => (
        <Link key={t.href} href={t.href} className="card stat link-card">
          <span>{t.title}</span>
          <strong style={{ fontSize: "1.25rem" }}>{t.big}</strong>
          <small>{t.small}</small>
          <span className="tile-level">{all ? tx("Aan") : LEVEL_LABEL[t.level]}</span>
        </Link>
      ))}
      {!tiles.length && <p className="muted">{tx("Je hebt nog geen toegang tot beheeronderdelen.")}</p>}
      {tiles.length > 0 && !shown.length && <p className="muted">{tx("Niets gevonden.")}</p>}
    </div>
    </>
  );
}
