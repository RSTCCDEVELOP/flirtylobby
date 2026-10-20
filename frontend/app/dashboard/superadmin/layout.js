"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "../../../components/AuthContext";

// Super admin area: superadmins only
export default function SuperAdminLayout({ children }) {
  const { user } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!user.is_staff) router.replace("/dashboard");
  }, [user, router]);
  return user.is_staff ? children : null;
}
