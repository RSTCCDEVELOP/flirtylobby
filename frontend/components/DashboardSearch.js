"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { canOpen } from "../lib/perms";
import { useShortcuts } from "../lib/shortcuts";
import { tx } from "../lib/t";
import { useAuth } from "./AuthContext";
import { IconSearch, IconStar } from "./Icons";
import { useModules } from "./Modules";

// Dashboard search: one box that looks through every setting, page and option of the dashboard, in every language
// (public/search-index.json: the Dutch texts plus their translations, built by scripts/build-search-index.mjs).
const norm = (s) => String(s || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const COMMUNITY_MODULE = { discover: "discover", messages: "messages", chat: "chat", direct: "directconnect", profile: "profiles", mypage: "profiles", requests: "profiles", blocked: "profiles" };

export default function DashboardSearch() {
  const { user } = useAuth();
  const mods = useModules();
  const sc = useShortcuts();
  const [index, setIndex] = useState(null);
  const [q, setQ] = useState("");
  const loading = useRef(false);

  const load = () => {
    if (index || loading.current) return;
    loading.current = true;
    fetch("/search-index.json", { cache: "force-cache" }).then((r) => r.json()).then((d) => setIndex(d.map(([t, h, x, page]) => ({ t, h, page, hay: norm(`${t} ${x}`), nl: norm(t) })))).catch(() => { loading.current = false; });
  };

  const allowed = (href) => {
    if (href.startsWith("/dashboard/superadmin")) return !!user?.is_staff;
    if (href.startsWith("/dashboard/admin")) return canOpen(user, href, mods);
    const m = href.match(/^\/dashboard\/community\/([^/]+)/);
    return !m || mods[COMMUNITY_MODULE[m[1]]] !== false;
  };
  const titles = useMemo(() => Object.fromEntries((index || []).filter((e) => e.page).map((e) => [e.h, e.t])), [index]);
  const where = (href) => {
    const area = href.startsWith("/dashboard/admin") ? "Admin" : href.startsWith("/dashboard/superadmin") ? "Super admin" : href.startsWith("/dashboard/community") ? "Community" : "";
    return [area && tx(area), tx(titles[href] || href.split("/").pop())].filter(Boolean).join(" › ");
  };

  const results = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (!index || !words.length) return [];
    return index
      .filter((e) => words.every((w) => e.hay.includes(w)) && allowed(e.h))
      .map((e) => ({ e, score: (e.page ? 0 : 10) + (words.every((w) => e.nl.includes(w)) ? 0 : 5) + (e.nl.startsWith(words[0]) ? 0 : 2) + e.t.length / 200 }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 30)
      .map((x) => x.e);
  }, [index, q, user, mods]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="dash-search">
      <div className="dash-search-box">
        <IconSearch />
        <input type="search" value={q} onFocus={load} onChange={(e) => { load(); setQ(e.target.value); }} placeholder={tx("Zoek in alle instellingen en pagina's…")} aria-label={tx("Zoeken in het dashboard")} autoComplete="off" />
      </div>
      {q.trim() && (
        <ul className="dash-search-list" role="listbox">
          {!index && <li className="muted">{tx("Laden…")}</li>}
          {index && !results.length && <li className="muted">{tx("Niets gevonden.")}</li>}
          {results.map((e) => (
            <li key={`${e.h}|${e.t}`} className="dash-search-row">
              <Link href={e.h}>
                <strong>{tx(e.t)}</strong>
                <small className="muted">{where(e.h)}</small>
              </Link>
              <button type="button" className={`icon-btn shortcut-star ${sc.has(e.h) ? "on" : ""}`} onClick={() => sc.toggle(e.h, titles[e.h] || e.t)} aria-pressed={sc.has(e.h)}
                aria-label={sc.has(e.h) ? tx("Snelkoppeling op het dashboard verwijderen") : tx("Snelkoppeling op het dashboard maken")} title={sc.has(e.h) ? tx("Snelkoppeling op het dashboard verwijderen") : tx("Snelkoppeling op het dashboard maken")}><IconStar /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
