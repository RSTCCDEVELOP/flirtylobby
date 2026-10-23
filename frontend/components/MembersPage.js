// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../lib/t";
import { cardFieldsText } from "./ProfileFields";
import VerifyBadge from "./VerifyBadge";
import Link from "next/link";
import { useEffect, useState } from "react";
import { IconGrid, IconMenu } from "./Icons";
import { useModule } from "./Modules";
import PageBlocks from "./PageBlocks";
import Paged from "./Paged";
import { api, mediaUrl } from "../lib/api";

// examples for the preview in the admin: so the page can be designed with a full list of members (never shown to visitors)
const SAMPLE = [["Sophie", "Dol op koffie en lange wandelingen", "#ec4899"], ["Daan", "Zoekt een maatje voor festivals", "#6366f1"], ["Lotte", "Yogalerares met een zwak voor sushi", "#f59e0b"], ["Milan", "Ondernemer, hardloper en hobbykok", "#16a34a"], ["Fleur", "Ontwerpster, kattenmens", "#8b5cf6"], ["Jesper", "Gamer en fietser", "#0891b2"], ["Amira", "Reislustig en nieuwsgierig", "#ea580c"], ["Tim", "Muzikant", "#1d4ed8"]]
  .map(([name, headline, color], i) => ({ slug: `voorbeeld-${i}`, name, headline, color, photo: "", verification: "open", card_fields: [], sample: true }));

// The members page without the header and footer of the site: also shown inside the admin (preview and editing), with examples
export default function MembersPage({ preview = false }) {
  const on = useModule("profiles");
  const [q, setQ] = useState("");
  const [list, setList] = useState(null);
  const [mode, setMode] = useState(""); // the visitor's own choice: "grid" | "list"; empty = what the page says
  useEffect(() => { try { const v = localStorage.getItem("view:members-page"); if (v === "grid" || v === "list") setMode(v); } catch {} }, []);
  const choose = (m) => { setMode(m); try { localStorage.setItem("view:members-page", m); } catch {} };
  useEffect(() => {
    let lang = "";
    try { lang = localStorage.getItem("lang") || ""; } catch {}
    const t = setTimeout(() => api(`/profiles/?q=${encodeURIComponent(q)}${lang ? `&lang=${lang}` : ""}`).then(setList).catch(() => setList([])), 200);
    return () => clearTimeout(t);
  }, [q]);
  if (!on) return <p className="muted">{tx("Niet beschikbaar.")}</p>;
  return (
    <>
    <PageBlocks pageKey="members" title={tx("Leden")} />
    <div className="games-bar" style={{ margin: "1rem 0 1.5rem" }}>
      <input type="search" placeholder={tx("Zoek op naam of omschrijving…")} value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 420 }} />
      <span className="view-switch" role="group" aria-label={tx("Weergave")}>
        <button type="button" className={mode === "grid" ? "active" : ""} onClick={() => choose("grid")} title={tx("Tegels")} aria-pressed={mode === "grid"}><IconGrid /></button>
        <button type="button" className={mode === "list" ? "active" : ""} onClick={() => choose("list")} title={tx("Lijst")} aria-pressed={mode === "list"}><IconMenu /></button>
      </span>
    </div>
    <Paged id="members-page" selector=".product-grid" query={q}><div className="product-grid" data-view={mode || undefined}>
      {(preview ? [...(list || []), ...SAMPLE] : list || []).map((m) => (
        <Link key={m.slug} href={m.sample ? "#" : `/leden/${m.slug}`} onClick={m.sample ? (e) => e.preventDefault() : undefined} className="card member-card" data-g={m.gender || undefined}>
          <div className="pimg">{m.sample && <span className="sample-face" style={{ background: m.color }}>{m.name[0]}</span>}{m.photo && /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(m.photo)} alt={m.name} />}</div>
          <div className="pbody"><strong>{m.name} <VerifyBadge status={m.verification} size={16} /></strong><span className="muted" style={{ fontSize: ".875rem" }}>{m.headline}</span>{m.card_fields?.length > 0 && <span style={{ fontSize: ".8rem" }}>{cardFieldsText(m.card_fields)}</span>}</div>
        </Link>
      ))}
      {list && !list.length && <p className="muted">{tx("Geen leden gevonden. Sommige profielen zie je pas als je bent ingelogd.")}</p>}
    </div></Paged>
    </>
  );
}
