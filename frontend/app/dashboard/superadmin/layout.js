// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

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
