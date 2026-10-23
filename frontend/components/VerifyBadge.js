// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

import { tx } from "../lib/t";
// Verification status of a member: open (not checked), checked, verified. Colours follow the theme (primary + secondary).
export const VERIFY = {
  open: { label: "Open", hint: "Nog niet gecontroleerd" },
  checked: { label: "Gecontroleerd", hint: "Dit profiel is gecontroleerd" },
  verified: { label: "Geverifieerd", hint: "De identiteit van dit lid is geverifieerd" },
};

export default function VerifyBadge({ status = "open", size = 18, label = false, hideOpen = false }) {
  const v = VERIFY[status] || VERIFY.open;
  if (hideOpen && (status || "open") === "open") return null;
  const s = status in VERIFY ? status : "open";
  const color = s === "verified" ? "var(--orange)" : s === "checked" ? "var(--blue)" : "var(--muted)";
  return (
    <span className={`verify verify-${s}`} title={`${tx(v.label)}: ${tx(v.hint)}`} style={{ color }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {s === "open" && <circle cx="12" cy="12" r="9" strokeDasharray="3 3" />}
        {s === "checked" && <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 9.5" /></>}
        {s === "verified" && <><path d="M12 2.5l2.3 1.7 2.8-.1.9 2.7 2.3 1.6-.9 2.7.9 2.7-2.3 1.6-.9 2.7-2.8-.1L12 21.5l-2.3-1.7-2.8.1-.9-2.7L3.7 15.6l.9-2.7-.9-2.7L6 8.6l.9-2.7 2.8.1z" fill="currentColor" fillOpacity=".15" /><path d="M8.5 12.2l2.5 2.5 4.5-4.7" /></>}
      </svg>
      {label && <span className="verify-label">{tx(v.label)}</span>}
      {!label && <span className="sr-only">{tx(v.label)}</span>}
    </span>
  );
}
