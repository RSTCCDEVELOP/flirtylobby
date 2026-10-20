"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "../../../components/AuthContext";
import { useModules } from "../../../components/Modules";
import { canOpen } from "../../../lib/perms";

// Admin area: each page needs its own permission (roles), beheerders can open everything
export default function AdminLayout({ children }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const mods = useModules();
  const allowed = canOpen(user, pathname, mods);
  useEffect(() => {
    if (!allowed) router.replace("/dashboard");
  }, [allowed, router]);
  return allowed ? children : null;
}
