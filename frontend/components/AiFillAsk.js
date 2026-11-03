// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { createPortal } from "react-dom";
import { tx } from "../lib/t";

// After a standard installation has been set: do you want to fill the website with AI? Yes: straight to buying AI credit (then Site importeren and the AI tools are ready to use).
export default function AiFillAsk({ onNo, linked = true }) {
  const yes = () => { window.location.href = linked ? "/dashboard/ai?buy=1" : "/dashboard/admin/integrations"; };
  const body = (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={tx("Website vullen met AI")}>
      <div className="card modal form" style={{ maxWidth: 480 }}>
        <h2 style={{ margin: 0 }}>{tx("De website met AI vullen?")}</h2>
        <p style={{ margin: 0 }}>{tx("De installatie is klaar. Wil je AI gebruiken om de website te vullen, bijvoorbeeld door een bestaande website of ontwerp te importeren, teksten te schrijven en alles te vertalen?")}</p>
        {linked
          ? <small className="muted">{tx("Daarvoor heb je AI-tegoed nodig. Kies je ja, dan ga je direct naar het opwaarderen van je AI-tegoed.")}</small>
          : <small className="muted">{tx("Er is nog geen AI-koppeling (Claude). Zet eerst de koppeling aan bij API keys; daarna kun je je AI-tegoed opwaarderen. Een superadmin kan de koppeling voor alle sites instellen.")}</small>}
        <div className="row" style={{ justifyContent: "flex-end", gap: ".5rem" }}>
          <button type="button" className="btn" onClick={onNo}>{tx("Nee, later")}</button>
          <button type="button" className="btn primary" onClick={yes}>{linked ? tx("Ja, AI-tegoed opwaarderen") : tx("Naar API keys: AI-koppeling instellen")}</button>
        </div>
      </div>
    </div>
  );
  return typeof document === "undefined" ? null : createPortal(body, document.body);
}
