// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { tx } from "../lib/t";
import Tabs from "./Tabs";
import KitScope from "../lib/ui-kit/KitScope";

// Explains the costs: what the licence price is made of, and that AI is not in it (AI is paid per token and bought in advance).
export default function CostsInfo({ onClose }) {
  const [tab, setTab] = useState("license");
  useEffect(() => {
    const esc = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    document.addEventListener("keydown", esc, true);
    return () => document.removeEventListener("keydown", esc, true);
  }, [onClose]);
  if (typeof document === "undefined") return null;
  const P = ({ children }) => <p style={{ margin: 0 }}>{children}</p>;
  return createPortal(
    <div className="overlay" style={{ zIndex: 3100 }} role="dialog" aria-modal="true" aria-label={tx("Uitleg over de kosten")} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card modal" style={{ maxWidth: 680, width: "100%", padding: "1.6rem 1.8rem" }}>
        <KitScope tag="ui-alerts">
          <div className="e2e-stack" style={{ gap: "1rem" }}>
            <h2 style={{ margin: 0 }}>{tx("Uitleg over de kosten")}</h2>
            <Tabs value={tab} onChange={setTab} tabs={[["license", "Licentie"], ["ai", "AI-kosten"]]} />
            {tab === "license" && (
              <div className="e2e-stack" style={{ gap: ".7rem" }}>
                <P>{tx("De licentie bestaat uit een basisprijs, de onderdelen (modules en plugins) die je gebruikt en eventuele extra backups.")}</P>
                <P>{tx("Het abonnement gaat altijd in op de 1e van de maand. Voor de rest van deze maand betaal je naar rato van het aantal dagen; vanaf de 1e van de volgende maand betaal je de volledige maandprijs.")}</P>
                <P>{tx("Je betaalt per maand, per kwartaal of per jaar, inclusief btw. Zet je later een onderdeel aan of uit, dan verandert de prijs mee.")}</P>
              </div>
            )}
            {tab === "ai" && (
              <div className="e2e-stack" style={{ gap: ".7rem" }}>
                <div className="e2e-alert" role="status"><span className="e2e-alert__icon">i</span><div><strong>{tx("De kosten van AI zijn niet meegerekend in de licentie.")}</strong></div></div>
                <P>{tx("AI wordt per token berekend: hoe meer tekst of beeld je laat maken, hoe meer tokens je gebruikt.")}</P>
                <P>{tx("Tokens koop je vooruit (tegoed). Is je tegoed op, dan kun je AI niet meer gebruiken tot je nieuw tegoed hebt gekocht.")}</P>
              </div>
            )}
            <div className="e2e-row" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="e2e-btn" onClick={onClose}>{tx("Sluiten")}</button>
            </div>
          </div>
        </KitScope>
      </div>
    </div>, document.body);
}
