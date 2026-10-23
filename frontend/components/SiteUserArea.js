// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../lib/t";
import Link from "next/link";
import { useSession } from "./Session";
import UserMenu from "./UserMenu";

// Public site: avatar menu when logged in, login button otherwise
export default function SiteUserArea() {
  const { user, ready, logout } = useSession();
  if (!ready) return null;
  if (!user) return <Link href="/login" className="btn primary">{tx("Inloggen")}</Link>;
  return <UserMenu user={user} onLogout={logout} />;
}
