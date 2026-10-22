"use client";

import { useEffect, useState } from "react";
import { api, errorText } from "../../../../lib/api";
import { tx } from "../../../../lib/t";
import Tabs from "../../../../components/Tabs";
import PriceAI from "../../../../components/PriceAI";

// The price list (apps/core/pricing.json, goes with every installation): base price, discounts per period and the price of every package, module and plugin, per month ex VAT.
export default function PriceEditor() {
  const [data, setData] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [items, setItems] = useState({});
  const [hours, setHours] = useState({});  // hours of design and implementation per item
  const [tab, setTab] = useState("basis");
  const [host, setHost] = useState(null);
  const [mail, setMail] = useState({ max: 200, tiers: [] });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = (d) => { setData(d); setCfg({ rst_share: d.config.rst_share ?? 0, base_price: d.config.base_price, vat_rate: d.config.vat_rate, periods: d.config.periods, imp: { hourly_rate: d.config.implementation?.hourly_rate ?? 0, design_hours: d.config.implementation?.design_hours ?? 0, setup_hours: d.config.implementation?.setup_hours ?? 0 } }); setHours(d.config.implementation?.items || {}); setMail({ max: d.email.max, tiers: d.email.tiers.map((t) => ({ ...t })) }); setHost({ usd_eur: d.hosting.config.usd_eur, markup: d.hosting.config.markup, default: d.hosting.config.default, options: Object.fromEntries(d.hosting.config.options.map((o) => [o.key, { price: o.price, do_usd: o.do_usd }])) }); setItems(Object.fromEntries(d.catalog.map((c) => [c.key, c.price]))); };
  useEffect(() => { api("/system/pricing/").then(load).catch((e) => setMsg({ ok: false, text: errorText(e) })); }, []);
  if (!data) return msg ? <div className="alert">{msg.text}</div> : null;
  const save = async () => {
    setBusy(true); setMsg(null);
    try { load(await api("/system/pricing/", { method: "POST", body: { rst_share: cfg.rst_share, base_price: cfg.base_price, vat_rate: cfg.vat_rate, periods: Object.fromEntries(Object.entries(cfg.periods).map(([k, p]) => [k, { discount: p.discount }])), items, implementation: { ...cfg.imp, items: hours }, hosting: host, email: mail } })); setMsg({ ok: true, text: tx("Opgeslagen in pricing.json en in de licentie gezet.") }); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  const groups = [...new Set(data.catalog.map((c) => c.group))];
  const TABS = [["basis", tx("Basis en korting")], ["impl", tx("Ontwerp en implementatie")], ["host", tx("Hosting en inkoop")], ["mail", tx("E-mail")], ...groups.map((g) => [g, tx(g)])];
  return (
    <>
      <div className="row between" style={{ alignItems: "center" }}><h1 style={{ margin: 0 }}>{tx("Prijzen")}</h1><PriceAI onDone={() => api("/system/pricing/").then(load)} /></div>
      <p className="muted">{tx("Prijzen per maand, exclusief btw. Ze staan in backend/apps/core/pricing.json en gaan mee met elke implementatie: neem dat bestand mee in git, dan gelden dezelfde prijzen overal.")}</p>
      {data.config.note && <small className="muted">{data.config.note}</small>}
      {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
      <div style={{ margin: "1rem 0 1.2rem" }}><Tabs tabs={TABS} value={tab} onChange={setTab} /></div>
      {tab === "basis" && <div className="card stack" style={{ gap: ".7rem" }}>
        <strong>{tx("Basis en korting")}</strong>
        <div className="pe-cols">
          <label>{tx("Basisprijs per maand (€)")}<input type="number" step="0.01" min="0" value={cfg.base_price} onChange={(e) => setCfg({ ...cfg, base_price: e.target.value })} /></label>
          <label>{tx("Btw (%)")}<input type="number" step="1" min="0" max="50" value={cfg.vat_rate} onChange={(e) => setCfg({ ...cfg, vat_rate: e.target.value })} /></label>
          {Object.entries(cfg.periods).map(([k, p]) => (
            <label key={k}>{tx("Korting")} {tx(p.label).toLowerCase()} (%)<input type="number" step="1" min="0" max="90" value={p.discount} disabled={p.months === 1} onChange={(e) => setCfg({ ...cfg, periods: { ...cfg.periods, [k]: { ...p, discount: e.target.value } } })} /></label>
          ))}
        </div>
      </div>}
      {tab === "host" && host && <div className="card stack" style={{ gap: "1rem" }}>
        <strong>{tx("Inkoop")}</strong>
        <div className="pe-cols">
          <label>{tx("Aandeel voor RST (%) — inkoop voor het gebruik van Easy2edit")}<input type="number" step="1" min="0" max="100" value={cfg.rst_share} onChange={(e) => setCfg({ ...cfg, rst_share: e.target.value })} /></label></div>
        <strong>{tx("Hosting (per maand, ex btw)")}</strong>
        <div className="pe-cols">
          <label>{tx("Wisselkoers USD → EUR")}<input type="number" step="0.01" min="0.1" value={host.usd_eur} onChange={(e) => setHost({ ...host, usd_eur: e.target.value })} /></label>
          <label>{tx("Opslag op de prijs van DigitalOcean (%)")}<input type="number" step="1" min="0" value={host.markup} onChange={(e) => setHost({ ...host, markup: e.target.value })} /></label>
        </div>
        <div className="pe-table" style={{ border: "1px solid var(--line)", borderRadius: 12 }}>
          <div className="pe-row head"><strong>{tx("Keuze")}</strong><span>{tx("DigitalOcean ($)")}</span><span>{tx("Vaste prijs (€)")}</span></div>
          {data.hosting.options.map((o) => (
            <div key={o.key} className="pe-row">
              <span className="pe-name"><strong>{tx(o.label)}</strong> <small className="muted">{tx("verkoop")} € {o.price} · {tx("inkoop")} € {o.cost} · <strong style={{ color: "var(--green, #2e9b5f)" }}>{tx("winst")} € {o.profit} ({o.margin_pct}%)</strong></small></span>
              <input type="number" step="0.01" min="0" disabled={o.do_usd == null} value={host.options[o.key]?.do_usd ?? ""} onChange={(e) => setHost({ ...host, options: { ...host.options, [o.key]: { ...host.options[o.key], do_usd: e.target.value } } })} />
              <input type="number" step="0.01" min="0" disabled={o.do_usd != null} value={o.do_usd != null ? "" : host.options[o.key]?.price ?? ""} onChange={(e) => setHost({ ...host, options: { ...host.options, [o.key]: { ...host.options[o.key], price: e.target.value } } })} />
            </div>
          ))}
        </div>
        <small className="muted">{tx("Een VPS kost de prijs van DigitalOcean × wisselkoers + opslag, afgerond op .95 en maximaal € 35. Shared heeft een vaste prijs. Na het opslaan zie je de nieuwe prijzen.")}</small>
      </div>}
      {tab === "mail" && <div className="card pe-table">
        <div className="pe-row head"><strong>{tx("E-mail: prijs per adres per maand (ex btw)")}</strong><span>{tx("Vanaf aantal")}</span><span>{tx("€ per adres")}</span></div>
        {mail.tiers.map((t, i) => (
          <div key={i} className="pe-row">
            <span className="pe-name">{tx("Trap")} {i + 1}</span>
            <input type="number" min="1" step="1" value={t.from} onChange={(e) => setMail({ ...mail, tiers: mail.tiers.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)) })} />
            <input type="number" min="0" step="0.05" value={t.price} onChange={(e) => setMail({ ...mail, tiers: mail.tiers.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)) })} />
          </div>
        ))}
        <div className="pe-row"><span className="pe-name">{tx("Maximum aantal adressen op de schuif")}</span><input type="number" min="1" step="1" value={mail.max} onChange={(e) => setMail({ ...mail, max: e.target.value })} /><span /></div>
      </div>}
      {tab === "impl" && <div className="card stack" style={{ gap: ".7rem" }}>
        <strong>{tx("Ontwerp en implementatie (eenmalig, inschatting)")}</strong>
        <div className="pe-cols">
          <label>{tx("Uurtarief (€, ex btw)")}<input type="number" step="1" min="0" value={cfg.imp.hourly_rate} onChange={(e) => setCfg({ ...cfg, imp: { ...cfg.imp, hourly_rate: e.target.value } })} /></label>
          <label>{tx("Uren ontwerp (design)")}<input type="number" step="0.5" min="0" value={cfg.imp.design_hours} onChange={(e) => setCfg({ ...cfg, imp: { ...cfg.imp, design_hours: e.target.value } })} /></label>
          <label>{tx("Uren installatie en inrichting")}<input type="number" step="0.5" min="0" value={cfg.imp.setup_hours} onChange={(e) => setCfg({ ...cfg, imp: { ...cfg.imp, setup_hours: e.target.value } })} /></label>
        </div>
        <small className="muted">{tx("Per pakket, module of plugin vul je hieronder ook de uren in. Alle prijzen zijn inclusief domeinnaam en hosting.")}</small>
      </div>}
      {groups.filter((g) => g === tab).map((g) => (
        <div key={g} className="card pe-table">
          <div className="pe-row head"><strong>{tx(g)}</strong><span>{tx("€ per maand")}</span><span>{tx("Uren")}</span></div>
          {data.catalog.filter((c) => c.group === g).map((c) => (
            <label key={c.key} className="pe-row">
              <span className="pe-name">{tx(c.label)} <small className="muted">{c.key}</small></span>
              <input type="number" step="0.01" min="0" title={tx("Prijs per maand (€)")} value={items[c.key] ?? 0} onChange={(e) => setItems({ ...items, [c.key]: e.target.value })} />
              <input type="number" step="0.5" min="0" title={tx("Uren ontwerp en implementatie")} value={hours[c.key] ?? 0} onChange={(e) => setHours({ ...hours, [c.key]: e.target.value })} />
            </label>
          ))}
        </div>
      ))}
      <div style={{ marginTop: "1rem" }}><button type="button" className="btn primary" disabled={busy} onClick={save}>{busy ? tx("Bezig…") : tx("Opslaan")}</button></div>
    </>
  );
}
