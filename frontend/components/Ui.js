"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

// Interface defaults from the theme settings (Vormgeving -> Standaardinstellingen)
const UiContext = createContext({ remember_collapse: true, sidebar_auto: "never", chat_label: "icon", previewUi: () => {} });

export function UiProvider({ value, children }) {
  const [preview, setPreview] = useState(null);
  const ctx = useMemo(() => ({
    remember_collapse: (preview?.remember_collapse ?? value?.remember_collapse) !== "no",
    sidebar_auto: preview?.sidebar_auto ?? value?.sidebar_auto ?? "never",
    chat_label: preview?.chat_label ?? value?.chat_label ?? "icon",
    previewUi: setPreview,
  }), [value, preview]);
  useEffect(() => setPreview(null), [value]); // after saving + router.refresh()
  return <UiContext.Provider value={ctx}>{children}</UiContext.Provider>;
}

export const useUi = () => useContext(UiContext);
