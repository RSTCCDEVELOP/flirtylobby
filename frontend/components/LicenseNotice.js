// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { usePathname } from "next/navigation";
import { tx } from "../lib/t";

// The system works without a licence, but every page then says so at the bottom.
export default function LicenseNotice({ site }) {
  const path = usePathname() || "/";
  if (!site?.license_missing || path.startsWith("/onderhoud")) return null;
  return <div className="license-note" role="note">{tx("Er is geen Easy2edit licentie in gebruik op deze website.")}</div>;
}
