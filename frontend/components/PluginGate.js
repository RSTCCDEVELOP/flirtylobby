// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";
import { LoaderArt } from "./PageLoader";
import Tabs from "./Tabs";
import { IconCheck } from "./Icons";

const eur = (v) => { try { return new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR" }).format(Number(v) || 0); } catch { return `€ ${v}`; } };

// The question when a part that is not installed or not on is clicked in the menu: what it is, what it costs, the steps; "Aanzetten" runs them (with progress) and opens the part.
export default function PluginGate() {
  const router = useRouter();
  const [g, setG] = useState(null);       // {plugin, href, info}
  const [tab, setTab] = useState("cost");
  const [run, setRun] = useState(null);    // {steps: [{key, label, status, text}], busy}
  useEffect(() => {
    const open = (e) => { setG(e.detail); setTab("cost"); setRun(null); };
    window.addEventListener("open-plugin-gate", open);
    return () => window.removeEventListener("open-plugin-gate", open);
  }, []);
  if (!g) return null;
  const d = g.info;
  const close = () => { if (!run?.busy) setG(null); };
  const go = async () => {
    const steps = d.steps.map((s) => ({ ...s, status: "wait", text: "" }));
    setRun({ steps, busy: true });
    const upd = (k, patch) => setRun((r) => ({ ...r, steps: r.steps.map((x) => (x.key === k ? { ...x, ...patch } : x)) }));
    let failed = false;
    for (const s of steps) {
      upd(s.key, { status: "busy" });
      try { await api("/system/plugin-gate/", { method: "POST", body: { plugin: g.plugin, step: s.key } }); upd(s.key, { status: "ok" }); }
      catch (e) { upd(s.key, { status: "err", text: errorText(e) }); failed = true; break; }
    }
    setRun((r) => ({ ...r, busy: false, failed }));
    if (!failed) { window.dispatchEvent(new Event("plugins-changed")); setTimeout(() => { setG(null); window.location.href = g.href; }, 900); }
  };
  const total = run?.steps.length || 0, done = run ? run.steps.filter((x) => x.status === "ok" || x.status === "err").length : 0, pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={tx(d.title)} onClick={close}>
      <div className="card modal adv-run" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: 0 }}>{tx("Webdesign")}{" "}<small className="muted">{tx("staat nog niet aan")}</small></h2>
        {!run && <Tabs value={tab} onChange={setTab} tabs={[["cost", "Kosten", <IconCheck key="c" />], ["steps", "Stappen", <IconCheck key="s" />]]} />}
        {!d.allowed && <div className="alert" role="alert">{tx("Vraag een beheerder met rechten voor de basisgegevens of een superadmin om dit aan te zetten.")}</div>}
        {!run && tab === "cost" && (
          <div style={{ display: "grid", gap: ".7rem" }}>
            <p style={{ margin: 0 }}>{tx("Website ontwerpen laat je een website ontwerpen of een bestaande website inlezen. Om het te gebruiken moet het onderdeel worden geïnstalleerd en aangezet.")}</p>
            <div className="eco-tiles">
              <div className="eco-tile t-green"><span>{tx("Extra per maand")}</span><strong>{eur(d.extra_ex)}</strong><small>{tx("ex btw")} · {eur(d.extra_inc)} {tx("incl. btw")}</small></div>
              <div className="eco-tile t-sun"><span>{tx("Wordt aangezet")}</span><strong style={{ fontSize: "1.1rem" }}>{(d.needs || []).join(", ")}</strong></div>
            </div>
            <small className="muted">{tx("De prijs van je licentie wordt bijgewerkt. Het abonnement gaat in naar rato van de dagen in deze maand.")}</small>
          </div>
        )}
        {!run && tab === "steps" && <ol className="adv-steps">{d.steps.map((s) => <li key={s.key}><span className="adv-dot" /><span><strong>{tx(s.label)}</strong></span></li>)}</ol>}
        {run && (
          <>
            <div className="adv-run-top"><span>{run.busy ? tx("Bezig…") : run.failed ? tx("Klaar, met een fout") : tx("Klaar")}</span><strong>{pct} %</strong></div>
            <div className="adv-run-bar"><div style={{ width: `${Math.max(3, pct)}%` }} /></div>
            <ol className="adv-steps">{run.steps.map((x) => (
              <li key={x.key} className={`st-${x.status}`}><span className="adv-dot">{x.status === "ok" ? "✓" : x.status === "err" ? "!" : x.status === "busy" ? "…" : ""}</span>
                <span><strong>{tx(x.label)}</strong>{x.text && <small className="adv-err">{x.text}</small>}</span></li>
            ))}</ol>
            {run.busy && <div className="dl-anim" aria-hidden="true"><LoaderArt kind="tree" size={40} /></div>}
          </>
        )}
        <div className="row" style={{ justifyContent: "flex-end", gap: ".6rem" }}>
          <button type="button" className="btn" disabled={!!run?.busy} onClick={close}>{run && !run.busy ? tx("Sluiten") : tx("Annuleren")}</button>
          {(!run || run.failed) && d.allowed && <button type="button" className="btn primary" disabled={!!run?.busy} onClick={go}>{run?.failed ? tx("Opnieuw proberen") : tx("Aanzetten en doorgaan")}</button>}
        </div>
      </div>
    </div>
  );
}
