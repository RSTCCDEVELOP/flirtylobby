// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";
import { useAuth } from "./AuthContext";
import { useModules } from "./Modules";
import Tabs from "./Tabs";
import AiCreditPopup from "./AiCreditPopup";
import { money } from "./AiCharts";

// The first time someone logs in as an admin (or superadmin): how the AI works, that credit is needed first, and (superadmin) the AI credit settings to put in place.
export default function AiWelcome() {
  const { user } = useAuth();
  const mods = useModules();
  const [me, setMe] = useState(null);
  const [cr, setCr] = useState(null);
  const [stripe, setStripe] = useState(null);
  const [tab, setTab] = useState("how");
  const [buy, setBuy] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    if (!user || mods.ai === false) return;
    api("/ai/me/").then((i) => { if (i.welcome) setMe(i); }).catch(() => {});
  }, [user, mods.ai]);
  useEffect(() => {
    if (!me?.is_staff) return;
    api("/admin/ai/credit/").then(setCr).catch(() => {});
    api("/admin/ai/pay-status/").then(setStripe).catch(() => setStripe({ via: "sandbox" }));
  }, [me]);
  if (!me) return null;
  const done = async () => { try { await api("/ai/me/welcome/", { method: "POST", body: {} }); } catch {} setMe(null); };
  const save = async (body) => { try { setCr(await api("/admin/ai/credit/", { method: "POST", body })); setMsg(null); } catch (e) { setMsg({ ok: false, text: errorText(e) }); } };
  const cur = me.currency;
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) done(); }}>
      <div className="card modal form pgs" role="dialog" aria-label={tx("AI en AI-tegoed")} style={{ maxWidth: 640 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>{tx("Welkom: AI en AI-tegoed")}</h2>
          <button type="button" className="btn primary" onClick={done}>{tx("Klaar")}</button>
        </div>
        <Tabs value={tab} onChange={setTab} tabs={[["how", "Hoe werkt AI"], [me.is_staff ? "set" : "mine", me.is_staff ? "Tegoed instellen" : "Jouw tegoed"]]} />
        <div className="pgs-body">
          {tab === "how" && (<>
            <p style={{ margin: 0 }}>{tx("Easy2edit gebruikt AI (Claude) voor onder meer vertalen, teksten en het importeren van een website. Elke AI-opdracht kost tokens; wat dat kost, zie je per aanroep.")}</p>
            <ul className="ai-howlist">
              <li><strong>{tx("Eerst tegoed")}:</strong> {tx("gebruikers en admins kunnen AI pas gebruiken als ze AI-tegoed hebben gekocht. Zonder tegoed gebeurt er niets en krijg je een melding.")}</li>
              <li><strong>{tx("Bij elke opdracht gecontroleerd")}:</strong> {tx("vóór elke AI-opdracht wordt ingeschat wat die kost en gekeken of je tegoed genoeg is. Is het niet genoeg, dan wordt de opdracht niet gestart en zie je hoeveel je nodig hebt.")}</li>
              <li><strong>{tx("Afboeken")}:</strong> {me.is_staff ? tx("na de opdracht wordt het echte bedrag (tokens in en uit, met marge) van je tegoed afgehaald.") : tx("na de opdracht wordt het echte bedrag (tokens in en uit) van je tegoed afgehaald.")}</li>
              <li><strong>{tx("Opwaarderen")}:</strong> {tx("kies met een schuifbalk een bedrag en betaal veilig via Stripe. Daarna staat het tegoed direct klaar.")}</li>
              <li><strong>{tx("Superadmins")}:</strong> {tx("hebben geen tegoed nodig en beheren het tegoed: schakelaar, bedragen en bijschrijven per gebruiker.")}</li>
            </ul>
          </>)}
          {tab === "mine" && !me.is_staff && (<>
            <p style={{ margin: 0 }}>{tx("Jouw AI-tegoed")}: <strong>{money(me.balance, cur)}</strong>. {me.credit_required ? tx("Je hebt tegoed nodig om AI te gebruiken.") : tx("Tegoed is nu niet verplicht.")}</p>
            <p className="muted" style={{ margin: 0 }}>{tx("De afgelopen 30 dagen gebruikte je")} {money(me.proposal.used_month, cur)}. {tx("Je kunt nu alvast opwaarderen.")}</p>
            <div className="row" style={{ justifyContent: "flex-start" }}><button type="button" className="btn primary" onClick={() => setBuy(true)}>{tx("Opwaarderen")}</button></div>
          </>)}
          {tab === "set" && me.is_staff && (cr ? (<>
            <p className="muted" style={{ margin: 0 }}>{tx("Zo staat het AI-tegoed nu ingesteld. Alles is later aan te passen bij Super admin → AI.")}</p>
            <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={cr.credit_required} onChange={(e) => save({ credit_required: e.target.checked })} /><span /></span><span>{tx("Gebruikers en admins moeten AI-tegoed kopen om AI te kunnen gebruiken")}</span></label>
            <div className="grid2">
              {[["topup_min", "Kleinste bedrag"], ["topup_max", "Grootste bedrag"], ["topup_step", "Stap van de schuifbalk"]].map(([k, l]) => (
                <label key={k}>{tx(l)} ({cr.currency})<input type="number" min="0" step="0.5" defaultValue={cr[k]} onBlur={(e) => { if (Number(e.target.value) !== cr[k]) save({ [k]: e.target.value }); }} /></label>))}
            </div>
            <div className={stripe && stripe.via !== "sandbox" ? "alert ok" : "alert"} style={{ margin: 0 }}>
              {tx("Betalen via")} <strong>Stripe</strong>: {stripe?.via === "link" ? `${tx("de Easy2edit-koppeling")} "${stripe.name}".` : stripe?.via === "license" ? tx("het Stripe-account van de licentie.") : tx("nog niet gekoppeld. Zet bij API keys een Stripe-koppeling aan en vink Superadmin-koppeling aan; anders kan er alleen via de sandbox worden betaald.")}
            </div>
            {msg && <div className="alert">{msg.text}</div>}
            <div className="row" style={{ justifyContent: "flex-start", gap: ".5rem" }}>
              <Link className="btn" href="/dashboard/superadmin/ai" onClick={done}>{tx("Alle AI-instellingen (marges en prijzen)")}</Link>
            </div>
          </>) : <p className="muted">{tx("Laden…")}</p>)}
        </div>
      </div>
      {buy && <AiCreditPopup info={me} onClose={() => setBuy(false)} />}
    </div>
  );
}
