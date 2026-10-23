// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { Busy } from "./PageLoader";
import { useEffect, useMemo, useState } from "react";
import { api, errorText } from "../lib/api";
import { getLanguage, tx } from "../lib/t";
import { useSession } from "./Session";

// The FAQ of the website (made by its owner): questions that open, with a search box and optional headings
export default function UserFaq() {
  const { ready } = useSession();
  const [items, setItems] = useState(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => { if (ready) api(`/faq/?lang=${encodeURIComponent(getLanguage())}`).then((d) => setItems(d.items)).catch((e) => setErr(errorText(e))); }, [ready]);
  const norm = (s) => String(s || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const shown = useMemo(() => (items || []).filter((i) => norm(`${i.q} ${i.a}`).includes(norm(q))), [items, q]);
  const cats = [...new Set(shown.map((i) => i.category || ""))];
  if (err) return <div className="alert">{err}</div>;
  if (!items) return <Busy />;
  return (
    <div className="faq">
      <h1>{tx("Veelgestelde vragen")}</h1>
      {items.length > 5 && <div className="faq-tools"><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Zoek in de vragen…")} aria-label={tx("Zoeken")} /></div>}
      {cats.map((c) => (
        <section key={c || "_"} className="faq-section">
          {c && <h2>{c}</h2>}
          <div className="faq-list">
            {shown.filter((i) => (i.category || "") === c).map((i) => <details key={i.id} className="faq-item"><summary>{i.q}</summary><p>{i.a}</p></details>)}
          </div>
        </section>
      ))}
      {!shown.length && <p className="muted">{items.length ? tx("Niets gevonden.") : tx("Er zijn nog geen vragen.")}</p>}
    </div>
  );
}
