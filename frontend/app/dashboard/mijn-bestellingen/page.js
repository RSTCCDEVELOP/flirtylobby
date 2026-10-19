"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorText } from "../../../lib/api";
import DashHero from "../../../components/DashHero";
import { money } from "../../../lib/format";
import { useModules } from "../../../components/Modules";
import { tx } from "../../../lib/t";

const KIND = { shop: "Webshop", subscription: "Abonnement", donation: "Donatie" };

// A member's own orders: number, what it was for, status and total; each one opens the order page.
export default function MyOrders() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const mods = useModules();
  useEffect(() => { api("/shop/orders/mine/").then(setRows).catch((e) => { setRows([]); setError(errorText(e)); }); }, []);
  return (
    <>
      <DashHero title="Mijn bestellingen" textId="page.my-orders.intro" actions={[...(mods["plugin:webshop"] !== false ? [{ href: "/producten", label: "Naar de winkel" }] : []), { href: "/dashboard/mijn-donaties", label: "Mijn donaties" }]}
        stats={[
          { label: "Bestellingen", value: rows ? rows.length : null },
          { label: "Lopend", value: rows ? rows.filter((o) => !["completed", "canceled", "refunded"].includes(o.status)).length : null, hint: tx("nog niet afgerond") },
          { label: "Totaal besteed", value: rows ? money(rows.filter((o) => !["canceled", "refunded", "new", "pending_payment"].includes(o.status)).reduce((a, o) => a + Number(o.total), 0), "EUR") : null },
        ]} />
      {error && <div className="alert">{error}</div>}
      {rows === null ? <p className="muted">{tx("Laden…")}</p> : !rows.length ? <p className="muted">{tx("Je hebt nog geen bestellingen.")}</p> : (
        <div className="card" style={{ overflowX: "auto" }}>
          <table>
            <thead><tr><th>{tx("Bestelling")}</th><th>{tx("Soort")}</th><th>{tx("Datum")}</th><th>{tx("Status")}</th><th>{tx("Totaal")}</th><th /></tr></thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.number}>
                  <td><strong>{o.number}</strong></td>
                  <td>{tx(KIND[o.kind] || o.kind)}</td>
                  <td>{new Date(o.created_at).toLocaleDateString()}</td>
                  <td><span className="badge">{tx(o.status_label)}</span></td>
                  <td>{money(o.total, o.currency)}</td>
                  <td><Link className="btn sm" href={`/bestelling/${o.number}?t=${encodeURIComponent(o.token)}`}>{tx("Bekijk")}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
