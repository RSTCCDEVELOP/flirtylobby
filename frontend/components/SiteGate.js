"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "../lib/api";
import { useModule } from "./Modules";
import { useSession } from "./Session";

// Paths that stay open while the website needs a subscription (so people can log in, subscribe and read the rules).
const OPEN = ["/login", "/registreren", "/abonnementen", "/dashboard/subscriptions", "/privacy", "/cookies", "/bestelling", "/sandbox", "/geo-blocked", "/404", "/doneren", "/direct", "/directchat"];

// "Toegang tot de website" (Admin -> Abonnementen -> Instellingen): without a subscription people only reach the open paths above.
export default function SiteGate() {
  const subsOn = useModule("subscriptions");
  const donOn = useModule("donations");
  const on = subsOn || donOn;
  const { user, ready } = useSession();
  const path = usePathname() || "/";
  const router = useRouter();
  useEffect(() => {
    if (!on || !ready || OPEN.some((p) => path === p || path.startsWith(p + "/"))) return;
    if (user?.is_staff) return;
    let alive = true;
    (user ? api("/subscriptions/me/").then((m) => m.site_locked) : api("/subscriptions/plans/").then((p) => p.site_gate))
      .then((locked) => { if (alive && locked) router.replace(user ? "/abonnementen?locked=1" : "/login?next=/abonnementen"); })
      .catch(() => {});
    return () => { alive = false; };
  }, [on, ready, user, path, router]);
  return null;
}
