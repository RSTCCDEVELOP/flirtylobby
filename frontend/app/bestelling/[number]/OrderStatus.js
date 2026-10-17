"use client";

import { tx } from "../../../lib/t";
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
        {o === undefined && <p className="muted">{tx("Laden…")}</p>}
        {o === null && <p className="muted">{tx("Deze bestelling is niet gevonden.")}</p>}
        {o && (
          <>
            <h1>{tx("Bestelling")} {o.number}</h1>
            <p><span className={`badge ${ORDER_STATUS[o.status][1]}`}>{ORDER_STATUS[o.status][0]}</span> {MESSAGE[o.status] || ""}</p>
            <div className="card">
              {o.items.map((i) => <div key={i.id} style={{ display: "flex", justifyContent: "space-between", padding: ".3rem 0" }}><span>{i.quantity} × {i.name}</span><span>{money(i.line_total, o.currency)}</span></div>)}
              <div className="totals" style={{ width: "100%" }}>
                {Number(o.discount) > 0 && <div><span>{tx("Korting (")}{o.discount_code})</span><span>- {money(o.discount, o.currency)}</span></div>}
                <div><span>{tx("Verzending")}{o.shipping_method ? ` (${o.shipping_method})` : ""}</span><span>{Number(o.shipping) ? money(o.shipping, o.currency) : tx("Gratis")}</span></div>
                <div className="grand"><span>{tx("Totaal")}</span><span>{money(o.total, o.currency)}</span></div>
                <small className="muted">{tx("waarvan")} {money(o.vat_total, o.currency)} {tx("btw")}</small>
              </div>
              <p className="muted" style={{ fontSize: ".875rem" }}>{tx("Bezorgadres:")} {o.name}, {o.street}, {o.postal_code} {o.city}</p>
            </div>
            <p><Link href="/producten" style={{ color: "var(--blue)" }}>{tx("Verder winkelen")}</Link></p>
          </>
        )}
      </main>
    </div>
  );
}
