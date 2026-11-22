// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../lib/t";

const money = (n, cur = "EUR") => { try { return new Intl.NumberFormat(undefined, { style: "currency", currency: cur || "EUR" }).format(n || 0); } catch { return `${cur} ${(n || 0).toFixed(2)}`; } };
const MONTH = (ym) => { try { return new Date(`${ym}-01T00:00:00`).toLocaleDateString([], { month: "short" }); } catch { return ym; } };

// Cost overview of Ecologi: what was paid per month (real orders), what this month and the year will cost (estimate), per source. Ecologi bills the owner of the link monthly.
export default function EcologiCosts({ d }) {
  const c = d?.costs;
  if (!c) return null;
  const cur = c.currency;
  const months = d.months || [];
  const max = Math.max(1, ...months.map((m) => m.cost), c.month_estimate);
  return (
    <div className="eco-costs">
      <div className="eco-panel eco-forecast">
        <div className="eco-forecast-head"><div><strong>{tx("Verwachte kosten deze maand, per onderdeel")}</strong><br /><small className="muted">{tx("Gebaseerd op het gebruik tot nu toe en je instellingen")} · {money(c.per_tree, cur)} {tx("per boom")}{c.local ? ` · ${tx("lokaal planten")}` : ""}</small></div><div className="eco-forecast-total"><small>{tx("Totaal verwacht")}</small><strong>{money(c.month_estimate, cur)}</strong></div></div>
        {[["auto", "Automatisch (gebruik)"], ["user", "Bijdragen van de gebruiker"]].map(([g, l]) => (
          <div key={g} className="eco-rows">
            <small className="eco-group">{tx(l)}</small>
            {c.parts.filter((x) => x.group === g).map((x) => (
              <div key={x.key} className={`eco-part${x.on ? "" : " off"}`}>
                <span className="eco-part-name">{x.name.startsWith("Beheerder: ") ? `${tx("Beheerder")}: ${tx(x.name.slice(11))}` : tx(x.name)}</span>
                <span className="eco-part-bar"><i style={{ width: `${c.month_estimate ? Math.max(x.amount ? 3 : 0, (x.amount / c.month_estimate) * 100) : 0}%` }} /></span>
                <span className="eco-part-trees">{x.trees} {tx("bomen")}</span>
                <b>{x.on ? money(x.amount, cur) : tx("uit")}</b>
              </div>
            ))}
          </div>
        ))}
        {c.cut_trees > 0 && <small className="muted">{c.cut_trees} {tx("bomen")} ({money(c.cut_saved, cur)}) {tx("bespaard door het maximum")}.</small>}
        <small className="muted">{tx("Door easy2edit geplant (komt niet op jouw rekening)")}: {money(c.e2e_month, cur)}. {tx("Ecologi factureert maandelijks de eigenaar van de koppeling; de bedragen zijn een indicatie.")}</small>
      </div>
      <div className="eco-tiles">
        <div className="eco-tile t-green"><span>{tx("Geschatte kosten deze maand")}</span><strong>{money(c.month_estimate, cur)}</strong><small>{tx("al betaald")}: {money(c.this_month_paid, cur)}</small></div>
        <div className="eco-tile t-sun"><span>{tx("Geschat per jaar")}</span><strong>{money(c.year_estimate, cur)}</strong><small>{tx("bij hetzelfde gebruik als deze maand")}</small></div>
        <div className="eco-tile t-sand"><span>{tx("Betaald, laatste 12 maanden")}</span><strong>{money(c.total_12, cur)}</strong><small>{tx("gemiddeld")} {money(c.avg3, cur)} {tx("per maand")}</small></div>
        <div className="eco-tile t-sea"><span>{tx("Hoogste kosten per maand")}</span><strong>{c.max_month != null ? money(c.max_month, cur) : tx("geen limiet")}</strong><small>{tx("het maximum aantal bomen maal de prijs")}</small></div>
      </div>
      <div className="eco-panel">
        <strong>{tx("Kosten per maand")}</strong>
        <div className="eco-bars" role="img" aria-label={tx("Kosten per maand")}>
          {months.map((m, i) => {
            const last = i === months.length - 1;
            const v = last ? Math.max(m.cost, c.month_estimate) : m.cost;
            return (
              <div key={m.month} className="eco-bar" title={`${MONTH(m.month)}: ${money(m.cost, cur)}${last ? ` (${tx("geschat")} ${money(c.month_estimate, cur)})` : ""}`}>
                <em style={{ height: `${Math.max(3, (v / max) * 100)}%` }} className={last ? "est" : ""} />
                <span>{MONTH(m.month)}</span>
              </div>
            );
          })}
        </div>
        <small className="muted">{tx("Gestreept: geschat voor de lopende maand.")}</small>
        <div className="eco-rows">
          {[...months].reverse().map((m, i) => (
            <div key={m.month} className="eco-row eco-month"><span>{new Date(`${m.month}-01T00:00:00`).toLocaleDateString([], { month: "long", year: "numeric" })}</span><span className="muted">{m.trees_total} {tx("bomen")}</span><b>{i === 0 ? `${money(Math.max(m.cost, c.month_estimate), cur)} (${tx("geschat")})` : money(m.cost, cur)}</b></div>
          ))}
        </div>
      </div>
    </div>
  );
}
