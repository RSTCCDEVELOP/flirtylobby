// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, clearToken, getToken } from "../lib/api";
import { lvl } from "../lib/perms";
import { confirmDialog } from "../lib/dialog";
import { tx } from "../lib/t";
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
      const used = getToken();
      api("/auth/me/")
        .then((u) => alive && getToken() === used && setUser(u))
        .catch((e) => { if (e?.status === 401 && getToken() === used) clearToken(); }) // only the login this answer belongs to: a slow answer for an old token must not wipe the login that was made meanwhile (that made people log in twice)
        .finally(() => alive && setReady(true));
    };
    load();
    window.addEventListener("token-changed", load); // after logging in or out (no page reload needed)
    return () => { alive = false; window.removeEventListener("token-changed", load); };
  }, []);

  const editModule = useModule("edit_mode");
  const canEdit = editModule && !preview && lvl(user, "edit_mode") >= 2;
  // Editing is made for a big screen: on a phone it is off, and switching it on asks first (the answer counts for this visit).
  const [small, setSmall] = useState(false);
  const [mobileOk, setMobileOk] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const on = () => setSmall(mq.matches);
    on(); mq.addEventListener?.("change", on);
    try { setMobileOk(sessionStorage.getItem("edit-mobile-ok") === "1"); } catch {}
    return () => mq.removeEventListener?.("change", on);
  }, []);
  const setEditMode = useCallback(async (on) => {
    if (on && small && !mobileOk) {
      const yes = await confirmDialog(tx("Bewerken is gemaakt voor een groot scherm. Op een telefoon is het lastig werken en kan de pagina er anders uitzien. Toch bewerken?"), { okLabel: tx("Toch bewerken"), cancelLabel: tx("Niet bewerken") });
      if (!yes) return;
      setMobileOk(true);
      try { sessionStorage.setItem("edit-mobile-ok", "1"); } catch {}
    }
    setEditModeState(on);
    try { localStorage.setItem("editMode", on ? "1" : "0"); } catch {}
  }, [small, mobileOk]);
  const allowed = !small || mobileOk;

  const logout = useCallback(async () => {
    try { await api("/auth/logout/", { method: "POST" }); } catch {}
    clearToken();
    setUser(null);
  }, []);

  return (
    <SessionContext.Provider value={{ user, ready, logout, canEdit, editMode: editMode && allowed, setEditMode, editing: canEdit && editMode && allowed }}>
      {children}
    </SessionContext.Provider>
  );
}
