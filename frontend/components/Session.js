"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, clearToken, getToken } from "../lib/api";
import { lvl } from "../lib/perms";
import { useModule } from "./Modules";

const SessionContext = createContext({ user: null, ready: false, editing: false });
export const useSession = () => useContext(SessionContext);

// Who is logged in on the public site + the "bewerkmodus" (edit mode) switch for people with content.edit
export function SessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [editMode, setEditModeState] = useState(false);

  useEffect(() => {
    try { setEditModeState(localStorage.getItem("editMode") === "1"); } catch {}
    if (!getToken()) return setReady(true);
    api("/auth/me/")
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setReady(true));
  }, []);

  const editModule = useModule("edit_mode");
  const canEdit = editModule && lvl(user, "edit_mode") >= 2;
  const setEditMode = useCallback((on) => {
    setEditModeState(on);
    try { localStorage.setItem("editMode", on ? "1" : "0"); } catch {}
  }, []);

  const logout = useCallback(async () => {
    try { await api("/auth/logout/", { method: "POST" }); } catch {}
    clearToken();
    setUser(null);
  }, []);

  return (
    <SessionContext.Provider value={{ user, ready, logout, canEdit, editMode, setEditMode, editing: canEdit && editMode }}>
      {children}
    </SessionContext.Provider>
  );
}
