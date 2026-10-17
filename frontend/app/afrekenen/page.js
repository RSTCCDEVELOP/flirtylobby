"use client";

import { tx } from "../../lib/t";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "../../components/Cart";
import { useModule } from "../../components/Modules";
import SiteHeader from "../../components/SiteHeader";
import { api, errorText } from "../../lib/api";
import { money } from "../../lib/format";

export default function Checkout() {
  const { items, clear } = useCart();
  const enabled = useModule("orders");
  const router = useRouter();
  const [lines, setLines] = useState([]);
  const [cfg, setCfg] = useState(null);
  const [f, setF] = useState({ name: "", email: "", phone: "", street: "", postal_code: "", city: "", country: "NL", note: "" });
  const [methods, setMethods] = useState([]);
  const [method, setMethod] = useState(null);
  const [codeInput, setCodeInput] = useState("");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [qt, setQt] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => { api("/shop/config/").then(setCfg).catch(() => {}); }, []);
  useEffect(() => {
    if (items.length) api("/shop/cart/", { method: "POST", body: { ids: items.map((i) => i.id) } }).then(setLines).catch(() => {});
  }, [items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = items.map((i) => ({ ...i, p: lines.find((l) => l.id === i.id) })).filter((r) => r.p);
  const country = f.country.trim().toUpperCase();

  // shipping methods that apply to the chosen country
  useEffect(() => {
    if (country.length !== 2) return setMethods([]);
    api(`/shop/methods/?country=${country}`).then((m) => { setMethods(m); setMethod((cur) => (m.some((x) => x.id === cur) ? cur : m[0]?.id ?? null)); }).catch(() => setMethods([]));
  }, [country]);

  // totals always come from the server (prices, VAT, discount, shipping)
  useEffect(() => {
    if (!items.length) return;
    api("/shop/quote/", { method: "POST", body: { items: items.map((i) => ({ product: i.id, quantity: i.qty })), method, code, country } })
      .then((q) => { setQt(q); setCodeError(""); })
      .catch((e) => { setCodeError(errorText(e)); if (code) setCode(""); });
  }, [items, method, code, country]);

  const blocked = cfg && cfg.pay_online && !cfg.payment_available;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api("/shop/orders/", { method: "POST", body: { ...f, method, code, return_base: window.location.origin, items: items.map((i) => ({ product: i.id, quantity: i.qty })) } });
      clear();
      if (r.checkout_path) window.location.href = r.checkout_path; // (simulated) payment page
      else router.push(`/bestelling/${r.number}?t=${r.token}`);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  if (!enabled) return <div className="site"><SiteHeader /><main className="shop"><p className="muted">{tx("De webshop is niet beschikbaar.")}</p></main></div>;
  if (!items.length) return <div className="site"><SiteHeader /><main className="shop"><p className="muted">{tx("Je winkelwagen is leeg.")} <Link href="/producten" style={{ color: "var(--blue)" }}>{tx("Bekijk de producten")}</Link></p></main></div>;
  return (
    <div className="site">
      <SiteHeader />
      <main className="shop">
        <h1>{tx("Afrekenen")}</h1>
        <div className="checkout">
          <form className="card form" style={{ maxWidth: "none" }} onSubmit={submit}>
            <h2>{tx("Jouw gegevens")}</h2>
            <div className="grid2">
              <label>{tx("Naam")}<input value={f.name} onChange={set("name")} required autoComplete="name" /></label>
              <label>{tx("E-mailadres")}<input type="email" value={f.email} onChange={set("email")} required autoComplete="email" /></label>
              <label>{tx("Telefoon (optioneel)")}<input value={f.phone} onChange={set("phone")} autoComplete="tel" /></label>
              <label>{tx("Land (code)")}<input value={f.country} onChange={set("country")} maxLength={2} required /></label>
              <label>{tx("Straat en huisnummer")}<input value={f.street} onChange={set("street")} required autoComplete="street-address" /></label>
              <label>{tx("Postcode")}<input value={f.postal_code} onChange={set("postal_code")} required autoComplete="postal-code" /></label>
              <label>{tx("Plaats")}<input value={f.city} onChange={set("city")} required autoComplete="address-level2" /></label>
            </div>
            <label>{tx("Opmerking (optioneel)")}<textarea rows={3} value={f.note} onChange={set("note")} /></label>
            <div>
              <strong style={{ fontSize: ".85rem" }}>{tx("Verzending")}</strong>
              <div className="perm-list" style={{ gridTemplateColumns: "1fr" }}>
                {methods.map((m) => (
                  <label className="check" key={m.id} style={{ fontWeight: 500 }}>
                    <input type="radio" name="method" checked={method === m.id} onChange={() => setMethod(m.id)} />
                    <span>{m.name} · {Number(m.price) ? money(m.price) : tx("Gratis")}{m.delivery_time && <small className="muted"> {m.delivery_time}</small>}{m.free_from && Number(m.price) ? <small className="muted"> {tx("(gratis vanaf")} {money(m.free_from)})</small> : null}</span>
                  </label>
                ))}
                {!methods.length && <span className="muted">{tx("Geen verzendmethode beschikbaar voor dit land.")}</span>}
              </div>
            </div>
            {blocked && <div className="alert">{tx("Online betalen is nog niet beschikbaar.")}</div>}
            {error && <div className="alert">{error}</div>}
            <div><button className="btn primary" disabled={busy || blocked || !method}>{busy ? tx("Bezig…") : cfg && !cfg.pay_online ? tx("Bestelling plaatsen") : tx("Naar betalen")}</button></div>
          </form>
          <div className="card">
            <h2>{tx("Je bestelling")}</h2>
            {rows.map((r) => <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: "1rem", padding: ".3rem 0" }}><span>{r.qty} × {r.p.name}</span><span>{money(Number(r.p.price) * r.qty)}</span></div>)}
            {(!cfg || cfg.discounts) && (
              <div className="grid2" style={{ marginTop: ".75rem" }}>
                <label>{tx("Kortingscode")}<input value={codeInput} onChange={(e) => setCodeInput(e.target.value.toUpperCase())} placeholder={tx("Heb je een code?")} /></label>
                <span style={{ alignSelf: "end" }}><button type="button" className="btn" disabled={!codeInput} onClick={() => setCode(codeInput)}>{tx("Toepassen")}</button></span>
              </div>
            )}
            {codeError && <div className="alert" style={{ marginTop: ".5rem" }}>{codeError}</div>}
            {qt && (
              <div className="totals" style={{ width: "100%" }}>
                <div><span>{tx("Subtotaal")}</span><span>{money(qt.subtotal)}</span></div>
                {Number(qt.discount) > 0 && <div><span>{tx("Korting (")}{qt.code})</span><span>- {money(qt.discount)}</span></div>}
                <div><span>{tx("Verzendkosten")}</span><span>{method ? (Number(qt.shipping) ? money(qt.shipping) : tx("Gratis")) : "—"}</span></div>
                <div className="grand"><span>{tx("Totaal")}</span><span>{money(qt.total)}</span></div>
                <small className="muted">{tx("waarvan")} {money(qt.vat_total)} {tx("btw")} {cfg && !cfg.prices_include_vat ? tx("(bovenop de getoonde prijzen)") : ""}</small>
              </div>
            )}
            {cfg && !cfg.pay_online && <p className="muted" style={{ fontSize: ".85rem" }}>{tx("Je ontvangt een bevestiging per e-mail. Betalen kan achteraf per factuur.")}</p>}
          </div>
        </div>
      </main>
    </div>
  );
}
