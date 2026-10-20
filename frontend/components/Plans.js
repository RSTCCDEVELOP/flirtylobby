"use client";

import { tx } from "../lib/t";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, errorText } from "../lib/api";
import { money } from "../lib/format";
import { useSession } from "./Session";

const PER = { week: "per week", month: "per maand", quarter: "per kwartaal", year: "per jaar", once: "eenmalig" };

// Public list of subscriptions to buy. Paying goes through the same checkout as the webshop (sandbox / invoice).
export default function Plans() {
  const { user, ready } = useSession();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(0);
  const [msg, setMsg] = useState(null);
  const load = useCallback(() => api("/subscriptions/plans/").then(setData).catch((e) => setMsg({ ok: false, text: errorText(e) })), []);
  useEffect(() => { if (ready) load(); }, [ready, load, user]);

  async function buy(p) {
    setBusy(p.id); setMsg(null);
    try {
      const r = await api("/subscriptions/subscribe/", { method: "POST", body: { plan: p.id, return_base: window.location.origin } });
      if (r.checkout_path) { window.location.href = r.checkout_path; return; }
      setMsg({ ok: true, text: r.subscription.status === "trial" ? tx("Je proefperiode is gestart.") : tx("Gelukt! Je abonnement is aangemaakt.") });
      load();
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(0);
  }

  if (!data) return <p className="muted">{msg?.text || tx("Laden…")}</p>;
  return (
    <>
      {typeof window !== "undefined" && new URLSearchParams(window.location.search).get("locked") && <div className="alert">{data.site_message}</div>}
      {data.intro && <p className="muted">{data.intro}</p>}
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}
      {user && <p><Link href="/dashboard/subscriptions">{tx("Mijn abonnementen")} →</Link></p>}
      <div className="plan-grid">
        {data.plans.map((p) => (
          <div className={`card plan-card${p.highlight ? " hl" : ""}`} key={p.id}>
            {p.highlight && <span className="plan-ribbon">{tx("Populair")}</span>}
            <h2>{p.name}</h2>
            <div className="plan-price">{money(p.price, data.currency)} <small>{tx(PER[p.interval])}</small></div>
            {p.description && <p className="muted">{p.description}</p>}
            <ul className="plan-grants">{p.grants.map((g, i) => <li key={i}>{tx(g.label)}</li>)}</ul>
            {p.trial_days > 0 && <p className="muted" style={{ fontSize: ".85rem" }}>{p.trial_days} {tx("dagen gratis proberen")}</p>}
            {!user && ready ? <Link className="btn primary" href="/login?next=/abonnementen">{tx("Inloggen om te kiezen")}</Link>
              : p.mine && p.mine !== "expired" ? <span className="badge ok">{p.mine === "pending" ? tx("Wacht op betaling") : tx("Je hebt dit abonnement")}</span>
              : <button className="btn primary" disabled={busy === p.id} onClick={() => buy(p)}>{busy === p.id ? tx("Bezig…") : tx("Kies dit abonnement")}</button>}
          </div>
        ))}
      </div>
      {!data.plans.length && <p className="muted">{tx("Er zijn nu geen abonnementen beschikbaar.")}</p>}
    </>
  );
}
