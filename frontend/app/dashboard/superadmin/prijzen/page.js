// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { api, errorText } from "../../../../lib/api";
import { tx } from "../../../../lib/t";
import Tabs from "../../../../components/Tabs";
import MarketingTile from "../../../../components/MarketingTile";
import SalesTest from "../../../../components/SalesTest";
import { useAuth } from "../../../../components/AuthContext";
import Collapsible from "../../../../components/Collapsible";
import PriceList from "../../../../components/PriceList";
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
  const [sales, setSales] = useState(null);
  const load = (d) => { setData(d); setCfg({ rst_share: d.config.rst_share ?? 0, base_price: d.config.base_price, vat_rate: d.config.vat_rate, periods: d.config.periods, imp: { hourly_rate: d.config.implementation?.hourly_rate ?? 0, design_hours: d.config.implementation?.design_hours ?? 0, setup_hours: d.config.implementation?.setup_hours ?? 0 } }); setHours(d.config.implementation?.items || {}); setMail({ max: d.email.max, tiers: d.email.tiers.map((t) => ({ ...t })) }); setHost({ usd_eur: d.hosting.config.usd_eur, markup: d.hosting.config.markup, default: d.hosting.config.default, options: Object.fromEntries(d.hosting.config.options.map((o) => [o.key, { price: o.price, do_usd: o.do_usd }])) }); setItems(Object.fromEntries(d.catalog.map((c) => [c.key, c.price]))); };
  useEffect(() => { api("/system/sales/").then(setSales).catch(() => {}); }, []);
  const { user } = useAuth();
  const [test, setTest] = useState(""); // the method being tried
  const [plObj, setPlObj] = useState(false);
  const [instObj, setInstObj] = useState(false); // the standard installations as system objects // the price list as a system object
  useEffect(() => { api("/system/pricelist/object/state/").then((r) => { setPlObj(r.on); setInstObj(!!r.installations); }).catch(() => {}); }, []);
  const [mk, setMk] = useState(null); // the marketing tiles
  useEffect(() => { if (tab === "marketing" && !mk) api("/system/marketing/").then(setMk).catch((e) => setMsg({ ok: false, text: errorText(e) })); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  const mkSave = async (body) => { try { setMk(await api("/system/marketing/", { method: "POST", body })); } catch (e) { setMsg({ ok: false, text: errorText(e) }); } };
  const [sd, setSd] = useState(null); // the Sales settings being edited: {recipients, verify_email, options}
  useEffect(() => { if (sales && !sd) setSd({ recipients: (sales.recipients || []).join(", "), verify_email: !!sales.verify_email, verify_method: sales.verify_method || "code", installations: sales.options.installations ?? sales.installations.map((i) => i.key), questions: sales.options.questions ?? sales.questions.map((q) => q.key), hosting: sales.options.hosting ?? sales.hosting.map((h) => h.key), email: sales.options.email !== false }); }, [sales]); // eslint-disable-line react-hooks/exhaustive-deps
  const saveSales = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await api("/system/sales/", { method: "POST", body: { recipients: sd.recipients, verify_email: sd.verify_email, verify_method: sd.verify_method, options: { installations: sd.installations, questions: sd.questions, hosting: sd.hosting, email: sd.email } } });
      setSales(r); setMsg({ ok: true, text: tx("Opgeslagen.") });
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  const flip = (k, v) => setSd((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v] }));
  const toggleObject = async (on) => { try { setSales(await api("/system/sales/", { method: "POST", body: { system_object: on } })); setMsg({ ok: true, text: on ? tx("Het systeemobject is gemaakt. Je vindt het in de bewerkmodus bij Systeemobjecten.") : tx("Het systeemobject is verwijderd.") }); } catch (e) { setMsg({ ok: false, text: errorText(e) }); } };
  useEffect(() => { api("/system/pricing/").then(load).catch((e) => setMsg({ ok: false, text: errorText(e) })); }, []);
  if (!data) return msg ? <div className="alert">{msg.text}</div> : null;
  const save = async () => {
    setBusy(true); setMsg(null);
    try { load(await api("/system/pricing/", { method: "POST", body: { rst_share: cfg.rst_share, base_price: cfg.base_price, vat_rate: cfg.vat_rate, periods: Object.fromEntries(Object.entries(cfg.periods).map(([k, p]) => [k, { discount: p.discount }])), items, implementation: { ...cfg.imp, items: hours }, hosting: host, email: mail } })); setMsg({ ok: true, text: tx("Opgeslagen in pricing.json en in de licentie gezet.") }); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  const groups = [...new Set(data.catalog.map((c) => c.group))];
  const TABS = [["basis", tx("Basis en korting")], ["impl", tx("Ontwerp en implementatie")], ["host", tx("Hosting en inkoop")], ["mail", tx("E-mail")], ...groups.map((g) => [g, tx(g)]), ["pricelist", tx("Prijslijst")], ["sales", tx("Sales")], ["marketing", tx("Marketing")]];
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
      {tab === "pricelist" && (
        <div className="card stack" style={{ gap: ".9rem" }}>
          <PriceList />
          <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={plObj} onChange={async (e) => { const on = e.target.checked; try { const r = await api("/system/pricelist/object/", { method: "POST", body: { on } }); setPlObj(r.on); setMsg({ ok: true, text: r.on ? tx("Het systeemobject Prijslijst is gemaakt. Je vindt het in de bewerkmodus bij Systeemobjecten.") : tx("Het systeemobject Prijslijst is verwijderd.") }); } catch (er) { setMsg({ ok: false, text: errorText(er) }); } }} /><span /></span><span>{tx("Prijslijst als systeemobject op pagina's kunnen zetten")}</span></label>
          <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={instObj} onChange={async (e) => { const on = e.target.checked; try { const r = await api("/system/pricelist/object/", { method: "POST", body: { on, installations: true } }); setInstObj(!!r.installations); setMsg({ ok: true, text: r.installations ? tx("De standaardinstallaties zijn systeemobjecten geworden. Je vindt ze in de bewerkmodus bij Systeemobjecten.") : tx("De systeemobjecten van de standaardinstallaties zijn verwijderd.") }); } catch (er) { setMsg({ ok: false, text: errorText(er) }); } }} /><span /></span><span>{tx("Standaardinstallaties als systeemobjecten (met wat erin zit en de prijs per maand)")}</span></label>
        </div>
      )}
      {tab === "sales" && (
        <div className="stack" style={{ gap: "1.2rem" }}>
          <div className="card stack" style={{ gap: "1rem" }}>
            <h2 style={{ margin: 0 }}>{tx("Calculatieformulier")}</h2>
            <label className={`wz-q${sales?.system_object ? " on" : ""}`}>
              <span className="switch"><input type="checkbox" checked={!!sales?.system_object} onChange={(e) => toggleObject(e.target.checked)} /><span /></span>
              <span className="wz-text"><strong>{tx("Systeemobject: calculatieformulier")}</strong><small className="muted">{tx("Maakt een systeemobject van het calculatieformulier. In de bewerkmodus zet je het op een pagina: bezoekers kiezen wat ze nodig hebben, zien de prijs per maand, kwartaal en jaar en krijgen de offerte als PDF per e-mail. De inkoopprijzen en marges zijn niet zichtbaar.")}</small></span>
            </label>
            {sales?.system_object && <small className="muted">{tx("Naam van het object")}: <strong>{tx("Prijsberekening")}</strong> · {sales.slug}</small>}
          </div>
          {sd && (
            <>
              <div className="card stack" style={{ gap: "1rem" }}>
                <h2 style={{ margin: 0 }}>{tx("Aanvragen")}</h2>
                <label>{tx("E-mailadressen van de reseller die de aanvraag ontvangen")}
                  <input value={sd.recipients} onChange={(e) => setSd({ ...sd, recipients: e.target.value })} placeholder="verkoop@bedrijf.nl, tweede@bedrijf.nl" />
                  <small className="muted">{tx("Meerdere adressen scheid je met een komma. Leeg = het e-mailadres van de reseller uit de wizard.")}</small>
                </label>
                <label className={`wz-q${sd.verify_email ? " on" : ""}`}>
                  <span className="switch"><input type="checkbox" checked={sd.verify_email} onChange={(e) => setSd({ ...sd, verify_email: e.target.checked })} /><span /></span>
                  <span className="wz-text"><strong>{tx("E-mailadres eerst bevestigen")}</strong><small className="muted">{tx("Voor de offerte verstuurd wordt, vult de bezoeker zijn e-mailadres in een venster in en typt de code van 6 letters en cijfers die per e-mail komt. Zo kloppen de adressen en kan niemand de offerte naar een ander sturen.")}</small></span>
                </label>
                {sd.verify_email && (
                  <div className="stack" style={{ gap: ".5rem" }}>
                    <strong>{tx("Methode van bevestiging")}</strong>
                    <div className="wz-grid">
                      {[["code", "Code per e-mail", "De bezoeker krijgt een code van 6 letters en cijfers per e-mail en typt die over in een venster."], ["screen", "Code op het scherm", "Een willekeurige code van hoofdletters en cijfers staat als plaatje in het venster en wordt met het toetsenbord overgetikt. Er gaat geen e-mail naar de bezoeker; dit stopt robots."], ["link", "Link in de e-mail", "De bezoeker opent een link in de e-mail; het formulier wacht en gaat daarna zelf verder."]].map(([k, name, desc]) => (
                        <label key={k} className={`wz-q${sd.verify_method === k ? " on" : ""}`}>
                          <input type="radio" name="vm" checked={sd.verify_method === k} onChange={() => setSd({ ...sd, verify_method: k })} />
                          <span className="wz-text"><strong>{tx(name)}</strong><small className="muted">{tx(desc)}</small>
                            <span><button type="button" className="btn sm" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTest(k); }}>{tx("Test")}</button></span></span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="card stack" style={{ gap: "1rem" }}>
                <h2 style={{ margin: 0 }}>{tx("Opties in het formulier")}</h2>
                <p className="muted" style={{ margin: 0 }}>{tx("Zet aan wat bezoekers in het calculatieformulier kunnen kiezen. Wat uit staat, is niet te zien en telt niet mee in de prijs.")}</p>
                <h3 style={{ margin: ".2rem 0 0" }}>{tx("Standaard installaties")}</h3>
                <div className="wz-grid">
                  {sales.installations.map((i) => (
                    <label key={i.key} className={`wz-q${sd.installations.includes(i.key) ? " on" : ""}`}>
                      <span className="switch"><input type="checkbox" checked={sd.installations.includes(i.key)} onChange={() => flip("installations", i.key)} /><span /></span>
                      <span className="wz-text"><strong>{tx(i.name)}</strong></span>
                    </label>
                  ))}
                </div>
                <h3 style={{ margin: ".4rem 0 0" }}>{tx("Onderdelen")}</h3>
                <div className="wz-grid">
                  {sales.questions.map((q) => (
                    <label key={q.key} className={`wz-q${sd.questions.includes(q.key) ? " on" : ""}`}>
                      <span className="switch"><input type="checkbox" checked={sd.questions.includes(q.key)} onChange={() => flip("questions", q.key)} /><span /></span>
                      <span className="wz-text"><strong>{tx(q.label)}</strong></span>
                    </label>
                  ))}
                </div>
                <h3 style={{ margin: ".4rem 0 0" }}>{tx("Hosting")}</h3>
                <div className="wz-grid">
                  {sales.hosting.map((h) => (
                    <label key={h.key} className={`wz-q${sd.hosting.includes(h.key) ? " on" : ""}`}>
                      <span className="switch"><input type="checkbox" checked={sd.hosting.includes(h.key)} onChange={() => flip("hosting", h.key)} /><span /></span>
                      <span className="wz-text"><strong>{tx(h.label)}</strong></span>
                    </label>
                  ))}
                </div>
                <label className={`wz-q${sd.email ? " on" : ""}`} style={{ maxWidth: 420 }}>
                  <span className="switch"><input type="checkbox" checked={sd.email} onChange={(e) => setSd({ ...sd, email: e.target.checked })} /><span /></span>
                  <span className="wz-text"><strong>{tx("E-mail op een eigen domein")}</strong><small className="muted">{tx("De schuif met het aantal e-mailadressen.")}</small></span>
                </label>
              </div>
              <div className="save-bar"><button type="button" className="btn primary" disabled={busy} onClick={saveSales}>{busy ? tx("Bezig…") : tx("Opslaan")}</button></div>
            </>
          )}
        </div>
      )}
      {tab === "marketing" && mk && (
        <div className="stack" style={{ gap: "1.4rem" }}>
          <div className="card stack" style={{ gap: "1rem" }}>
            <h2 style={{ margin: 0 }}>{tx("Easy2edit marketing")}</h2>
            <label className={`wz-q${mk.enabled ? " on" : ""}`}>
              <span className="switch"><input type="checkbox" checked={mk.enabled} onChange={(e) => mkSave({ enabled: e.target.checked })} /><span /></span>
              <span className="wz-text"><strong>{tx("Marketing-systeemobjecten")}</strong><small className="muted">{tx("Voor elke module komt er een tegel (systeemobject) die je in de bewerkmodus op een pagina zet. De tegel opent een venster met een marketingtekst over de module, met voorbeelden met verzonnen gegevens, in het thema van je site. Zet hier alles of per module aan of uit.")}</small></span>
            </label>
          </div>
          {mk.enabled && [...new Set(mk.items.map((i) => i.group))].map((g) => (
            <Collapsible key={g} id={`mk-${g}`} title={`${tx(g)} (${mk.items.filter((i) => i.group === g).length})`}>
              <div className="mk-grid">{mk.items.filter((i) => i.group === g).map((i) => <MarketingTile key={i.key} module={i.key} title={i.label} tagline={i.tagline} admin on={i.on} onToggle={(v) => mkSave({ modules: { [i.key]: v } })} />)}</div>
            </Collapsible>
          ))}
        </div>
      )}
      {test && <SalesTest method={test} email={user?.email || ""} onClose={() => setTest("")} />}
      {tab !== "sales" && tab !== "marketing" && tab !== "pricelist" && <div className="save-bar"><button type="button" className="btn primary" disabled={busy} onClick={save}>{busy ? tx("Bezig…") : tx("Opslaan")}</button></div>}
    </>
  );
}
