"use client";

import { tx } from "../../../../lib/t";
import { confirmDialog } from "../../../../lib/dialog";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import Collapsible, { CollapseAll } from "../../../../components/Collapsible";
import { api, errorText } from "../../../../lib/api";
import { money, ORDER_STATUS } from "../../../../lib/format";
import { lvl } from "../../../../lib/perms";

export default function Orders() {
  const { user } = useAuth();
  const L = lvl(user, "orders");
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState({ status: "", q: "", kind: "" });
  const [cfg, setCfg] = useState(null);
  const [msg, setMsg] = useState(null);
  const [o, setO] = useState(null);
  const [methods, setMethods] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [mm, setMm] = useState(null);
  const [dm, setDm] = useState(null);
  const loadExtra = useCallback(() => {
    api("/shop/admin/methods/").then(setMethods).catch(() => {});
    api("/shop/admin/discounts/").then(setDiscounts).catch(() => {});
  }, []);
  useEffect(() => { loadExtra(); }, [loadExtra]);

  async function saveMethod(e) {
    e.preventDefault();
    const { id, error: _e, ...b } = mm;
    b.free_from = b.free_from === "" ? null : b.free_from;
    b.countries = String(b.countries).split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
    try { await (id ? api(`/shop/admin/methods/${id}/`, { method: "PATCH", body: b }) : api("/shop/admin/methods/", { method: "POST", body: b })); setMm(null); loadExtra(); } catch (err) { setMm({ ...mm, error: errorText(err) }); }
  }
  async function saveDiscount(e) {
    e.preventDefault();
    const { id, error: _e, used_count, ...b } = dm;
    b.max_uses = b.max_uses === "" ? null : Number(b.max_uses);
    b.starts_at = b.starts_at || null;
    b.ends_at = b.ends_at || null;
    try { await (id ? api(`/shop/admin/discounts/${id}/`, { method: "PATCH", body: b }) : api("/shop/admin/discounts/", { method: "POST", body: b })); setDm(null); loadExtra(); } catch (err) { setDm({ ...dm, error: errorText(err) }); }
  }

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
      <div className="page-head">
        <div>
          <h1>{tx("Orders")}</h1>
          <p className="muted" style={{ margin: 0 }}>{tx("Bestellingen uit de webshop (")}{open} {tx("wachten op actie). De webshop zelf staat op")} <code>/producten</code> {tx("en")} <code>/winkelwagen</code>.</p>
        </div>
        <CollapseAll />
      </div>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}

      <Collapsible id="shop-orders" title={tx("Bestellingen ({0})", orders.length)}>
        <div className="row" style={{ justifyContent: "flex-start", marginBottom: ".75rem" }}>
          <input style={{ maxWidth: 260 }} placeholder={tx("Zoek op nummer, naam of e-mail…")} value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
          <select style={{ width: "auto" }} value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
            <option value="">{tx("Alle statussen")}</option>
            {Object.entries(ORDER_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <select style={{ width: "auto" }} value={filter.kind} onChange={(e) => setFilter({ ...filter, kind: e.target.value })}>
            <option value="">{tx("Alle soorten")}</option>
            <option value="shop">{tx("Webshop")}</option>
            <option value="subscription">{tx("Abonnementen")}</option>
            <option value="donation">{tx("Donaties")}</option>
          </select>
        </div>
        <div className="table-wrap" style={{ border: "1px solid var(--line)", borderRadius: "var(--btn-radius)" }}>
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
        </div>
      </Collapsible>

      <Collapsible id="shop-vat" title={tx("Btw en betalen")}>
        {cfg && (
          <>
            <label className="check sec-toggle">
              <span className="switch"><input type="checkbox" checked={cfg.prices_include_vat} disabled={L < 2} onChange={(e) => saveCfg({ prices_include_vat: e.target.checked })} /><span /></span>
              <span>{tx("Ingevoerde prijzen zijn inclusief btw")}<small className="muted"> {tx("Uit = prijzen zijn exclusief btw en de btw komt er bij het afrekenen bovenop.")}</small></span>
            </label>
            <div className="theme-grid" style={{ marginTop: ".75rem" }}>
              <label>{tx("Standaard btw-percentage")}
                <select value={cfg.default_vat} disabled={L < 2} onChange={(e) => saveCfg({ default_vat: e.target.value })}>{cfg.vat_rates.map((r) => <option key={r} value={r}>{r}%</option>)}</select>
              </label>
              <label>{tx("Beschikbare percentages")} <small className="muted">{tx("gescheiden door komma's")}</small>
                <input defaultValue={cfg.vat_rates.join(", ")} disabled={L < 2} onBlur={(e) => saveCfg({ vat_rates: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
              </label>
              <label>{tx("Btw op verzendkosten")}
                <select value={cfg.shipping_vat} disabled={L < 2} onChange={(e) => saveCfg({ shipping_vat: e.target.value })}>{cfg.vat_rates.map((r) => <option key={r} value={r}>{r}%</option>)}</select>
              </label>
            </div>
            <p className="muted" style={{ fontSize: ".85rem" }}>{tx("Per product kies je een eigen percentage; leeg = standaard. De btw staat per regel op de order.")}</p>
            <label className="check sec-toggle" style={{ marginTop: ".5rem" }}>
              <span className="switch"><input type="checkbox" checked={cfg.pay_online} disabled={L < 2} onChange={(e) => saveCfg({ pay_online: e.target.checked })} /><span /></span>
              <span>{tx("Online betalen bij het afrekenen")}<small className="muted"> {tx("Uit = bestelling plaatsen en achteraf betalen per factuur. Aan werkt nu alleen met de sandbox (gesimuleerde betaling).")}</small></span>
            </label>
          </>
        )}
      </Collapsible>

      <Collapsible id="shop-methods" title={tx("Verzendmethoden ({0})", methods.length)}>
        <p className="muted" style={{ marginTop: 0 }}>{tx("De klant kiest bij het afrekenen uit de methoden die voor zijn land gelden. Prijzen zijn inclusief btw.")}</p>
        {L >= 3 && <button className="btn primary" onClick={() => setMm({ name: "", description: "", delivery_time: "", price: "0", free_from: "", countries: "", active: true, order: methods.length })}>{tx("+ Verzendmethode")}</button>}
        <div className="int-list" style={{ marginTop: ".75rem" }}>
          {methods.map((m) => (
            <div className="card int-item" key={m.id}>
              <div className="int-main">
                <strong>{m.name} <span className={`badge ${m.active ? "ok" : "off"}`} style={{ marginLeft: ".4rem" }}>{m.active ? tx("Actief") : tx("Uit")}</span></strong>
                <span className="muted">{money(m.price)}{m.free_from ? tx(" · gratis vanaf {0}", money(m.free_from)) : ""}{m.delivery_time ? ` · ${m.delivery_time}` : ""} · {m.countries.length ? m.countries.join(", ") : tx("alle landen")}</span>
              </div>
              <div className="int-actions">
                {L >= 2 && <button className="btn sm" onClick={() => setMm({ ...m, free_from: m.free_from ?? "", countries: m.countries.join(", ") })}>{tx("Wijzig")}</button>}
                {L >= 3 && <button className="btn sm danger" onClick={async () => (await confirmDialog(tx("\"{0}\" verwijderen?", m.name), { danger: true })) && api(`/shop/admin/methods/${m.id}/`, { method: "DELETE" }).then(loadExtra)}>{tx("Verwijder")}</button>}
              </div>
            </div>
          ))}
          {!methods.length && <p className="muted">{tx("Nog geen verzendmethoden: klanten kunnen dan niet bestellen.")}</p>}
        </div>
      </Collapsible>

      <Collapsible id="shop-discounts" title={tx("Kortingscodes ({0})", discounts.length)}>
        {L >= 3 && <button className="btn primary" onClick={() => setDm({ code: "", description: "", kind: "percent", value: "10", min_subtotal: "0", max_uses: "", starts_at: "", ends_at: "", active: true })}>{tx("+ Kortingscode")}</button>}
        <div className="int-list" style={{ marginTop: ".75rem" }}>
          {discounts.map((d) => (
            <div className="card int-item" key={d.id}>
              <div className="int-main">
                <strong><code>{d.code}</code> <span className={`badge ${d.active ? "ok" : "off"}`} style={{ marginLeft: ".4rem" }}>{d.active ? tx("Actief") : tx("Uit")}</span></strong>
                <span className="muted">{d.kind === "percent" ? `${Number(d.value)}%` : money(d.value)} {tx("korting")}{Number(d.min_subtotal) ? tx(" · vanaf {0}", money(d.min_subtotal)) : ""} {tx("· gebruikt")} {d.used_count}{d.max_uses ? ` van ${d.max_uses}` : ""}{d.ends_at ? tx(" · tot {0}", new Date(d.ends_at).toLocaleDateString("nl-NL")) : ""}</span>
              </div>
              <div className="int-actions">
                {L >= 2 && <button className="btn sm" onClick={() => setDm({ ...d, max_uses: d.max_uses ?? "", starts_at: d.starts_at ? d.starts_at.slice(0, 16) : "", ends_at: d.ends_at ? d.ends_at.slice(0, 16) : "" })}>{tx("Wijzig")}</button>}
                {L >= 3 && <button className="btn sm danger" onClick={async () => (await confirmDialog(tx("Code {0} verwijderen?", d.code), { danger: true })) && api(`/shop/admin/discounts/${d.id}/`, { method: "DELETE" }).then(loadExtra)}>{tx("Verwijder")}</button>}
              </div>
            </div>
          ))}
          {!discounts.length && <p className="muted">{tx("Nog geen kortingscodes.")}</p>}
        </div>
      </Collapsible>

      {mm && (
        <div className="overlay" onClick={() => setMm(null)}>
          <form className="card modal form" onClick={(e) => e.stopPropagation()} onSubmit={saveMethod}>
            <h2>{mm.id ? tx("Verzendmethode wijzigen") : tx("Nieuwe verzendmethode")}</h2>
            <div className="grid2">
              <label>{tx("Naam")}<input value={mm.name} onChange={(e) => setMm({ ...mm, name: e.target.value })} required /></label>
              <label>{tx("Levertijd")}<input value={mm.delivery_time} placeholder={tx("2-3 werkdagen")} onChange={(e) => setMm({ ...mm, delivery_time: e.target.value })} /></label>
              <label>{tx("Prijs (€, incl. btw)")}<input value={mm.price} inputMode="decimal" onChange={(e) => setMm({ ...mm, price: e.target.value })} required /></label>
              <label>{tx("Gratis vanaf (€)")} <small className="muted">{tx("leeg = nooit")}</small><input value={mm.free_from} inputMode="decimal" onChange={(e) => setMm({ ...mm, free_from: e.target.value })} /></label>
              <label>{tx("Landen")} <small className="muted">{tx("codes, leeg = alle landen")}</small><input value={mm.countries} placeholder={tx("NL, BE")} onChange={(e) => setMm({ ...mm, countries: e.target.value })} /></label>
              <label>{tx("Volgorde")}<input type="number" min={0} value={mm.order} onChange={(e) => setMm({ ...mm, order: Number(e.target.value) })} /></label>
            </div>
            <label>{tx("Omschrijving")}<input value={mm.description} onChange={(e) => setMm({ ...mm, description: e.target.value })} /></label>
            <label className="check"><input type="checkbox" checked={mm.active} onChange={(e) => setMm({ ...mm, active: e.target.checked })} /> {tx("Actief")}</label>
            {mm.error && <div className="alert">{mm.error}</div>}
            <div className="row"><button type="button" className="btn" onClick={() => setMm(null)}>{tx("Annuleren")}</button><button className="btn primary">{tx("Opslaan")}</button></div>
          </form>
        </div>
      )}

      {dm && (
        <div className="overlay" onClick={() => setDm(null)}>
          <form className="card modal form" onClick={(e) => e.stopPropagation()} onSubmit={saveDiscount}>
            <h2>{dm.id ? tx("Kortingscode wijzigen") : tx("Nieuwe kortingscode")}</h2>
            <div className="grid2">
              <label>{tx("Code")}<input value={dm.code} onChange={(e) => setDm({ ...dm, code: e.target.value.toUpperCase() })} required placeholder={tx("WELKOM10")} /></label>
              <label>{tx("Soort")}
                <select value={dm.kind} onChange={(e) => setDm({ ...dm, kind: e.target.value })}><option value="percent">{tx("Percentage")}</option><option value="fixed">{tx("Vast bedrag (€)")}</option></select>
              </label>
              <label>{dm.kind === "percent" ? tx("Korting (%)") : tx("Korting (€)")}<input value={dm.value} inputMode="decimal" onChange={(e) => setDm({ ...dm, value: e.target.value })} required /></label>
              <label>{tx("Minimaal bestelbedrag (€)")}<input value={dm.min_subtotal} inputMode="decimal" onChange={(e) => setDm({ ...dm, min_subtotal: e.target.value })} /></label>
              <label>{tx("Maximaal aantal keer")} <small className="muted">{tx("leeg = onbeperkt")}</small><input type="number" min={1} value={dm.max_uses} onChange={(e) => setDm({ ...dm, max_uses: e.target.value })} /></label>
              <label>{tx("Omschrijving")}<input value={dm.description} onChange={(e) => setDm({ ...dm, description: e.target.value })} /></label>
              <label>{tx("Geldig vanaf")}<input type="datetime-local" value={dm.starts_at} onChange={(e) => setDm({ ...dm, starts_at: e.target.value })} /></label>
              <label>{tx("Geldig tot")}<input type="datetime-local" value={dm.ends_at} onChange={(e) => setDm({ ...dm, ends_at: e.target.value })} /></label>
            </div>
            <label className="check"><input type="checkbox" checked={dm.active} onChange={(e) => setDm({ ...dm, active: e.target.checked })} /> {tx("Actief")}</label>
            {dm.error && <div className="alert">{dm.error}</div>}
            <div className="row"><button type="button" className="btn" onClick={() => setDm(null)}>{tx("Annuleren")}</button><button className="btn primary">{tx("Opslaan")}</button></div>
          </form>
        </div>
      )}

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
