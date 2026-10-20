"use client";

import { useEffect, useRef, useState } from "react";
import { api, errorText } from "../lib/api";
import { confirmDialog } from "../lib/dialog";
import { tx } from "../lib/t";

const eur = (v) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(Number(v));

// Price (incl. VAT) per module, plugin and game: what is in use counts towards the price of the licence. Folds per group, one open at a time.
function ComponentPrices({ onTotal }) {
  const [d, setD] = useState(null);
  const [open, setOpen] = useState("");
  const [error, setError] = useState("");
  const timer = useRef(null);
  useEffect(() => { api("/system/license/prices/").then((r) => { setD(r); onTotal(r.total); }).catch((e) => setError(errorText(e))); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return error ? <div className="alert">{error}</div> : null;
  const set = (item, v) => {
    setD((x) => ({ ...x, items: x.items.map((i) => (i === item ? { ...i, price: v } : i)) }));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => api("/system/license/prices/", { method: "PUT", body: { prices: { [`${item.kind}:${item.key}`]: v } } }).then((r) => { setD((x) => ({ ...x, total: r.total, in_use: r.in_use })); onTotal(r.total); }).catch((e) => setError(errorText(e))), 600);
  };
  const groups = [...new Set(d.items.map((i) => i.group))];
  return (
    <div style={{ display: "grid", gap: ".4rem" }}>
      {error && <div className="alert">{error}</div>}
      <div className="card" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: ".5rem" }}>
        <span>{tx("Licentieprijs nu")}: <strong>{eur(d.total)}</strong> <small className="muted">({tx("incl. btw")})</small></span>
        <small className="muted">{tx("Basisprijs")} {eur(d.base_price)} + {tx("in gebruik")} {eur(d.in_use)}</small>
      </div>
      {groups.map((g) => {
        const list = d.items.filter((i) => i.group === g), isOpen = open === g, used = list.filter((i) => i.active).reduce((a, i) => a + Number(i.price || 0), 0);
        return (
          <div key={g} className="info-acc">
            <button type="button" className="info-acc-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? "" : g)}><span>{tx(g)}</span><span className="info-ver">{eur(used)} <span className="info-chev" data-open={isOpen}>▾</span></span></button>
            {isOpen && (
              <div style={{ display: "grid", gap: ".35rem", padding: ".5rem .2rem" }}>
                {list.map((i) => (
                  <label key={`${i.kind}:${i.key}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".6rem" }}>
                    <span>{tx(i.label)} <small className="muted">{i.active ? tx("in gebruik") : tx("uit")}</small></span>
                    <input type="number" min="0" step="0.01" value={i.price} onChange={(e) => set(i, e.target.value)} style={{ width: 110 }} />
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Super admin: the licence number of this installation and the client (opdrachtgever). Both show in the Info pop-up.
export default function LicenseAdmin() {
  const [lic, setLic] = useState(null);
  const [error, setError] = useState("");
  const timer = useRef(null);
  useEffect(() => { api("/system/license/").then(setLic).catch((e) => setError(errorText(e))); }, []);
  if (!lic) return error ? <div className="alert">{error}</div> : null;
  const field = (k, v) => {
    setLic(k.startsWith("reseller_") ? { ...lic, reseller: { ...(lic.reseller || {}), [k.slice(9)]: v } } : { ...lic, [k]: v });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => api("/system/license/", { method: "PUT", body: { [k]: v } }).then((r) => setLic((x) => ({ ...x, expired: r.expired, has: r.has }))).catch((e) => setError(errorText(e))), 600); // saved by itself
  };
  const remove = async () => {
    if (!(await confirmDialog(tx("De licentie leegmaken en verwijderen? De website werkt daarna zonder licentie en toont onderaan elke pagina dat er geen licentie in gebruik is."), { okLabel: tx("Licentie verwijderen"), cancelLabel: tx("Annuleren") }))) return;
    try { setLic(await api("/system/license/", { method: "DELETE" })); } catch (e) { setError(errorText(e)); }
  };
  const make = async () => {
    if (lic.number && !(await confirmDialog(tx("Er is al een licentienummer. Een nieuw nummer vervangt het huidige. Doorgaan?"), { okLabel: tx("Nieuw nummer"), cancelLabel: tx("Annuleren") }))) return;
    try { setLic(await api("/system/license/", { method: "POST", body: {} })); } catch (e) { setError(errorText(e)); }
  };
  return (
    <div style={{ display: "grid", gap: ".8rem" }}>
      {error && <div className="alert">{error}</div>}
      {lic.expired && <div className="alert">{tx("De licentie is verlopen: de website toont de onderhoudspagina.")}</div>}
      <div className="lic-cols">
        <section className="lic-col">
          <h3>{tx("Licentie")}</h3>
          <label>{tx("Opdrachtgever")}<input value={lic.client} maxLength={200} onChange={(e) => field("client", e.target.value)} placeholder={tx("Naam van de opdrachtgever van deze website")} /></label>
          <label>{tx("Adres opdrachtgever")}<input value={lic.client_address || ""} maxLength={300} onChange={(e) => field("client_address", e.target.value)} placeholder={tx("Straat, postcode en plaats")} /></label>
          <label>{tx("Licentie geldig tot")}<input type="date" value={lic.valid_until || ""} onChange={(e) => field("valid_until", e.target.value)} />
            <small className="muted" style={{ display: "block" }}>{tx("Leeg = geen einddatum. Na deze datum ziet iedereen de onderhoudspagina; superadmins kunnen nog inloggen om de licentie te verlengen.")}</small></label>
          <div style={{ display: "flex", gap: ".6rem", alignItems: "end", flexWrap: "wrap" }}>
            <label style={{ flex: 1, minWidth: 180 }}>{tx("Licentienummer")}<input value={lic.number} readOnly placeholder={tx("Nog niet gemaakt")} style={{ fontFamily: "monospace", letterSpacing: ".05em" }} /></label>
            <button type="button" className="btn primary" onClick={make}>{lic.number ? tx("Nieuw nummer maken") : tx("Nummer maken")}</button>
          </div>
          {lic.issued_at && <small className="muted">{tx("Uitgegeven op")} {new Date(lic.issued_at).toLocaleString()}</small>}
          {lic.has && <div><button type="button" className="btn danger" onClick={remove}>{tx("Licentie leegmaken en verwijderen")}</button></div>}
        </section>
        <section className="lic-col">
          <h3>{tx("Reseller")}</h3>
          <label>{tx("Reseller")}<input value={lic.reseller?.name || ""} maxLength={120} onChange={(e) => field("reseller_name", e.target.value)} placeholder={tx("Naam van de reseller")} /></label>
          <label>{tx("E-mail reseller")}<input type="email" value={lic.reseller?.email || ""} onChange={(e) => field("reseller_email", e.target.value)} /></label>
          <label>{tx("Link om de licentie te bestellen of te betalen")}<input value={lic.reseller?.url || ""} placeholder="https://…" onChange={(e) => field("reseller_url", e.target.value)} /></label>
          <h3 style={{ marginTop: ".6rem" }}>{tx("Verlengen")}</h3>
          <div className="grid2">
            <label>{tx("Basisprijs (incl. btw)")}<input type="number" min="0" step="0.01" value={lic.base_price ?? 0} onChange={(e) => field("base_price", e.target.value)} /></label>
            <label>{tx("Verlengen met (maanden)")}<input type="number" min="1" max="120" value={lic.renew_months ?? 12} onChange={(e) => field("renew_months", e.target.value)} /></label>
          </div>
          <small className="muted">{tx("De prijs van de licentie is de basisprijs plus de prijs van alles wat in gebruik is (modules, plugins en spelletjes), allemaal incl. btw. Met een prijs boven 0 kunnen beheerders de licentie zelf betalen (Beheer → Licentie).")}</small>
        </section>
        <section className="lic-col">
          <h3>{tx("Prijzen per onderdeel")}</h3>
          <ComponentPrices key={lic.base_price} onTotal={(t) => setLic((x) => ({ ...x, price: t }))} />
        </section>
      </div>
    </div>
  );
}
