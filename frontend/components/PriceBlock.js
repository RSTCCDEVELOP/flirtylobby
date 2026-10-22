"use client";

import { tx } from "../lib/t";

const eur = (v) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(Number(v));

// Prices of a set of modules and plugins: per month, quarter and year (ex VAT, the longer the cheaper), and the estimate for design and implementation. All prices include domain name and hosting.
export default function PriceBlock({ price, period = "", onPeriod = null, purchase = true }) {  // purchase: show what goes to RST (not in the admin)
  if (!price) return null;
  const imp = price.implementation;
  const best = Math.max(...price.periods.map((p) => Number(p.discount)));
  return (
    <div className="pr-block">
      <div className="pr-periods">
        {price.periods.map((p) => {
          const Tag = onPeriod ? "button" : "div";
          return (
            <Tag key={p.key} type={onPeriod ? "button" : undefined} className={`pr-card${period === p.key ? " on" : ""}${onPeriod ? " pick" : ""}`} onClick={onPeriod ? () => onPeriod(p.key) : undefined}>
              {Number(p.discount) > 0 && Number(p.discount) === best && <span className="pr-badge">{tx("Voordeligst")}</span>}
              <span className="pr-label">{tx(p.label)}</span>
              <span className="pr-amount">{eur(p.price)}</span>
              <span className="pr-sub">{eur(p.per_month)} {tx("per maand")}</span>
              <span className="pr-sub">{Number(p.discount) > 0 ? <strong className="pr-save">{p.discount}% {tx("korting")}</strong> : tx("geen korting")}</span>
              <span className="pr-vat">{tx("incl. btw")} {eur(p.price_incl_vat)}</span>
            </Tag>
          );
        })}
      </div>
      {purchase && price.periods[0]?.purchase !== undefined && (
        <div className="pr-buy">
          <div className="pr-buy-head"><strong>{tx("Inkoop")}</strong><small className="muted">{tx("{0}% van de software is voor RST (gebruik van Easy2edit); hosting wordt ingekocht bij DigitalOcean of de eigen server", price.periods[0].rst_share)}</small></div>
          <div className="pr-buy-grid">
            {price.periods.map((p) => (
              <div key={p.key}>
                <span className="pr-label">{tx(p.label)}</span>
                <strong>{eur(p.purchase)}</strong>
                <small className="muted">{tx("winst op software")} {eur(p.margin)}</small>
                {Number(p.hosting_cost) > 0 && <small className="muted">{tx("hosting inkoop")} {eur(p.hosting_cost)} · {tx("winst")} {eur(p.hosting_profit)}</small>}
                <small><strong>{tx("Totale winst")} {eur(Number(p.margin) + Number(p.hosting_profit || 0))}</strong></small>
              </div>
            ))}
          </div>
        </div>
      )}
      {imp && (
        <div className="pr-impl">
          <div className="pr-impl-head">
            <div><strong>{tx("Ontwerp en implementatie")}</strong><small className="muted">{tx("eenmalig, inschatting")} · {imp.hours} {tx("uur")} × {eur(imp.rate)}</small></div>
            <div className="pr-impl-price"><span>{eur(imp.price)}</span><small className="muted">{tx("ex btw")} · {eur(imp.price_incl_vat)} {tx("incl. btw")}</small></div>
          </div>
          <details><summary>{tx("Waar bestaat dit uit?")}</summary>
            <div className="pr-lines">{imp.lines.map((l) => <div key={l.label}><span>{tx(l.label)}</span><span>{l.hours} {tx("uur")}</span></div>)}</div>
          </details>
        </div>
      )}
      <small className="muted">{tx("Alle prijzen zijn exclusief btw en inclusief domeinnaam. Hosting kies je apart. Hoe langer je afsluit, hoe lager de prijs.")}</small>
    </div>
  );
}
