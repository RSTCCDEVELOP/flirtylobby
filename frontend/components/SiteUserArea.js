"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, clearToken, getToken } from "../lib/api";
import UserMenu from "./UserMenu";

// Public site: avatar menu when logged in, login button otherwise
export default function SiteUserArea() {
  const [user, setUser] = useState(undefined); // undefined = still checking

  useEffect(() => {
    if (!getToken()) return setUser(null);
    api("/auth/me/")
      .then(setUser)
      .catch(() => {
        clearToken();
        setUser(null);
      });
  }, []);

  async function logout() {
    try { await api("/auth/logout/", { method: "POST" }); } catch {}
    clearToken();
    setUser(null);
  }

  if (user === undefined) return null;
  if (!user) return <Link href="/login" className="btn primary">Inloggen</Link>;
  return <UserMenu user={user} onLogout={logout} />;
}
