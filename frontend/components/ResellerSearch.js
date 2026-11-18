// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";
import KitScope from "../lib/ui-kit/KitScope";
import { RichText } from "./SmallEditor";

// The searchable list of resellers, read through the API of the easy2edit site (GET /api/easy2edit/resellers/?q=). Only what may be public is in it.
export default function ResellerSearch() {
  const [q, setQ] = useState("");
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const t = setTimeout(() => api(`/easy2edit/resellers/?q=${encodeURIComponent(q.trim())}`).then((r) => { setList(r.resellers || []); setError(""); }).catch((e) => setError(errorText(e))), 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <KitScope tag="ui-form-fields">
      <div className="e2e-stack" style={{ gap: "1rem" }}>
        <input className="e2e-input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Zoek op naam, plaats of land")} aria-label={tx("Zoeken")} style={{ maxWidth: 420 }} />
        {error && <span className="e2e-error">{error}</span>}
        {list && list.length === 0 && <span className="e2e-hint">{tx("Geen resellers gevonden.")}</span>}
        <div className="e2e-grid" style={{ "--e2e-min": "300px", gap: "1rem" }}>
          {(list || []).map((r) => (
            <article key={r.id} className="e2e-field" style={{ gap: ".4rem", padding: "1.1rem 1.2rem", border: "1px solid var(--line)", borderRadius: "var(--radius, 12px)", background: "var(--card)" }}>
              <h2 style={{ margin: 0, fontSize: "1.15rem" }}>{r.name}</h2>
              {(r.city || r.country) && <span className="e2e-hint">{[r.city, r.country].filter(Boolean).join(", ")}</span>}
              {r.info && <RichText value={r.info} />}
              <div className="e2e-stack" style={{ gap: ".25rem", marginTop: ".3rem" }}>
                {r.website && <a href={r.website} target="_blank" rel="noopener noreferrer">{r.website.replace(/^https?:\/\//, "")}</a>}
                {(r.websites || []).map((w) => <a key={w.url} href={w.url} target="_blank" rel="noopener noreferrer">{w.label || w.url.replace(/^https?:\/\//, "")}</a>)}
                {r.email && <a href={`mailto:${r.email}`}>{r.email}</a>}
                {r.phone && <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`}>{r.phone}</a>}
                {r.sales?.email && <a href={`mailto:${r.sales.email}`}>{r.sales.name ? `${r.sales.name} · ` : ""}{r.sales.email}</a>}
                {r.sales?.phone && <a href={`tel:${r.sales.phone.replace(/[^\d+]/g, "")}`}>{r.sales.phone}</a>}
              </div>
            </article>
          ))}
        </div>
      </div>
    </KitScope>
  );
}
