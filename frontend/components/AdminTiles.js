"use client";

import { tx } from "../lib/t";
import Link from "next/link";
import { TILES, LEVEL_LABEL } from "../lib/admin-tiles";
import { lvl } from "../lib/perms";
import { useAuth } from "./AuthContext";
import { useModules } from "./Modules";

// Only modules that are switched on are shown (switch them on/off at Super admin -> Modules).
// `all`: every active tile (super admin). Otherwise only the modules this user has access to.
export default function AdminTiles({ all = false }) {
  const { user } = useAuth();
  const mods = useModules();
  const tiles = TILES.map((t) => {
    const on = t.modules.some((m) => mods[m] !== false);
    const level = Math.max(...t.modules.map((m) => (mods[m] === false ? 0 : lvl(user, m))));
    return { ...t, on, level };
  }).filter((t) => t.on && (all || t.level >= 1));

  return (
    <div className="cards" style={{ marginTop: 0 }}>
      {tiles.map((t) => (
        <Link key={t.href} href={t.href} className="card stat link-card">
          <span>{t.title}</span>
          <strong style={{ fontSize: "1.25rem" }}>{t.big}</strong>
          <small>{t.small}</small>
          <span className="tile-level">{all ? tx("Aan") : LEVEL_LABEL[t.level]}</span>
        </Link>
      ))}
      {!tiles.length && <p className="muted">{tx("Je hebt nog geen toegang tot beheeronderdelen.")}</p>}
    </div>
  );
}
