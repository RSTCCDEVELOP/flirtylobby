"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../components/AuthContext";

// Whole admin area is staff only
export default function AdminLayout({ children }) {
  const { user } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!user.is_staff) router.replace("/dashboard");
  }, [user, router]);
  return user.is_staff ? children : null;
}
