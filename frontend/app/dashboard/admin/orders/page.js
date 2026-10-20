"use client";

import { tx } from "../../../../lib/t";
import { confirmDialog } from "../../../../lib/dialog";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import DashHero from "../../../../components/DashHero";
import Collapsible, { CollapseAll } from "../../../../components/Collapsible";
import ViewBar from "../../../../components/ViewBar";
import TableView from "../../../../components/TableView";
import { useView } from "../../../../lib/useView";
import { api, errorText } from "../../../../lib/api";
import { money, ORDER_STATUS } from "../../../../lib/format";
import { lvl } from "../../../../lib/perms";

export default function Orders() {
  const tv = useView("orders", "list");
  const { user } = useAuth();
  const L = lvl(user, "orders");
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState({ status: "", q: "", kind: "" });
  const [cfg, setCfg] = useState(null);
  const [msg, setMsg] = useState(null);
  const [o, setO] = useState(null);
  const load = useCallback(() => {
    const p = new URLSearchParams(Object.entries(filter).filter(([, v]) => v));
    api(`/shop/admin/orders/?${p}`).then(setOrders).catch((e) => setMsg({ ok: false, text: errorText(e) }));
  }, [filter]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api("/shop/admin/settings/").then(setCfg).catch(() => {}); }, []);

  async function saveOrder() {
    try {
      await api(`/shop/admin/orders/${o.id}/`, { method: "PATCH", body: { status: o.status, internal_note: o.internal_note } });
      setO(null); load(); setMsg({ ok: true, text: tx("Order {0} bijgewerkt.", o.number) });
    } catch (e) { setO({ ...o, error: errorText(e) }); }
  }
  async function remove() {
    if (!(await confirmDialog(tx("Order {0} definitief verwijderen?", o.number), { danger: true }))) return;
    try { await api(`/shop/admin/orders/${o.id}/`, { method: "DELETE" }); setO(null); load(); } catch (e) { setO({ ...o, error: errorText(e) }); }
  }
  async function saveCfg(patch) {
    const next = { ...cfg, ...patch };
    setCfg(next);
    try { setCfg(await api("/shop/admin/settings/", { method: "PUT", body: next })); setMsg({ ok: true, text: tx("Webshop-instellingen opgeslagen.") }); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  }

  const open = orders.filter((x) => ["new", "paid", "processing"].includes(x.status)).length;

  return (
    <>
      <DashHero title="Orders" text={`${tx("Bestellingen uit de webshop (")}${open} ${tx("wachten op actie). De producten, verzendmethoden en kortingscodes beheer je in de plugin Webshop.")}`} actions={[{ href: "/dashboard/admin/plugins/webshop", label: "Webshop" }]} />
      <div className="row" style={{ justifyContent: "flex-end", marginBottom: ".6rem" }}><CollapseAll /></div>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}

      <Collapsible id="shop-orders" title={tx("Bestellingen ({0})", orders.length)}>
        <div className="row" style={{ justifyContent: "flex-start", marginBottom: ".75rem" }}>
          <input type="search" style={{ maxWidth: 260 }} placeholder={tx("Zoek op nummer, naam of e-mail…")} value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
          <select style={{ width: "auto" }} value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
            <option value="">{tx("Alle statussen")}</option>
            {Object.entries(ORDER_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <select style={{ width: "auto" }} value={filter.kind} onChange={(e) => setFilter({ ...filter, kind: e.target.value })}>
            <option value="">{tx("Alle soorten")}</option>
            <option value="shop">{tx("Webshop")}</option>
            <option value="subscription">{tx("Abonnementen")}</option>
          </select>
        </div>
        <ViewBar view={tv} />
        <TableView view={tv} style={{ border: "1px solid var(--line)", borderRadius: "var(--btn-radius)" }}>
          <table>
            <thead><tr><th>{tx("Order")}</th><th>{tx("Datum")}</th><th>{tx("Klant")}</th><th>{tx("Totaal")}</th><th>{tx("Status")}</th><th></th></tr></thead>
            <tbody>
              {orders.map((x) => (
                <tr key={x.id}>
                  <td><strong>{x.number}</strong>{x.kind && x.kind !== "shop" && <><br /><small className="muted">{x.kind === "subscription" ? `${tx("Abonnement")} · ${tx("periode")} ${x.period_no}` : tx("Donatie")}</small></>}</td>
                  <td>{new Date(x.created_at).toLocaleDateString("nl-NL")}</td>
                  <td>{x.name} <small className="muted">{x.email}</small></td>
                  <td>{money(x.total, x.currency)}</td>
                  <td><span className={`badge ${ORDER_STATUS[x.status][1]}`}>{ORDER_STATUS[x.status][0]}</span></td>
                  <td className="actions"><button className="btn sm" onClick={() => setO({ ...x })}>{tx("Bekijk")}</button></td>
                </tr>
              ))}
              {!orders.length && <tr><td colSpan={6} className="muted">{tx("Geen bestellingen.")}</td></tr>}
            </tbody>
          </table>
        </TableView>
      </Collapsible>

      <p className="muted" style={{ fontSize: ".85rem" }}>{tx("Btw en betalen stel je in bij")} <a href="/dashboard/admin/plugins/webshop">{tx("Webshop")}</a>.</p>




      {o && (
        <div className="overlay" onClick={() => setO(null)}>
          <div className="card modal form" onClick={(e) => e.stopPropagation()}>
            <h2>{tx("Order")} {o.number} <span className={`badge ${ORDER_STATUS[o.status][1]}`} style={{ marginLeft: ".4rem" }}>{ORDER_STATUS[o.status][0]}</span></h2>
            <div className="grid2">
              <div><strong>{tx("Klant")}</strong><br />{o.name}<br />{o.email}{o.phone && <><br />{o.phone}</>}</div>
              <div><strong>{tx("Bezorgadres")}</strong><br />{o.street}<br />{o.postal_code} {o.city} ({o.country})</div>
            </div>
            {o.note && <p><strong>{tx("Opmerking klant:")}</strong> {o.note}</p>}
            <table style={{ width: "100%" }}>
              <thead><tr><th>{tx("Product")}</th><th>{tx("Aantal")}</th><th>{tx("Prijs")}</th><th>{tx("Btw")}</th><th>{tx("Totaal")}</th></tr></thead>
              <tbody>{o.items.map((i) => <tr key={i.id}><td>{i.name}{i.sku && <small className="muted"> {i.sku}</small>}</td><td>{i.quantity}</td><td>{money(i.unit_price, o.currency)}</td><td>{Number(i.vat_rate)}%</td><td>{money(i.line_total, o.currency)}</td></tr>)}</tbody>
            </table>
            <div className="totals">{Number(o.discount) > 0 && <div><span>{tx("Korting")} {o.discount_code}</span><span>- {money(o.discount, o.currency)}</span></div>}<div><span>{tx("Verzending")}{o.shipping_method ? ` (${o.shipping_method})` : ""}</span><span>{money(o.shipping, o.currency)}</span></div><div className="grand"><span>{tx("Totaal")}</span><span>{money(o.total, o.currency)}</span></div><small className="muted">{tx("waarvan")} {money(o.vat_total, o.currency)} {tx("btw")}</small></div>
            {o.payment_ref && <small className="muted">{tx("Betaling:")} <code>{o.payment_ref}</code> {tx("(sandbox)")}</small>}
            <div className="grid2">
              <label>{tx("Status")}
                <select value={o.status} disabled={L < 2} onChange={(e) => setO({ ...o, status: e.target.value })}>
                  {Object.entries(ORDER_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </label>
              <label>{tx("Interne notitie")}<input value={o.internal_note} disabled={L < 2} onChange={(e) => setO({ ...o, internal_note: e.target.value })} /></label>
            </div>
            <small className="muted">{tx("Op Geannuleerd zetten geeft de voorraad weer terug.")}</small>
            {o.error && <div className="alert">{o.error}</div>}
            <div className="row" style={{ justifyContent: "space-between" }}>
              {L >= 3 ? <button className="btn danger" onClick={remove}>{tx("Verwijderen")}</button> : <span />}
              <span className="row"><button className="btn" onClick={() => setO(null)}>{tx("Sluiten")}</button>{L >= 2 && <button className="btn primary" onClick={saveOrder}>{tx("Opslaan")}</button>}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
