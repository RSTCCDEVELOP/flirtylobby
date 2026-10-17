"use client";

import { tx } from "../../lib/t";
import { cardFieldsText } from "../../components/ProfileFields";
import VerifyBadge from "../../components/VerifyBadge";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useModule } from "../../components/Modules";
import SiteHeader from "../../components/SiteHeader";
import { api, mediaUrl } from "../../lib/api";

export default function Members() {
  const on = useModule("profiles");
  const [q, setQ] = useState("");
  const [list, setList] = useState(null);
  useEffect(() => {
    let lang = "";
    try { lang = localStorage.getItem("lang") || ""; } catch {}
    const t = setTimeout(() => api(`/profiles/?q=${encodeURIComponent(q)}${lang ? `&lang=${lang}` : ""}`).then(setList).catch(() => setList([])), 200);
    return () => clearTimeout(t);
  }, [q]);
  if (!on) return <div className="site"><SiteHeader /><main className="shop"><p className="muted">{tx("Niet beschikbaar.")}</p></main></div>;
  return (
    <div className="site">
      <SiteHeader />
      <main className="shop">
        <h1>{tx("Leden")}</h1>
        <input placeholder={tx("Zoek op naam of omschrijving…")} value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 420, margin: "1rem 0 1.5rem" }} />
        <div className="product-grid">
          {(list || []).map((m) => (
            <Link key={m.slug} href={`/leden/${m.slug}`} className="card member-card" data-g={m.gender || undefined}>
              <div className="pimg">{m.photo && /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(m.photo)} alt={m.name} />}</div>
              <div className="pbody"><strong>{m.name} <VerifyBadge status={m.verification} size={16} /></strong><span className="muted" style={{ fontSize: ".875rem" }}>{m.headline}</span>{m.card_fields?.length > 0 && <span style={{ fontSize: ".8rem" }}>{cardFieldsText(m.card_fields)}</span>}</div>
            </Link>
          ))}
          {list && !list.length && <p className="muted">{tx("Geen leden gevonden. Sommige profielen zie je pas als je bent ingelogd.")}</p>}
        </div>
      </main>
    </div>
  );
}
