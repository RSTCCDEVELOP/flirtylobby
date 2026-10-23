// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../lib/t";

// Replaces the Save button: shows that changes are saved by themselves.
export default function SaveStatus({ auto }) {
  const { state, retry } = auto;
  return (
    <span className={`save-status ${state}`} role="status" aria-live="polite">
      {state === "saving" && tx("Opslaan…")}
      {state === "saved" && <>✓ {tx("Opgeslagen")}</>}
      {state === "error" && <>{tx("Niet opgeslagen")} <button type="button" className="btn sm" onClick={retry}>{tx("Opnieuw proberen")}</button></>}
      {state === "idle" && <span className="muted">{tx("Wijzigingen worden automatisch opgeslagen")}</span>}
    </span>
  );
}
