"use client";

import { tx } from "../lib/t";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { canAdmin } from "../lib/perms";
import InfoDialog from "./InfoDialog";
import { useModules } from "./Modules";
import { useSession } from "./Session";

// Beheer shortcuts at the bottom of every public page for logged-in users who have rights
export default function AdminBar() {
  const { user } = useSession();
  const mods = useModules();
  const path = usePathname();
  if (!user || path.startsWith("/dashboard") || path.startsWith("/login") || path.startsWith("/sandbox")) return null;
  const admin = canAdmin(user, mods);
  if (!admin && !user.is_staff) return null;
  return (
    <nav className="admin-bar" aria-label={tx("Beheer")}>
      <span>{tx("Beheer")}</span>
      <Link href="/dashboard">{tx("Dashboard")}</Link>
      {admin && <Link href="/dashboard/admin">{tx("Admin")}</Link>}
      {user.is_staff && <Link href="/dashboard/superadmin">{tx("Super admin")}</Link>}
      <InfoDialog className="admin-bar-info">{tx("Info")}</InfoDialog>
    </nav>
  );
}
