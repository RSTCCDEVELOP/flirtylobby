// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";
import { useAuth } from "./AuthContext";
import EcologiTree from "./EcologiTree";
import Loading from "./Loading";
import Tabs from "./Tabs";
import { IconCheck, IconTree } from "./Icons";

const money = (n, cur = "EUR") => { try { return new Intl.NumberFormat(undefined, { style: "currency", currency: cur || "EUR" }).format(n || 0); } catch { return `${cur} ${n}`; } };

// Onboarding step "bomen planten met easy2edit": what it is, what it costs, and the choice (on or off). Yes switches the standard contributions on (in test mode until the
// owner switches that off) and links the website with the easy2edit server, where tree planting is managed per website and company.
export default function TreesWelcome() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("what");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!user?.is_staff) return undefined;
    const show = () => api("/ecologi/onboarding/").then((r) => { setD(r); setOpen(true); setTab("what"); }).catch(() => {});
    window.addEventListener("open-trees-welcome", show);
    return () => window.removeEventListener("open-trees-welcome", show);
  }, [user?.is_staff]);
  if (!open) return null;
  const answer = async (choice) => {
    setBusy(true); setErr("");
    try { await api("/ecologi/onboarding/", { method: "POST", body: { choice } }); setOpen(false); window.dispatchEvent(new Event("setup-saved")); }
    catch (e) { setErr(errorText(e)); }
    setBusy(false);
  };
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={tx("Bomen planten met easy2edit")}>
      <div className="card modal eco" style={{ width: "min(640px, 96vw)", display: "grid", gap: ".9rem", maxHeight: "92vh", overflow: "auto" }}>
        <div className="row" style={{ justifyContent: "flex-start", gap: "1rem", alignItems: "center" }}>
          <EcologiTree value={0} size={64} caption={false} />
          <div><h2 style={{ margin: 0 }}>{tx("Bomen planten met easy2edit")}</h2><small className="muted">{tx("Onboarding")} · {tx("optioneel")}</small></div>
        </div>
        <Tabs value={tab} onChange={setTab} tabs={[["what", "Wat is het", <IconTree key="w" />], ["cost", "Kosten", <IconCheck key="c" />]]} />
        {err && <div className="alert" role="alert">{err}</div>}
        {!d ? <Loading compact /> : tab === "what" ? (
          <div style={{ display: "grid", gap: ".7rem" }}>
            <p style={{ margin: 0 }}>{tx("Laat je website bomen planten. Bezoekers, het energiegebruik en jouw eigen bijdrage planten samen bomen. In het energievenster onderaan je website zien bezoekers hoeveel bomen er zijn geplant, met een groene boom en een link naar meer informatie.")}</p>
            <ul className="eco-steps">
              <li>{tx("Je stelt zelf in voor welke functie van easy2edit je bomen plant, en een maximum per maand.")}</li>
              <li>{tx("Het begint in testmodus: er wordt niets gekocht totdat jij dat zelf aanzet.")}</li>
              <li>{tx("Je website wordt gekoppeld met de easy2edit-server, die het planten per website en per bedrijf beheert en overzichten maakt.")}</li>
            </ul>
            {!d.linked && <div className="alert" role="status">{tx("Er is nog geen koppeling met Ecologi. Maak die later bij Admin → API keys → Ecologi; tot die tijd wordt er niets geplant.")} <Link href="/dashboard/admin/integrations">{tx("API keys")}</Link></div>}
          </div>
        ) : (
          <div style={{ display: "grid", gap: ".7rem" }}>
            <div className="eco-tiles">
              <div className="eco-tile t-green"><span>{tx("Prijs per boom")}</span><strong>{money(d.per_tree, d.currency)}</strong><small>{tx("Ecologi factureert per maand achteraf")}</small></div>
              <div className="eco-tile t-sun"><span>{tx("Beheer en overzicht")}</span><strong>{money(d.service_fee, d.currency)}</strong><small>{tx("per maand, ex btw (bij je licentie)")}</small></div>
            </div>
            <div className="eco-rows">{d.examples.map((x) => <div key={x.trees} className="eco-row"><span>{x.trees} {tx("bomen per maand")}</span><b>{money(x.amount, d.currency)}</b></div>)}</div>
            <small className="muted">{tx("De kosten van de bomen komen bovenop de prijs van je licentie. Je bepaalt zelf het aantal en het maximum; de kosten staan altijd in het overzicht.")}</small>
          </div>
        )}
        <div className="row" style={{ justifyContent: "flex-end", gap: ".6rem", flexWrap: "wrap" }}>
          <button type="button" className="btn" disabled={busy} onClick={() => answer("no")}>{tx("Nu niet")}</button>
          <button type="button" className="btn primary" disabled={busy || !d} onClick={() => answer("yes")}>{busy ? tx("Bezig…") : tx("Ja, bomen planten")}</button>
        </div>
      </div>
    </div>
  );
}
