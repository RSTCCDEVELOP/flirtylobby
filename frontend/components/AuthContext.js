"use client";

import { Busy } from "./PageLoader";
import { tx } from "../lib/t";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, getToken, clearToken, setToken } from "../lib/api";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    // Only a refused login (401) logs the person out. A hiccup of the server (restart, slow answer, network) must not: that made people log in twice. Retry a few times first.
    let alive = true;
    let used = getToken();
    const load = (left) => api("/auth/me/")
      .then((u) => alive && (setUser(u), setLoading(false)))
      .catch((e) => {
        if (!alive) return;
        if (getToken() !== used) { used = getToken(); if (used) load(left); return; } // a new login was made meanwhile: leave it alone and ask again for that one
        if (e?.status === 401 || e?.status === 403) { clearToken(); router.replace("/login"); setLoading(false); }
        else if (left > 0) setTimeout(() => load(left - 1), 1500);
        else setLoading(false);
      });
    load(5);
    return () => { alive = false; };
  }, [router]);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout/", { method: "POST" });
    } catch {}
    clearToken();
    router.replace("/login");
  }, [router]);

  const replaceToken = (t) => setToken(t);

  if (loading || !user) return <Busy full />;
  return <AuthContext.Provider value={{ user, setUser, logout, replaceToken }}>{children}</AuthContext.Provider>;
}
