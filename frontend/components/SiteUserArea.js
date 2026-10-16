"use client";

import Link from "next/link";
import { useSession } from "./Session";
import UserMenu from "./UserMenu";

// Public site: avatar menu when logged in, login button otherwise
export default function SiteUserArea() {
  const { user, ready, logout } = useSession();
  if (!ready) return null;
  if (!user) return <Link href="/login" className="btn primary">Inloggen</Link>;
  return <UserMenu user={user} onLogout={logout} />;
}
