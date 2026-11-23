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
import { useEntity } from "../lib/entity";
import { pageAllowed, ADMIN_PAGES } from "../lib/perms";
import { tx } from "../lib/t";
import { useAuth } from "./AuthContext";
import { ADMIN_GROUP_OF, ADMIN_GROUPS, ADMIN_NAV, ADMIN_SECTION_GROUP, COMMUNITY, COMMUNITY_GROUP_OF, COMMUNITY_GROUPS } from "./DashboardShell";
import { IconGrid } from "./Icons";
import { useChat } from "./Chat";
import { useModules } from "./Modules";
import TileSearch from "./TileSearch";
import { EditableText } from "./EditMode";
import { useRouter } from "next/navigation";
import { gateClick } from "../lib/pluginGate";

import { useUpdates } from "../lib/updates";

// Tiles that show in a second group as well (the page stays in its own group in the menu): the theme is also a part of the website.
const ALSO_IN = { "/dashboard/admin/theme": ["a-site"] };

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
  useUpdates("community-summary", () => api("/community/summary/"), 20000, setSummary, !admin && communityOn);
  const countOf = (n) => (n.badge === "direct_active" ? chat?.directActive?.length || 0 : n.badge && summary ? (n.badge === "discover_new" ? summary.discover?.likes_new || 0 : summary[n.badge]) || 0 : 0);
  useEffect(() => {
    if (mods.plugins === false) return;
    api(admin ? "/plugins/menu/?scope=admin" : "/plugins/menu/").then(setPlugins).catch(() => setPlugins([]));
  }, [admin, mods.plugins]);
  const imported = useImported(mods.siteimport !== false);
  const router = useRouter();
  const entity = useEntity(); // the tile of the Entiteit carries the name set in the standard installation
  if (!group) return <p className="muted">{tx("Deze groep bestaat niet.")}</p>;

  let items;
  if (admin) {
    const own = ADMIN_NAV.filter((n) => (ADMIN_GROUP_OF[n.href] === id || (ALSO_IN[n.href] || []).includes(id)) && (() => { const pg = ADMIN_PAGES.find((p) => p.href === n.href); return !pg || pageAllowed(user, pg, mods); })());
    const fromPlugins = plugins.filter((x) => x.has_admin && (ADMIN_SECTION_GROUP[x.section] || "a-system") === id).flatMap((x) => [{ href: `/dashboard/admin/plugin/${x.name}`, label: x.label, icon: <IconGrid />, plugin: true },
      ...(x.entries || []).map((e) => ({ href: e.href || `/dashboard/admin/plugin/${x.name}?tab=${e.tab}`, label: e.label, icon: <IconGrid />, plugin: true }))]);
    items = [...own, ...fromPlugins].map((n) => (imported && n.href === IMPORTED_HREF ? { ...n, label: "Webdesign" } : n.href === "/dashboard/admin/entity" && entity?.label ? { ...n, label: entity.label, big: tx("Over je {0}", tx(entity.label).toLowerCase()) } : n));
  } else {
    const own = COMMUNITY.filter((n) => COMMUNITY_GROUP_OF[n.href] === id && (n.module === "any" ? ["profiles", "discover", "messages", "chat"].some((m) => mods[m] !== false) : mods[n.module] !== false));
    const fromPlugins = plugins.filter((x) => x.tile !== false && (x.group === "mine" ? "c-mine" : x.group === "contact" ? "c-contact" : "") === id).map((x) => ({ href: x.path ? `/dashboard/${x.path}` : `/dashboard/plugins/${x.name}`, label: x.label, icon: <IconGrid />, plugin: true }));
    items = [...own, ...fromPlugins];
  }
  if (admin && id === "a-site" && !items.some((n) => n.href === IMPORTED_HREF)) items = [{ href: IMPORTED_HREF, label: imported ? "Webdesign" : "Website ontwerpen", icon: <IconGrid />, big: "Ontwerpen of een andere site inlezen" }, ...items];  // always there: a click asks to install and switch it on when it is not
  return (
    <>
      <EditableText id={`page.group.${id}.title`} as="h1" fallback={tx(group.title)} removable={false} />
      <EditableText id={`page.group.${id}.intro`} as="p" className="muted" fallback={tx("Kies een onderdeel. Liever het menu links? Wissel bovenin het menu.")} removable={false} />
      <TileSearch />
      <div className="cards" style={{ marginTop: 0 }}>
        {items.map((n) => {
          const t = TILES.find((x) => x.href === n.href);
          return (
            <Link key={n.href} href={n.href} className="card stat link-card group-tile" onClick={(e) => gateClick(e, n.href, router)}>
              <span className="group-tile-ico">{n.icon}</span>
              {countOf(n) > 0 && <span className="cart-count group-tile-count" title={tx("Nieuw")}>{countOf(n)}</span>}
              <strong style={{ fontSize: "1.1rem" }}>{tx(n.label)}</strong>
              {(n.big || t) && <small>{n.big || tx(t.big)}</small>}
            </Link>
          );
        })}
        {!items.length && <p className="muted">{tx("Hier staat nog niets in.")}</p>}
      </div>
    </>
  );
}
