// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

import { tx } from "../lib/t";
// Small pill on every page while the sandbox is on (set up in Admin -> Sandbox)
export default function SandboxBadge({ status }) {
  if (!status?.banner) return null;
  return <div className="sandbox-badge" title={tx("Externe koppelingen zijn gesimuleerd")}>SANDBOX</div>;
}
