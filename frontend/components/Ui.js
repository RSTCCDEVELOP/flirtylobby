"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

// Interface defaults from the theme settings (Vormgeving -> Standaardinstellingen)
const UiContext = createContext({ remember_collapse: true, sidebar_auto: "never", chat_label: "icon", version_notice: true, tab_style: "pills", previewUi: () => {} });

export function UiProvider({ value, children }) {
  const [preview, setPreview] = useState(null);
  const ctx = useMemo(() => ({
    remember_collapse: (preview?.remember_collapse ?? value?.remember_collapse) !== "no",
    sidebar_auto: preview?.sidebar_auto ?? value?.sidebar_auto ?? "never",
    chat_label: preview?.chat_label ?? value?.chat_label ?? "icon",
    version_notice: (preview?.version_notice ?? value?.version_notice) !== "no",
    tab_style: preview?.tab_style ?? value?.tab_style ?? "pills",
    previewUi: setPreview,
  }), [value, preview]);
  useEffect(() => { document.documentElement.dataset.tabs = ctx.tab_style; }, [ctx.tab_style]);
  useEffect(() => setPreview(null), [value]); // after saving + router.refresh()
  return <UiContext.Provider value={ctx}>{children}</UiContext.Provider>;
}

export const useUi = () => useContext(UiContext);
