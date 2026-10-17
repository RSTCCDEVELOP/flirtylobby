"use client";

import { tx } from "../../lib/t";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "../../components/Cart";
import { useModule } from "../../components/Modules";
import SiteHeader from "../../components/SiteHeader";
import { api, mediaUrl } from "../../lib/api";
import { money } from "../../lib/format";

// Cart page. Prices and stock come from the server, the browser only remembers ids and quantities.
export default function CartPage() {
  const { items, setQty, remove } = useCart();
  const enabled = useModule("orders");
  const [lines, setLines] = useState([]);
  const [cfg, setCfg] = useState(null);
  const [qt, setQt] = useState(null);
  const key = items.map((i) => i.id).join(",");

  useEffect(() => { api("/shop/config/").then(setCfg).catch(() => {}); }, []);
  useEffect(() => {
    if (!items.length) return setLines([]);
    api("/shop/cart/", { method: "POST", body: { ids: items.map((i) => i.id) } }).then(setLines).catch(() => {});
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!items.length) return setQt(null);
    api("/shop/quote/", { method: "POST", body: { items: items.map((i) => ({ product: i.id, quantity: i.qty })) } }).then(setQt).catch(() => setQt(null));
  }, [items]);

  const rows = items.map((i) => ({ ...i, p: lines.find((l) => l.id === i.id) })).filter((r) => r.p);

  if (!enabled) return <div className="site"><SiteHeader /><main className="shop"><p className="muted">{tx("De webshop is niet beschikbaar.")}</p></main></div>;
  return (
    <div className="site">
      <SiteHeader />
      <main className="shop">
        <h1>{tx("Winkelwagen")}</h1>
        {!rows.length ? (
          <p className="muted">{tx("Je winkelwagen is leeg.")} <Link href="/producten" style={{ color: "var(--blue)" }}>{tx("Bekijk de producten")}</Link></p>
        ) : (
          <>
            <table className="cart-table">
              <thead><tr><th></th><th>{tx("Product")}</th><th>{tx("Prijs")}</th><th>{tx("Aantal")}</th><th>{tx("Totaal")}</th><th></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.p.image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl(r.p.image.url)} alt="" />}</td>
                    <td><Link href={`/producten/${r.p.slug}`}>{r.p.name}</Link></td>
                    <td>{money(r.p.price)}{cfg && <small className="muted"> {cfg.prices_include_vat ? "incl." : "excl."} {tx("btw")}</small>}</td>
                    <td><input type="number" min={1} max={r.p.max_quantity ?? 99} value={r.qty} style={{ width: 80 }} onChange={(e) => setQty(r.id, Number(e.target.value) || 1)} /></td>
                    <td>{money(Number(r.p.price) * r.qty)}</td>
                    <td><button className="btn sm danger" onClick={() => remove(r.id)}>{tx("Verwijder")}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="totals">
              {qt && <div><span>{tx("Subtotaal")} {cfg && !cfg.prices_include_vat ? tx("(incl. btw)") : ""}</span><span>{money(qt.subtotal)}</span></div>}
              <small className="muted">{tx("Verzendkosten en een eventuele kortingscode kies je bij het afrekenen.")}</small>
              <Link href="/afrekenen" className="btn primary" style={{ marginTop: ".75rem" }}>{tx("Afrekenen")}</Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
