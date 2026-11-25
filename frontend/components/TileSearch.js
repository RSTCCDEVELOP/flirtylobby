// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { tx } from "../lib/t";
import { useAuth } from "./AuthContext";
import { matches, norm } from "../lib/useView";

// What can be found besides the tiles: the settings inside a screen (where they are, in plain words). staff: only for a superadmin.
const INDEX = [
  { href: "/dashboard/admin/admin-setup", label: "easy2edit admin setup", where: "Admin", words: "easy2edit admin setup instellingen dashboard dashboards tegels lijst aantal per pagina verbergen zijbalk menu zoekveld weergave" },
  { href: "/dashboard/admin/admin-setup", label: "Uiterlijk van het dashboard", where: "Admin → easy2edit admin setup → Uiterlijk", words: "uiterlijk breedte zijkanten donker ruimte dichtheid compact tegels groot letters stijl minder bewegingen thema" },
  { href: "/dashboard/admin/admin-setup", label: "Licentie, bedrijf en persoon", where: "Admin → easy2edit admin setup → Licentie", words: "licentie bedrijf persoon eigenaar master koppelen gekoppeld gegevens wijzigen" },
  { href: "/dashboard/admin/onboarding", label: "Onboarding", where: "Admin → Systeem", words: "onboarding licentie upgraden hosting wijzigen gegevens naam adres opnieuw starten" },
  { href: "/dashboard/admin/cache", label: "Cache en snelheid", where: "Admin → Systeem", words: "cache snelheid sneller groener zuinig bewaren wissen systeemcache" },
  { href: "/dashboard/admin/system", label: "Welke cache de server gebruikt (database, geheugen, Redis)", where: "Admin → Basisgegevens → Cache", words: "cache database redis geheugen opslag server herstart basisgegevens", staff: true },
  { href: "/dashboard/admin/system", label: "Basisgegevens", where: "Admin → Systeem", words: "basisgegevens naam adres website api contact licentiegegevens deployment" },
  { href: "/dashboard/admin/integrations", label: "API keys", where: "Admin → Systeem", words: "api keys koppelingen claude stripe postmark ecologi pexels unsplash sleutel update" },
  { href: "/dashboard/admin/energy", label: "Energie & uitstoot", where: "Admin → Systeem", words: "energie uitstoot co2 paginagewicht groen label" },
  { href: "/dashboard/admin/bomen", label: "Bomen en giften", where: "Admin → Systeem", words: "bomen planten giften ecologi donatie groen" },
  { href: "/dashboard/superadmin/ecologi", label: "easy2edit: bomen planten", where: "Super admin", words: "bomen planten ecologi bijdragen kosten maximum", staff: true },
  { href: "/dashboard/admin/security", label: "Beveiliging", where: "Admin → Systeem", words: "beveiliging twee stap verificatie 2fa landen cookies verboden woorden blokkeren" },
  { href: "/dashboard/admin/theme", label: "Thema en loader", where: "Admin → Website", words: "thema loader laden kleuren logo lettertype boom" },
  { href: "/dashboard/superadmin", label: "Widgets in de bibliotheek", where: "Super admin → Bibliotheek → Widgets", words: "widgets widget bibliotheek installeren aftelklok klok teller lopende tekst voortgang", staff: true },
  { href: "/dashboard/admin/widgets", label: "Widgets (bibliotheek)", where: "Admin → Website → Widgets", words: "widgets widget bibliotheek installeren aftelklok klok teller lopende tekst voortgang onderdelen pagina systeemobject voorbeeld" },
  { href: "/dashboard/admin/backups", label: "Backup", where: "Admin → Systeem", words: "backup back-up terugzetten kopie" },
  { href: "/dashboard/admin/log", label: "Logboek", where: "Admin → Systeem", words: "log logboek logfile logbestand storing storingen fout fouten inloggen uitloggen gebeurtenissen audit bewaartermijn" },
  { href: "/dashboard/admin/languages", label: "Talen", where: "Admin → Systeem", words: "talen taal vertalen standaardtaal" },
  { href: "/dashboard/superadmin/wizard", label: "Installatie en licentie", where: "Super admin", words: "installatie wizard licentie prijs modules plugins", staff: true },
  { href: "/dashboard/superadmin/sites", label: "Site manager", where: "Super admin+", words: "site manager websites easy2edit server bijwerken uitsluiten bomen planten", staff: true },
  { href: "/dashboard/superadmin/prijzen", label: "Prijslijst", where: "Super admin+", words: "prijzen prijslijst btw", staff: true },
  { href: "/dashboard/superadmin/modules", label: "Modules aan en uit", where: "Super admin", words: "modules aan uit zetten plugins", staff: true },
];

// A search field above the tiles of Admin and Super admin: tiles that do not match the words are hidden (the name, the text and the label of a tile are searched).
// `selector` says what a tile is; it works on the page as it is, so every tile (also the ones that plugins add) is found.
export default function TileSearch({ selector = ".st-tile, .group-tile, .tile-card" }) {
  const [q, setQ] = useState("");
  const [n, setN] = useState(null);
  const box = useRef(null);
  const { user } = useAuth();
  useEffect(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    const root = box.current?.closest("main") || document;
    window.dispatchEvent(new CustomEvent("tilesearch", { detail: q }));  // the lists of the page that have their own search (tiles, modules, API links) follow this field
    const tiles = [...root.querySelectorAll(selector)].filter((t) => !t.closest("[data-view-managed]"));  // (the tiles of a list with its own search are filtered from its data, not from the page: all of them are found, also the ones on another page)
    tiles.forEach((t) => {
      const hit = !words.length || words.every((w) => norm(t.textContent).includes(w) || (t.dataset.find && norm(t.dataset.find).includes(w)));
      t.style.display = hit ? "" : "none";
    });
    const count = () => {  // after the lists have drawn themselves again
      const all = [...root.querySelectorAll(selector)];
      setN(words.length ? all.filter((t) => t.style.display !== "none").length : null);
      root.querySelectorAll(".collapsible, [data-tile-block]").forEach((b) => { const has = [...b.querySelectorAll(selector)]; if (has.length) b.style.display = !words.length || has.some((t) => t.style.display !== "none") ? "" : "none"; });
    };
    const timer = setTimeout(count, 80);
    return () => { clearTimeout(timer); tiles.forEach((t) => { t.style.display = ""; }); };
  }, [q, selector]);
  const found = norm(q).trim() ? INDEX.filter((x) => (!x.staff || user?.is_staff) && matches(q, x.label, x.words, x.where)) : [];
  return (
    <div ref={box} className="tile-search">
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Zoek een onderdeel…")} aria-label={tx("Zoek een onderdeel…")} />
      {n !== null && <small className="muted">{n} {tx("gevonden")}</small>}
      {found.length > 0 && (
        <div className="tile-search-hits" role="list">
          {found.map((x) => <Link key={x.href + x.label} href={x.href} className="tile-search-hit" role="listitem"><strong>{tx(x.label)}</strong><small className="muted">{tx(x.where)}</small></Link>)}
        </div>
      )}
    </div>
  );
}
