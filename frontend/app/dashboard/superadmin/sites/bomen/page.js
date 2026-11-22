// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import EcologiTree, { nextGoal } from "../../../../../components/EcologiTree";
import Loading from "../../../../../components/Loading";
import PlusLock from "../../../../../components/PlusLock";
import { SiteView } from "../../../../../components/SiteDetails";
import { useAuth } from "../../../../../components/AuthContext";
import { api, errorText } from "../../../../../lib/api";
import { tx } from "../../../../../lib/t";

const eur = (v) => { try { return new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR" }).format(v || 0); } catch { return `€ ${v}`; } };
const num = (v) => Number(v || 0).toLocaleString();

// Super admin+ on the easy2edit server: tree planting of every website and every company (what is on, the trees, the costs and the expected costs).
export default function SiteTreesOverview() {
  const { user } = useAuth();
  const plus = !!(user?.is_superadmin_plus);
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [view, setView] = useState(null);
  const load = (refresh) => { setErr(""); api(`/system/sites-trees/${refresh ? "?refresh=1" : ""}`).then(setD).catch((e) => setErr(errorText(e))); };
  useEffect(() => { if (plus) load(false); }, [plus]);
  if (!plus) return <p className="muted">{tx("Dit onderdeel is alleen voor een superadmin+.")} <PlusLock /></p>;
  const t = d?.totals;
  return (
    <div className="eco">
      <h1>{tx("Bomen planten: alle websites")}</h1>
      <p className="muted" style={{ marginTop: 0 }}>{tx("Per bedrijf en per website: wat aan staat, hoeveel bomen er zijn geplant en wat het kost en gaat kosten. Een website komt hier zodra de onboarding is afgerond of bomen planten wordt aangezet.")} <Link href="/dashboard/superadmin/sites">{tx("Site manager")}</Link></p>
      {err && <div className="alert" role="alert">{err}</div>}
      {!d && !err ? <Loading compact /> : d && (
        <div style={{ display: "grid", gap: "1rem" }}>
          <div className="eco-treebox"><EcologiTree value={t.trees} size={96} caption={false} />
            <div className="eco-treebox-text"><span className="eco-treebox-num">{num(t.trees)}</span><strong>{tx("Bomen geplant, alle websites")}</strong><small>{tx("volgende mijlpaal")}: {num(nextGoal(t.trees))}</small></div></div>
          <div className="eco-tiles">
            <div className="eco-tile t-green"><span>{tx("Websites met bomen planten aan")}</span><strong>{t.on} / {t.sites}</strong></div>
            <div className="eco-tile t-sun"><span>{tx("Verwachte kosten deze maand")}</span><strong>{eur(t.month_estimate)}</strong><small>{tx("Geschat per jaar")}: {eur(t.year_estimate)}</small></div>
            <div className="eco-tile t-sand"><span>{tx("Betaald, laatste 12 maanden")}</span><strong>{eur(t.total_12)}</strong></div>
            <div className="eco-tile t-sea"><span>{tx("Totaal gedoneerd")}</span><strong>{eur(t.donated)}</strong></div>
          </div>
          {d.companies.map((c) => (
            <div key={c.id} className="eco-panel">
              <div className="eco-forecast-head"><div><strong>{tx(c.name)}</strong><br /><small className="muted">{c.totals.sites} {tx("websites")} · {num(c.totals.trees)} {tx("bomen")}</small></div>
                <div className="eco-forecast-total"><small>{tx("Verwacht per maand")}</small><strong>{eur(c.totals.month_estimate)}</strong></div></div>
              <div className="table-wrap" style={{ border: 0 }}>
                <table>
                  <thead><tr><th>{tx("Website")}</th><th>{tx("Status")}</th><th style={{ textAlign: "right" }}>{tx("Bomen")}</th><th style={{ textAlign: "right" }}>{tx("Gedoneerd")}</th><th style={{ textAlign: "right" }}>{tx("Per maand")}</th><th style={{ textAlign: "right" }}>{tx("Per jaar")}</th><th /></tr></thead>
                  <tbody>
                    {c.sites.map((s) => (
                      <tr key={s.id}>
                        <td><strong>{s.name}</strong><br /><small className="muted">{String(s.url || "").replace(/^https?:\/\//, "")}</small></td>
                        <td>{!s.ok ? <span className="badge warn" title={s.error}>{tx("Geen antwoord")}</span> : <span className={`badge ${s.enabled ? "ok" : ""}`}>{s.enabled ? tx("Aan") : tx("Uit")}</span>}{s.ok && s.settings?.test_mode && s.enabled ? <> <span className="badge">{tx("test")}</span></> : null}</td>
                        <td style={{ textAlign: "right" }}>{s.ok ? num(s.totals?.trees) : "–"}</td>
                        <td style={{ textAlign: "right" }}>{s.ok ? eur(s.totals?.donated) : "–"}</td>
                        <td style={{ textAlign: "right" }}>{s.ok && s.enabled ? eur(s.costs?.month_estimate) : "–"}</td>
                        <td style={{ textAlign: "right" }}>{s.ok && s.enabled ? eur(s.costs?.year_estimate) : "–"}</td>
                        <td style={{ textAlign: "right" }}><button type="button" className="btn sm" onClick={() => setView(s)}>{tx("Beheren")}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <div><button type="button" className="btn sm" onClick={() => load(true)}>{tx("Vernieuwen")}</button> <small className="muted">{tx("Bijgewerkt")}: {new Date(d.generated_at).toLocaleString()}</small></div>
        </div>
      )}
      {view && <SiteView site={view} initialTab="trees" onClose={() => setView(null)} />}
    </div>
  );
}
