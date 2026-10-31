// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useImported, IMPORTED_HREF } from "../lib/imported";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { TILES } from "../lib/admin-tiles";
import { pageAllowed, ADMIN_PAGES } from "../lib/perms";
import { tx } from "../lib/t";
import { useAuth } from "./AuthContext";
import { ADMIN_GROUP_OF, ADMIN_GROUPS, ADMIN_NAV, ADMIN_SECTION_GROUP, COMMUNITY, COMMUNITY_GROUP_OF, COMMUNITY_GROUPS } from "./DashboardShell";
import { IconGrid } from "./Icons";
import { useChat } from "./Chat";
import { useModules } from "./Modules";
import { refreshMs } from "../lib/refresh";

// The page of one menu group as tiles (the other way to work than the menu on the left): Admin -> Gebruikers, Website, … or the groups of the member menu.
export default function GroupTiles({ id }) {
  const { user } = useAuth();
  const mods = useModules();
  const admin = id.startsWith("a-");
  const group = (admin ? ADMIN_GROUPS : COMMUNITY_GROUPS).find((g) => g.id === id);
  const [plugins, setPlugins] = useState([]);
  const [summary, setSummary] = useState(null); // the numbers that the left menu shows (new messages, requests ...): the tiles show them too
  const chat = useChat();
  const communityOn = ["profiles", "discover", "messages", "chat"].some((m) => mods[m] !== false);  // no calls for the community while its modules are off
  useEffect(() => {
    if (admin || !communityOn) return undefined;
    const load = () => api("/community/summary/").then(setSummary).catch(() => {});
    load();
    const t = setInterval(load, refreshMs(20000));
    return () => clearInterval(t);
  }, [admin, communityOn]);
  const countOf = (n) => (n.badge === "direct_active" ? chat?.directActive?.length || 0 : n.badge && summary ? (n.badge === "discover_new" ? summary.discover?.likes_new || 0 : summary[n.badge]) || 0 : 0);
  useEffect(() => {
    if (mods.plugins === false) return;
    api(admin ? "/plugins/menu/?scope=admin" : "/plugins/menu/").then(setPlugins).catch(() => setPlugins([]));
  }, [admin, mods.plugins]);
  const imported = useImported(mods.siteimport !== false);
  if (!group) return <p className="muted">{tx("Deze groep bestaat niet.")}</p>;

  let items;
  if (admin) {
    const own = ADMIN_NAV.filter((n) => ADMIN_GROUP_OF[n.href] === id && (() => { const pg = ADMIN_PAGES.find((p) => p.href === n.href); return !pg || pageAllowed(user, pg, mods); })());
    const fromPlugins = plugins.filter((x) => x.has_admin && (ADMIN_SECTION_GROUP[x.section] || "a-system") === id).flatMap((x) => [{ href: `/dashboard/admin/plugin/${x.name}`, label: x.label, icon: <IconGrid />, plugin: true },
      ...(x.entries || []).map((e) => ({ href: e.href || `/dashboard/admin/plugin/${x.name}?tab=${e.tab}`, label: e.label, icon: <IconGrid />, plugin: true }))]);
    items = [...own, ...fromPlugins].map((n) => (imported && n.href === IMPORTED_HREF ? { ...n, label: "Geïmporteerd" } : n));
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
              {countOf(n) > 0 && <span className="cart-count group-tile-count" title={tx("Nieuw")}>{countOf(n)}</span>}
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
