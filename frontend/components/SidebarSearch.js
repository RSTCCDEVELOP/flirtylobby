// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { TILES } from "../lib/admin-tiles";
import { canOpen } from "../lib/perms";
import { tx } from "../lib/t";
import { useAuth } from "./AuthContext";
import { IconGrid, IconSearch } from "./Icons";
import { useModules } from "./Modules";

// Search at the bottom of the left menu (above Administration): looks only through the items of the admin menu (the tiles of Admin) and goes to the tile.
const norm = (s) => String(s || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const KIND = { tile: "Tegel" };

export default function SidebarSearch({ onNavigate }) {
  const { user } = useAuth();
  const mods = useModules();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState(0);
  const box = useRef(null);

  useEffect(() => {
    const away = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  const allowed = (href) => (href.startsWith("/dashboard/superadmin") ? !!user?.is_staff : href.startsWith("/dashboard/admin") ? canOpen(user, href, mods) : true);
  const results = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const has = (hay) => words.every((w) => hay.includes(w));
    const out = [];
    TILES.forEach((t) => { if (t.href.startsWith("/dashboard/admin") && allowed(t.href) && has(norm(`${tx(t.title)} ${t.title} ${tx(t.big)} ${t.big} ${tx(t.small)} ${t.small} ${t.find || ""} ${t.modules.join(" ")} module`))) out.push({ kind: "tile", label: tx(t.title), sub: tx(t.big), href: t.href, key: t.href }); });
    return out.slice(0, 14);
  }, [q, user, mods]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setCur(0), [q]);

  const go = (r) => {
    setOpen(false); setQ("");
    if (r.find) { try { sessionStorage.setItem("findtext", r.find); } catch {} setTimeout(() => window.dispatchEvent(new Event("findonpage")), 300); }
    router.push(r.href);
    onNavigate?.();
  };
  const key = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCur((c) => Math.min(results.length - 1, c + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCur((c) => Math.max(0, c - 1)); }
    else if (e.key === "Enter" && results[cur]) { e.preventDefault(); go(results[cur]); }
    else if (e.key === "Escape") setOpen(false);
  };
  const Icon = { tile: IconGrid };
  return (
    <div className="side-search" ref={box}>
      {open && q.trim() && (
        <ul className="side-search-list" role="listbox">
          {!results.length && <li className="muted">{tx("Niets gevonden.")}</li>}
          {results.map((r, i) => {
            const I = Icon[r.kind];
            return (
              <li key={r.key} role="option" aria-selected={i === cur}>
                <button type="button" className={i === cur ? "on" : ""} onMouseEnter={() => setCur(i)} onClick={() => go(r)}>
                  <span className="ss-ico"><I /></span>
                  <span className="ss-txt"><strong>{r.label}</strong><small>{tx(KIND[r.kind])}{r.sub ? ` · ${r.sub}` : ""}</small></span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <label className="side-search-box">
        <IconSearch />
        <input type="text" value={q} placeholder={tx("Zoek in het admin-menu…")} aria-label={tx("Zoek in het admin-menu")} autoComplete="off" onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onKeyDown={key} />
      </label>
    </div>
  );
}
