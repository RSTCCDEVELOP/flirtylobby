"use client";

import { tx } from "../lib/t";
import { usePathname } from "next/navigation";
import { useSession } from "./Session";
import { Logo } from "./BrandingContext";

// Maintenance mode (Basisgegevens): everybody except superadmins sees a notice. The login page and the dashboard stay reachable so the admin can switch it off.
export default function MaintenanceGate({ site }) {
  const { user } = useSession();
  const path = usePathname() || "/";
  if (!site?.maintenance || user?.is_staff || path.startsWith("/login") || path.startsWith("/dashboard")) return null;
  return (
    <div className="maintenance" role="alert">
      <Logo className="maintenance-logo" />
      <h1>{site.site_name}</h1>
      <p>{site.maintenance_message || tx("We zijn bezig met onderhoud. Probeer het straks opnieuw.")}</p>
    </div>
  );
}
