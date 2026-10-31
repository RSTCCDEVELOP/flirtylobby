// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { createPortal } from "react-dom";
import { tx } from "../lib/t";
import { useAuth } from "./AuthContext";
import { answerSandbox, useSandboxFirst } from "../lib/firstRun";

// Superadmin on his own computer, the first question: switch the sandbox on? Then payments, e-mail, sms and the tests of the API links are simulated, so nothing real happens.
export default function SandboxFirstAsk() {
  const { user } = useAuth();
  const { pending } = useSandboxFirst(!!user?.is_staff);
  if (!user?.is_staff || !pending || typeof document === "undefined") return null;
  return createPortal(
    <div className="overlay" role="dialog" aria-modal="true" aria-label={tx("Sandbox-modus")}>
      <div className="card modal form" style={{ maxWidth: 500 }}>
        <h2 style={{ margin: 0 }}>{tx("Sandbox-modus aanzetten?")}</h2>
        <p style={{ margin: 0 }}>{tx("Je werkt op je eigen computer (lokaal). Zet de sandbox aan om veilig te testen: dan worden betalingen, e-mail, sms en de tests van de API-koppelingen alleen gesimuleerd. Er wordt niets echt verstuurd of afgeschreven, ook al staan er echte sleutels (zoals Stripe live) in.")}</p>
        <ul className="ai-howlist">
          <li>{tx("Betalen, ook het kopen van AI-tegoed, gaat via een nagemaakte betaalpagina.")}</li>
          <li>{tx("E-mails en sms'jes worden bewaard in de sandbox, niet verstuurd.")}</li>
          <li>{tx("Je kunt dit altijd aan- of uitzetten bij Admin > Sandbox.")}</li>
        </ul>
        <div className="row" style={{ justifyContent: "flex-end", gap: ".5rem" }}>
          <button type="button" className="btn" onClick={() => answerSandbox(false)}>{tx("Nee, echte koppelingen gebruiken")}</button>
          <button type="button" className="btn primary" onClick={() => answerSandbox(true)}>{tx("Ja, sandbox aanzetten (aanbevolen)")}</button>
        </div>
      </div>
    </div>, document.body);
}
