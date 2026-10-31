// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { tx } from "../lib/t";
import { useSession } from "./Session";
import { BarList, Columns, Donut, GROUP_COLOR, Legend, Stacked, money, num, short } from "./AiCharts";

const PERIODS = [["day", "24 uur"], ["week", "7 dagen"], ["month", "30 dagen"], ["quarter", "90 dagen"], ["year", "Jaar"]];
const GROUP_NAME = { user: "Gebruiker", admin: "Admin", super: "Superadmin", system: "Systeem" };

// A part of the AI dashboard (Super admin → AI) as a block on a page: block = kpis, time, groups, where, askers, cost_users, models or hours. Only superadmins see the figures.
export default function AiBlock({ block }) {
  const { user, editing } = useSession();
  const [period, setPeriod] = useState("month");
  const [d, setD] = useState(null);
  const [denied, setDenied] = useState(false);
  useEffect(() => {
    if (!user?.is_staff) return;
    setDenied(false);
    api(`/admin/ai/overview/?period=${period}`).then(setD).catch(() => setDenied(true));
  }, [user?.is_staff, period]);
  if (!user?.is_staff) return editing ? <div className="card muted">{tx("AI-blok: alleen zichtbaar voor superadmins.")}</div> : null;
  if (denied) return null;
  if (!d) return <div className="card muted">{tx("Laden…")}</div>;
  const cur = d.currency, cc = d.cost_currency, m = (n) => money(n, cur), t = d.totals;
  const head = (title) => (
    <div className="row" style={{ justifyContent: "space-between", gap: ".6rem" }}>
      <strong>{tx(title)}</strong>
      <select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label={tx("Periode")} style={{ width: "auto" }}>{PERIODS.map(([k, l]) => <option key={k} value={k}>{tx(l)}</option>)}</select>
    </div>
  );
  if (block === "kpis") {
    return (
      <div className="card ai-block">{head("AI: kengetallen")}
        <div className="ai-kpis">
          {[[tx("Aanroepen"), num(t.calls)], [tx("Tokens in"), short(t.tokens_in)], [tx("Tokens uit"), short(t.tokens_out)], [tx("Kosten (inkoop)"), money(t.cost, cc)], [tx("In rekening gebracht"), m(t.charged)], [tx("Marge"), m(t.margin)]].map(([l, v]) => <div key={l}><small className="muted">{l}</small><strong>{v}</strong></div>)}
        </div>
      </div>
    );
  }
  if (block === "time") return <div className="card ai-block">{head("AI: kosten in de tijd")}<Legend /><Stacked series={d.series} metric="charged" format={(v) => (v >= 1 ? short(v) : v.toFixed(2))} /></div>;
  if (block === "groups") {
    return (
      <div className="card ai-block">{head("AI: gebruik per groep")}
        <Donut rows={d.by_group.map((r) => ({ key: r.group, label: tx(r.name), value: r.calls }))} />
        <BarList rows={d.by_group.map((r) => ({ label: tx(r.name), value: r.charged, color: GROUP_COLOR[r.group], sub: `${num(r.calls)} ${tx("aanroepen")}` }))} format={m} />
      </div>
    );
  }
  if (block === "where") return <div className="card ai-block">{head("AI: waar wordt het gebruikt")}<BarList rows={d.by_source.map((r) => ({ label: tx(r.source), value: r.calls, sub: `${short(r.tokens_in + r.tokens_out)} tokens · ${m(r.charged)}` }))} /></div>;
  if (block === "askers") return <div className="card ai-block">{head("AI: veel vragers")}<BarList rows={[...d.by_user].sort((a, b) => b.calls - a.calls).slice(0, 10).map((r) => ({ label: r.user, value: r.calls, color: GROUP_COLOR[r.group], sub: `${tx(GROUP_NAME[r.group])} · ${m(r.charged)}` }))} /></div>;
  if (block === "cost_users") return <div className="card ai-block">{head("AI: hoogste kosten")}<BarList rows={d.by_user.slice(0, 10).map((r) => ({ label: r.user, value: r.charged, color: GROUP_COLOR[r.group], sub: `${num(r.calls)} ${tx("aanroepen")}` }))} format={m} /></div>;
  if (block === "models") return <div className="card ai-block">{head("AI: modellen")}<BarList rows={d.by_model.map((r) => ({ label: r.model, value: r.calls, sub: `${short(r.tokens_in)} in · ${short(r.tokens_out)} uit · ${m(r.charged)}` }))} /></div>;
  if (block === "hours") return <div className="card ai-block">{head("AI: drukte per uur")}<Columns values={d.hours} labels={d.hours.map((_, i) => String(i))} /></div>;
  return null;
}
