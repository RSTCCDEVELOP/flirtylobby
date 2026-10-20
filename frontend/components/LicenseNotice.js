"use client";

import { usePathname } from "next/navigation";
import { tx } from "../lib/t";

// The system works without a licence, but every page then says so at the bottom.
export default function LicenseNotice({ site }) {
  const path = usePathname() || "/";
  if (!site?.license_missing || path.startsWith("/onderhoud")) return null;
  return <div className="license-note" role="note">{tx("Er is geen Easy2edit licentie in gebruik op deze website.")}</div>;
}
