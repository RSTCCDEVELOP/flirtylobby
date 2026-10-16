"use client";

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
    api("/auth/me/")
      .then(setUser)
      .catch(() => {
        clearToken();
        router.replace("/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout/", { method: "POST" });
    } catch {}
    clearToken();
    router.replace("/login");
  }, [router]);

  const replaceToken = (t) => setToken(t);

  if (loading || !user) return <div className="splash">{tx("Laden…")}</div>;
  return <AuthContext.Provider value={{ user, setUser, logout, replaceToken }}>{children}</AuthContext.Provider>;
}
