// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { Busy } from "../../../components/PageLoader";
import { useEffect, useState } from "react";
import { api, errorText } from "../../../lib/api";
import DashHero from "../../../components/DashHero";
import { money } from "../../../lib/format";
import { tx } from "../../../lib/t";

// A member's own donations.
export default function MyDonations() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [rewards, setRewards] = useState([]);
  useEffect(() => { api("/subscriptions/me/").then((d) => setRewards(d.rewards || [])).catch(() => {}); }, []);
  useEffect(() => { api("/donations/mine/").then(setRows).catch((e) => { setRows([]); setError(errorText(e)); }); }, []);
  const total = (rows || []).filter((d) => d.status === "paid").reduce((a, d) => a + Number(d.amount), 0);
  return (
    <>
      <DashHero title="Mijn donaties" textId="page.my-donations.intro" actions={[{ href: "/doneren", label: "Opnieuw doneren" }, { href: "/dashboard/subscriptions", label: "Mijn abonnementen" }]}
        stats={[
          { label: "Totaal gedoneerd", value: rows ? money(total, "EUR") : null },
          { label: "Aantal donaties", value: rows ? rows.filter((d) => d.status === "paid").length : null },
          { label: "Laatste donatie", value: rows?.find((d) => d.status === "paid") ? new Date(rows.find((d) => d.status === "paid").paid_at || 0).toLocaleDateString() : "—" },
          { label: "Actieve voordelen", value: rewards.length, hint: tx("dankzij je donaties") },
        ]} />
      {rewards.length > 0 && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <strong>{tx("Wat je ervoor hebt gekregen")}</strong>
          <ul className="sub-grants" style={{ marginTop: ".5rem" }}>
            {rewards.map((r) => <li key={r.id}>{tx(r.label)}{r.until ? ` · ${tx("tot")} ${new Date(r.until).toLocaleString()}` : ""}{r.uses_left !== null && r.uses_left !== undefined ? ` · ${r.uses_left} ${tx("keer over")}` : ""}</li>)}
          </ul>
        </div>
      )}
      {error && <div className="alert">{error}</div>}
      {rows === null ? <Busy /> : !rows.length ? <p className="muted">{tx("Je hebt nog niet gedoneerd.")}</p> : (
        <>
          <div className="card" style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>{tx("Actie")}</th><th>{tx("Datum")}</th><th>{tx("Status")}</th><th>{tx("Bedrag")}</th></tr></thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id}><td><strong>{d.campaign}</strong></td><td>{new Date(d.paid_at || d.created_at).toLocaleDateString()}</td><td><span className="badge">{tx(d.status_label)}</span></td><td>{money(d.amount, "EUR")}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
