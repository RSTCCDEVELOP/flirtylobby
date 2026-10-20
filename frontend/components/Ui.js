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
    loader_on: preview?.loader_on ?? value?.loader_on ?? "no", loader_style: preview?.loader_style ?? value?.loader_style ?? "ring", loader_when: value?.loader_when ?? "first", loader_backdrop: value?.loader_backdrop ?? "page",
    loader_size: value?.loader_size ?? 56, loader_min: value?.loader_min ?? 400, loader_lazy: value?.loader_lazy ?? "yes", loader_opacity: value?.loader_opacity ?? 100, loader_percent: preview?.loader_percent ?? value?.loader_percent ?? "no", loader_image_url: preview?.loader_image_url ?? value?.loader_image_url ?? "", loader_image_anim: value?.loader_image_anim ?? "pulse", loader_image_size: value?.loader_image_size ?? 80, loader_image_radius: value?.loader_image_radius ?? 0, loader_image_opacity: value?.loader_image_opacity ?? 100, loader_image_bg_opacity: value?.loader_image_bg_opacity ?? 100, loader_image_border: value?.loader_image_border ?? 0, loader_image_border_color: value?.loader_image_border_color ?? "#f2823f", loader_image_bg_on: value?.loader_image_bg_on ?? "no", loader_image_bg: value?.loader_image_bg ?? "#ffffff", loader_image_pad: value?.loader_image_pad ?? 0,
    page_transition: value?.page_transition ?? "none", page_transition_ms: value?.page_transition_ms ?? 350, scroll_reveal: value?.scroll_reveal ?? "none", scroll_reveal_ms: value?.scroll_reveal_ms ?? 600,
    scroll_parallax: value?.scroll_parallax ?? "no", scroll_progress: value?.scroll_progress ?? "no", scroll_top: value?.scroll_top ?? "no",
    previewUi: setPreview,
  }), [value, preview]);
  useEffect(() => { document.documentElement.dataset.tabs = ctx.tab_style; document.documentElement.dataset.popup = ctx.system_popup; }, [ctx.tab_style, ctx.system_popup]);
  useEffect(() => setPreview(null), [value]); // after saving + router.refresh()
  return <UiContext.Provider value={ctx}>{children}</UiContext.Provider>;
}

export const useUi = () => useContext(UiContext);
