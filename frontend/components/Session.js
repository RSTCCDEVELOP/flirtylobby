"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, clearToken, getToken } from "../lib/api";
import { lvl } from "../lib/perms";
import { useModule } from "./Modules";

const SessionContext = createContext({ user: null, ready: false, editing: false });
export const useSession = () => useContext(SessionContext);

// A part of a screen that is edited (or only looked at) on its own, whatever the edit mode of the person says: the page shown in the admin.
export function EditOverride({ value, children }) {
  const s = useContext(SessionContext);
  return <SessionContext.Provider value={{ ...s, editing: !!s.canEdit && !!value }}>{children}</SessionContext.Provider>;
}

// Who is logged in on the public site + the "bewerkmodus" (edit mode) switch for people with content.edit
export function SessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [editMode, setEditModeState] = useState(false);
  const [preview, setPreview] = useState(false); // ?preview=1: the page in a device frame, without editing tools

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("edit"); // ?edit=1 / ?edit=0: this page opens in (or out of) edit mode, without changing the setting of the person (used by the page preview in the admin)
      setEditModeState(q === "1" ? true : q === "0" ? false : localStorage.getItem("editMode") === "1");
    } catch {}
    try { setPreview(!!new URLSearchParams(window.location.search).get("preview")); } catch {}
    let alive = true;
    const load = () => {
      if (!getToken()) { setUser(null); return setReady(true); }
      api("/auth/me/")
        .then((u) => alive && setUser(u))
        .catch(() => { clearToken(); })
        .finally(() => alive && setReady(true));
    };
    load();
    window.addEventListener("token-changed", load); // after logging in or out (no page reload needed)
    return () => { alive = false; window.removeEventListener("token-changed", load); };
  }, []);

  const editModule = useModule("edit_mode");
  const canEdit = editModule && !preview && lvl(user, "edit_mode") >= 2;
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
