"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { TILES } from "../lib/admin-tiles";
import { pageAllowed, ADMIN_PAGES } from "../lib/perms";
import { tx } from "../lib/t";
import { useAuth } from "./AuthContext";
import { ADMIN_GROUP_OF, ADMIN_GROUPS, ADMIN_NAV, ADMIN_SECTION_GROUP, COMMUNITY, COMMUNITY_GROUP_OF, COMMUNITY_GROUPS } from "./DashboardShell";
import { IconGrid } from "./Icons";
import { useModules } from "./Modules";

// The page of one menu group as tiles (the other way to work than the menu on the left): Admin -> Gebruikers, Website, … or the groups of the member menu.
export default function GroupTiles({ id }) {
  const { user } = useAuth();
  const mods = useModules();
  const admin = id.startsWith("a-");
  const group = (admin ? ADMIN_GROUPS : COMMUNITY_GROUPS).find((g) => g.id === id);
  const [plugins, setPlugins] = useState([]);
  useEffect(() => {
    if (mods.plugins === false) return;
    api(admin ? "/plugins/menu/?scope=admin" : "/plugins/menu/").then(setPlugins).catch(() => setPlugins([]));
  }, [admin, mods.plugins]);
  if (!group) return <p className="muted">{tx("Deze groep bestaat niet.")}</p>;

  let items;
  if (admin) {
    const own = ADMIN_NAV.filter((n) => ADMIN_GROUP_OF[n.href] === id && (() => { const pg = ADMIN_PAGES.find((p) => p.href === n.href); return !pg || pageAllowed(user, pg, mods); })());
    const fromPlugins = plugins.filter((x) => (ADMIN_SECTION_GROUP[x.section] || "a-system") === id).map((x) => ({ href: `/dashboard/admin/plugins/${x.name}`, label: x.label, icon: <IconGrid />, plugin: true }));
    items = [...own, ...fromPlugins];
  } else {
    const own = COMMUNITY.filter((n) => COMMUNITY_GROUP_OF[n.href] === id && (n.module === "any" ? ["profiles", "discover", "messages", "chat"].some((m) => mods[m] !== false) : mods[n.module] !== false));
    const fromPlugins = plugins.filter((x) => (x.group === "mine" ? "c-mine" : x.group === "contact" ? "c-contact" : "") === id).map((x) => ({ href: x.path ? `/dashboard/${x.path}` : `/dashboard/plugins/${x.name}`, label: x.label, icon: <IconGrid />, plugin: true }));
    items = [...own, ...fromPlugins];
  }
  return (
    <>
      <h1>{tx(group.title)}</h1>
      <p className="muted">{tx("Kies een onderdeel. Liever het menu links? Wissel bovenin het menu.")}</p>
      <div className="cards" style={{ marginTop: 0 }}>
        {items.map((n) => {
          const t = TILES.find((x) => x.href === n.href);
          return (
            <Link key={n.href} href={n.href} className="card stat link-card group-tile">
              <span className="group-tile-ico">{n.icon}</span>
              <strong style={{ fontSize: "1.1rem" }}>{tx(n.label)}</strong>
              {t && <small>{tx(t.big)}</small>}
            </Link>
          );
        })}
        {!items.length && <p className="muted">{tx("Hier staat nog niets in.")}</p>}
      </div>
    </>
  );
}
