// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { tx } from "../lib/t";
import { useSession } from "./Session";

// The buttons of the page "Content niet beschikbaar": back to the home page; and Inloggen for a visitor who is not logged in (it leads back to the address that was asked for).
export default function ForbiddenActions() {
  const { user } = useSession();
  const next = useSearchParams()?.get("next") || "";
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : "";
  return (
    <div style={{ display: "flex", gap: ".7rem", flexWrap: "wrap", justifyContent: "center" }}>
      <Link href="/" className="btn primary">{tx("Terug naar de homepage")}</Link>
      {!user && <Link href={safe ? `/login?next=${encodeURIComponent(safe)}` : "/login"} className="btn">{tx("Inloggen")}</Link>}
    </div>
  );
}
