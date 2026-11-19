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
import { alertDialog, confirmDialog } from "../lib/dialog";
import { TILES, LEVEL_LABEL } from "../lib/admin-tiles";
import { lvl, setupHidden } from "../lib/perms";
import { useEntity } from "../lib/entity";
import { useAuth } from "./AuthContext";
import { useModules } from "./Modules";
import Paged from "./Paged";
import PlusLock from "./PlusLock";
import SuperTile from "./SuperTile";
import { IconArchive, IconBell, IconBolt, IconBriefcase, IconTag, IconCard, IconChart, IconChat, IconEdit, IconFlask, IconFolder, IconGlobe, IconGlobe2, IconGrid, IconGroup, IconHeart, IconHelp, IconImage, IconInfo, IconKey, IconLeaf, IconLock, IconMail, IconPalette, IconPaperclip, IconReceipt, IconRocket, IconSearch, IconSettings, IconShield, IconStar, IconUsers } from "./Icons";
import ViewBar from "./ViewBar";
import { useView } from "../lib/useView";

// The icon of every tile (by the last part of its address), like the tiles of Super admin
const ICONS = { entity: IconBriefcase, tags: IconTag, users: IconUsers, ai: IconStar, "ai-kosten": IconChart, groups: IconGroup, roles: IconShield, languages: IconGlobe2, communication: IconMail, integrations: IconKey, notifications: IconBell, faq: IconHelp, templates: IconArchive,
  components: IconGrid, helptips: IconInfo, media: IconImage, community: IconChat, seo: IconSearch, security: IconLock, subscriptions: IconReceipt, actions: IconRocket, donations: IconHeart, system: IconSettings, storage: IconFolder,
  license: IconCard, statistieken: IconChart, energy: IconLeaf, backups: IconArchive, installaties: IconRocket, sandbox: IconFlask, pages: IconGlobe, sysobjects: IconPaperclip, siteimport: IconEdit, theme: IconPalette };
const iconOf = (href) => ICONS[href.split("/").pop()] || IconBolt;

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
  useEffect(() => { const f = () => loadState(); window.addEventListener("licence-reverted", f); return () => window.removeEventListener("licence-reverted", f); }, [loadState]);  // "Nu niet" in the licence question undid a switch
  const ent = useEntity(); // the title of the tile follows the standard installation: Bedrijf, Organisatie, Vereniging, Club or a free name
  const tiles = TILES.map((t0) => {
    const t = t0.href.endsWith("/entity") && ent ? { ...t0, title: ent.label, big: tx("Over je {0}", tx(ent.label).toLowerCase()), open: ent.filled ? "" : tx("{0} instellen", tx(ent.label)) } : t0;
    const on = all && state ? t.modules.every((m) => state[m]?.enabled !== false) : t.modules.some((m) => mods[m] !== false);
    const level = Math.max(...t.modules.map((m) => (mods[m] === false ? 0 : lvl(user, m))));
    const locked = t.modules.every((m) => state?.[m]?.core);
    return { ...t, on, level, locked };
  }).filter((t) => (all ? true : t.on && t.level >= 1 && !setupHidden(t.href, mods)));
  const isLocked = (t) => all && !user?.is_superadmin_plus && t.modules.some((m) => state?.[m]?.owner_only);  // an easy2edit module is shown with a lock; a click gives a message
  const deny = () => alertDialog(tx("Dit onderdeel is alleen voor een superadmin+."));
  const flip = async (t) => {
    if (isLocked(t)) return deny();
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
        <div key={t.href} className={all && !t.on ? "tile-off" : ""} style={{ display: "flex" }}>
          <div style={{ flex: 1, display: "flex", minWidth: 0 }} className="st-wrap">
            <SuperTile href={t.href} icon={iconOf(t.href)} label={tx(t.title)} title={tx(t.big)} text={tx(t.small)} lock={all && t.modules.some((m) => state?.[m]?.owner_only)}
              onClick={(e) => { if (isLocked(t)) { e.preventDefault(); deny(); } }}
              footer={(
                <>
                  <Link href={t.href} className="btn sm primary" onClick={(e) => { if (isLocked(t)) { e.preventDefault(); deny(); } }}>{t.open || tx("Open")}</Link>
                  {all ? (
                    <label className="switch tile-switch" style={{ position: "static", marginLeft: "auto" }} title={t.locked ? tx("Kernonderdeel: altijd aan") : t.on ? tx("Uitzetten") : tx("Aanzetten")}>
                      <input type="checkbox" checked={t.on} disabled={(t.locked || busy === t.href || !state) && !isLocked(t)} onChange={() => flip(t)} /><span />
                    </label>
                  ) : <span style={{ marginLeft: "auto", padding: ".15rem .6rem", border: "1px solid var(--line)", borderRadius: 999, fontSize: ".72rem", fontWeight: 600, color: "var(--muted)", whiteSpace: "nowrap" }}>{tx(LEVEL_LABEL[t.level])}</span>}
                </>
              )} />
          </div>
        </div>
      ))}
      {!tiles.length && <p className="muted">{tx("Je hebt nog geen toegang tot beheeronderdelen.")}</p>}
      {tiles.length > 0 && !shown.length && <p className="muted">{tx("Niets gevonden.")}</p>}
    </div>
    </Paged>
    </>
  );
}
