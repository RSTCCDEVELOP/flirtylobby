"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

// Interface defaults from the theme settings (Vormgeving -> Standaardinstellingen)
const UiContext = createContext({ remember_collapse: true, sidebar_auto: "never", nav_default: "tiles", chat_label: "icon", version_notice: true, tab_style: "pills", system_popup: "clean", previewUi: () => {} });

export function UiProvider({ value, children }) {
  const [preview, setPreview] = useState(null);
  const ctx = useMemo(() => ({
    remember_collapse: (preview?.remember_collapse ?? value?.remember_collapse) !== "no",
    sidebar_auto: preview?.sidebar_auto ?? value?.sidebar_auto ?? "never",
    nav_default: value?.nav_default === "menu" ? "menu" : "tiles",  // how the left menu works until the person chooses (a new installation: tiles)
    chat_label: preview?.chat_label ?? value?.chat_label ?? "icon",
    version_notice: (preview?.version_notice ?? value?.version_notice) !== "no",
    tab_style: preview?.tab_style ?? value?.tab_style ?? "pills",
    system_popup: preview?.system_popup ?? value?.system_popup ?? "clean",
    previewUi: setPreview,
  }), [value, preview]);
  useEffect(() => { document.documentElement.dataset.tabs = ctx.tab_style; document.documentElement.dataset.popup = ctx.system_popup; }, [ctx.tab_style, ctx.system_popup]);
  useEffect(() => setPreview(null), [value]); // after saving + router.refresh()
  return <UiContext.Provider value={ctx}>{children}</UiContext.Provider>;
}

export const useUi = () => useContext(UiContext);
