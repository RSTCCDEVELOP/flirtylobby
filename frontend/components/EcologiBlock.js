// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useEcologiOn } from "../lib/ecologi";
import { tx } from "../lib/t";
import Collapsible from "./Collapsible";
import { LineChart } from "./EnergyBlocks";
import { Legend, Meter, SOURCE, StackedBars } from "./EcologiCharts";
import EcologiCosts from "./EcologiCosts";
import EcologiTree, { nextGoal } from "./EcologiTree";
import { IconTree } from "./Icons";
import Loading from "./Loading";

const nf = (n, d = 0) => { try { return new Intl.NumberFormat(undefined, { maximumFractionDigits: d, minimumFractionDigits: 0 }).format(n); } catch { return String(n); } };
const MONTHS = (ym) => { try { return new Date(`${ym}-01T00:00:00`).toLocaleDateString([], { month: "short" }); } catch { return ym; } };
const KEYS = ["visitors", "machine", "user", "admin_gift", "hand"];

const Tile = ({ label, value, sub, tone = "green" }) => (
  <div className={`eco-tile t-${tone}`}>
    <span className="eco-ic" aria-hidden="true"><IconTree /></span><span>{label}</span><strong>{value}</strong>{sub && <small>{sub}</small>}
  </div>
);

// Super admin overview: the block with the figures of Ecologi (trees, use, the maximum per month, graphs). Only while the module and the API are on.
export default function EcologiBlock() {
  const on = useEcologiOn();
  const [d, setD] = useState(null);
  useEffect(() => { if (on) api("/ecologi/stats/?months=12").then(setD).catch(() => setD(false)); }, [on]);
  if (!on) return null;
  const now = d?.now;
  const rows = Object.fromEntries((now?.rows || []).map((r) => [r.key, r]));
  const months = (d?.months || []).map((m) => ({ label: MONTHS(m.month), parts: m.trees }));
  const use = (d?.months || []).map((m) => ({ x: MONTHS(m.month), y: m.views }));
  const co2 = (d?.months || []).map((m) => ({ x: MONTHS(m.month), y: m.co2_kg }));
  const total12 = (d?.months || []).reduce((a, m) => a + m.trees_total, 0);
  const used = (now?.own_total || 0);
  return (
    <Collapsible id="super-ecologi" title={tx("easy2edit: bomen en bijdragen")}>
      {!d ? <p className="muted">{d === false ? tx("De cijfers zijn niet beschikbaar.") : <Loading compact />}</p> : (
        <div className="eco" style={{ display: "grid", gap: "1.1rem" }}>
          <div className="eco-treebox"><EcologiTree value={d.totals.trees} size={110} caption={false} /><div className="eco-treebox-text"><span className="eco-treebox-num">{nf(d.totals.trees)}</span><strong>{tx("Alle bomen van deze website")}</strong><small>{tx("volgende mijlpaal")}: {nf(nextGoal(d.totals.trees))}</small></div></div>
          <div className="eco-tiles">
            <Tile label={tx("Bomen geplant (totaal)")} value={nf(d.totals.trees)} sub={`${nf(total12)} ${tx("de laatste 12 maanden")}`} tone="green" />
            <Tile label={tx("Gebruik deze maand")} value={`${nf(now.usage.views)} ${tx("bezoeken")}`} sub={`${nf(now.usage.kwh, 2)} kWh · ${nf(now.usage.co2_kg, 2)} kg CO2`} tone="sun" />
            <Tile label={tx("Maximum per maand")} value={d.cap ? `${nf(d.cap)} ${tx("bomen")}` : tx("geen limiet")} sub={d.auto_on ? `${tx("Volgende afrekening")}: ${new Date(d.next_settlement).toLocaleDateString()}` : tx("Automatische bijdragen staan uit.")} tone="sand" />
            <Tile label={tx("Door easy2edit geplant")} value={`${nf(d.e2e_trees_month)} ${tx("per maand")}`} sub={tx("Planten we zelf voor deze website.")} tone="sea" />
          </div>
          {d.user_contributes && <div className="alert ok" role="status">{tx("De beheerder draagt zelf ook bij: {0} bomen tot nu toe.", String(d.totals.user_trees))}</div>}
          <div>
            <strong>{tx("Deze maand: bijdrage per bron")}</strong>
            <div style={{ display: "grid", gap: ".35rem", margin: ".5rem 0 .3rem" }}>
              <Meter value={used} max={d.cap || Math.max(used, 1)} />
              <small className="muted">{d.cap ? `${nf(used)} ${tx("van")} ${nf(d.cap)} ${tx("bomen")}` : `${nf(used)} ${tx("bomen")}`}</small>
            </div>
            <div className="eco-tiles three">
              {KEYS.slice(0, 3).map((k) => (
                <Tile key={k} label={tx(SOURCE[k][0])} value={`${nf(rows[k]?.trees || 0)} ${tx("bomen")}`} sub={rows[k]?.cut ? `${nf(rows[k].cut)} ${tx("afgekapt door het maximum")}` : (rows[k]?.on ? tx("aan") : tx("uit"))} tone={k === "visitors" ? "green" : k === "machine" ? "sea" : "sun"} />
              ))}
            </div>
          </div>
          <div className="grid2" style={{ alignItems: "start" }}>
            <div className="eco-panel">
              <strong style={{ fontSize: ".9rem" }}>{tx("Geplante bomen per maand")}</strong>
              <StackedBars months={months} keys={KEYS} label={tx("Geplante bomen per maand")} />
              <Legend keys={KEYS.filter((k) => months.some((m) => m.parts[k]))} />
            </div>
            <div className="eco-panel">
              <strong style={{ fontSize: ".9rem" }}>{tx("Paginabezoeken per maand")}</strong>
              <LineChart points={use} height={150} color="#2f7d5b" format={(v) => nf(v)} label={tx("Paginabezoeken per maand")} />
              <strong style={{ fontSize: ".9rem" }}>{tx("Geschatte CO2 per maand (kg)")}</strong>
              <LineChart points={co2} height={120} color="#7cc59a" format={(v) => `${nf(v, 1)} kg`} label={tx("Geschatte CO2 per maand (kg)")} />
            </div>
          </div>
          <div><strong>{tx("Kosten")}</strong><div style={{ marginTop: ".5rem" }}><EcologiCosts d={d} /></div></div>
          <div className="row" style={{ justifyContent: "flex-start", gap: ".6rem" }}>
            <Link className="btn sm primary" href="/dashboard/superadmin/ecologi">{tx("Ecologi beheren")}</Link>
            <Link className="btn sm" href="/dashboard/superadmin/ecologi?tab=sources">{tx("Bijdragen instellen")}</Link>
          </div>
        </div>
      )}
    </Collapsible>
  );
}
