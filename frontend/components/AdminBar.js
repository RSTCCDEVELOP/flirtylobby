// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { tx } from "../lib/t";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { canAdmin } from "../lib/perms";
import { IconSettings } from "./Icons";
import InfoDialog from "./InfoDialog";
import { useModules } from "./Modules";
import { useSession } from "./Session";

const Chevron = ({ up = false, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={up ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} /></svg>
);

// Beheer shortcuts at the bottom of every public page for logged-in users who have rights
export default function AdminBar() {
  const { user } = useSession();
  const mods = useModules();
  const path = usePathname();
  const [hidden, setHidden] = useState(false);  // the menu is folded away (kept in this browser): a small button brings it back, so the page can be checked without it
  useEffect(() => { try { setHidden(localStorage.getItem("e2e_adminbar_hidden") === "1"); } catch {} }, []);
  const hide = (v) => { setHidden(v); try { localStorage.setItem("e2e_adminbar_hidden", v ? "1" : "0"); } catch {} };
  if (!user || path.startsWith("/dashboard") || path.startsWith("/login") || path.startsWith("/sandbox")) return null;
  const admin = canAdmin(user, mods);
  if (!admin && !user.is_staff) return null;
  if (hidden) {
    return (
      <button type="button" className="admin-bar-handle" onClick={() => hide(false)} title={tx("Beheermenu tonen")} aria-label={tx("Beheermenu tonen")}>
        <IconSettings width={16} height={16} /><Chevron up size={12} />
      </button>
    );
  }
  return (
    <nav className="admin-bar" aria-label={tx("Beheer")}>
      <span>{tx("Beheer")}</span>
      <Link href="/dashboard">{tx("Dashboard")}</Link>
      {admin && <Link href="/dashboard/admin">{tx("Admin")}</Link>}
      {user.is_staff && <Link href="/dashboard/superadmin">{tx("Super admin")}</Link>}
      <InfoDialog className="admin-bar-info">{tx("Info")}</InfoDialog>
      <button type="button" className="admin-bar-hide" onClick={() => hide(true)} title={tx("Beheermenu verbergen")} aria-label={tx("Beheermenu verbergen")}><Chevron /></button>
    </nav>
  );
}
