"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SiteHeader from "../../../components/SiteHeader";
import { api } from "../../../lib/api";
import { money, ORDER_STATUS } from "../../../lib/format";

const MESSAGE = {
  paid: "Bedankt! Je betaling is ontvangen en je bestelling is bevestigd.",
  new: "Bedankt! Je bestelling is ontvangen. Je krijgt een bevestiging per e-mail.",
  pending_payment: "We wachten nog op je betaling.",
  canceled: "Deze bestelling is geannuleerd (bijvoorbeeld omdat de betaling niet is gelukt).",
};

export default function OrderStatus({ number, token }) {
  const [o, setO] = useState(undefined);
  useEffect(() => { api(`/shop/orders/${number}/?t=${encodeURIComponent(token)}`).then(setO).catch(() => setO(null)); }, [number, token]);
  return (
    <div className="site">
      <SiteHeader />
      <main className="shop">
        {o === undefined && <p className="muted">Laden…</p>}
        {o === null && <p className="muted">Deze bestelling is niet gevonden.</p>}
        {o && (
          <>
            <h1>Bestelling {o.number}</h1>
            <p><span className={`badge ${ORDER_STATUS[o.status][1]}`}>{ORDER_STATUS[o.status][0]}</span> {MESSAGE[o.status] || ""}</p>
            <div className="card">
              {o.items.map((i) => <div key={i.id} style={{ display: "flex", justifyContent: "space-between", padding: ".3rem 0" }}><span>{i.quantity} × {i.name}</span><span>{money(i.line_total, o.currency)}</span></div>)}
              <div className="totals" style={{ width: "100%" }}>
                {Number(o.discount) > 0 && <div><span>Korting ({o.discount_code})</span><span>- {money(o.discount, o.currency)}</span></div>}
                <div><span>Verzending{o.shipping_method ? ` (${o.shipping_method})` : ""}</span><span>{Number(o.shipping) ? money(o.shipping, o.currency) : "Gratis"}</span></div>
                <div className="grand"><span>Totaal</span><span>{money(o.total, o.currency)}</span></div>
                <small className="muted">waarvan {money(o.vat_total, o.currency)} btw</small>
              </div>
              <p className="muted" style={{ fontSize: ".875rem" }}>Bezorgadres: {o.name}, {o.street}, {o.postal_code} {o.city}</p>
            </div>
            <p><Link href="/producten" style={{ color: "var(--blue)" }}>Verder winkelen</Link></p>
          </>
        )}
      </main>
    </div>
  );
}
