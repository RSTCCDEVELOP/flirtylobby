// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { tx } from "../lib/t";
import { useAuth } from "./AuthContext";
import { answerManual, useSandboxFirst } from "../lib/firstRun";
import ManualPopup from "./ManualPopup";

// A superadmin who starts Easy2edit for the first time (or after the installation): do you want to look at the manual? Yes: the HTML manual opens in a pop-up.
export default function ManualFirstAsk() {
  const { user } = useAuth();
  const { sandboxPending, manualPending, known } = useSandboxFirst(!!user?.is_staff);
  const [open, setOpen] = useState(false);
  if (!user?.is_staff || !known || typeof document === "undefined") return null;
  if (open) return <ManualPopup page="index.html" onClose={() => setOpen(false)} />;
  if (sandboxPending || !manualPending) return null;
  const yes = async () => { await answerManual(); setOpen(true); };
  return createPortal(
    <div className="overlay" role="dialog" aria-modal="true" aria-label={tx("Handleiding")}>
      <div className="card modal form" style={{ maxWidth: 480 }}>
        <h2 style={{ margin: 0 }}>{tx("Welkom bij Easy2edit")}</h2>
        <p style={{ margin: 0 }}>{tx("Wil je de handleiding bekijken? Daarin staat hoe je een website opbouwt, importeert, beheert en met AI vult. Je opent hem later altijd met de knop Hulp.")}</p>
        <small className="muted">{tx("De handleiding is in het Engels, met schermafbeeldingen.")}</small>
        <div className="row" style={{ justifyContent: "flex-end", gap: ".5rem" }}>
          <button type="button" className="btn" onClick={() => answerManual()}>{tx("Nee, niet nu")}</button>
          <button type="button" className="btn primary" onClick={yes}>{tx("Ja, handleiding openen")}</button>
        </div>
      </div>
    </div>, document.body);
}
