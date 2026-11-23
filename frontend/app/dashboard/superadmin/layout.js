// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../../../components/AuthContext";
import { tx } from "../../../lib/t";

// Super admin area: superadmins only. Anybody else gets a clear "no access" screen (never the home page or a silent jump somewhere else).
export default function SuperAdminLayout({ children }) {
  const { user } = useAuth();
  const path = usePathname();
  if (user?.is_staff || (user?.demo_switch && path?.startsWith("/dashboard/superadmin/modules"))) return children;  // (demo mode: a demo account may switch the modules on and off)
  return (
    <div className="card" role="alert" style={{ maxWidth: 560, margin: "3rem auto", display: "grid", gap: ".8rem", textAlign: "center" }}>
      <h1 style={{ margin: 0 }}>{tx("Geen toegang")}</h1>
      <p className="muted" style={{ margin: 0 }}>{tx("Dit onderdeel is alleen voor een superadmin van deze website.")}</p>
      <div className="row" style={{ justifyContent: "center", gap: ".6rem", flexWrap: "wrap" }}>
        <Link className="btn primary" href="/dashboard">{tx("Naar mijn dashboard")}</Link>
        <Link className="btn" href="/">{tx("Naar de website")}</Link>
      </div>
    </div>
  );
}
