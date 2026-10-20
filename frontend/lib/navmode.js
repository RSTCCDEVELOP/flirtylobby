"use client";

import { useCallback, useEffect, useState } from "react";
import { useUi } from "../components/Ui";

// How the left menu works: "menu" = groups with the pages in the menu itself, "tiles" = one item per group that opens a page of tiles.
export function useNavMode() {
  const { nav_default: def } = useUi();
  const [mode, setMode] = useState(def);
  useEffect(() => {
    const read = () => { try { const v = localStorage.getItem("navmode"); setMode(v === "tiles" || v === "menu" ? v : def); } catch { setMode(def); } };
    read();
    window.addEventListener("navmode-changed", read);
    return () => window.removeEventListener("navmode-changed", read);
  }, [def]);
  const set = useCallback((m) => {
    try { localStorage.setItem("navmode", m); } catch {}
    window.dispatchEvent(new Event("navmode-changed"));
  }, []);
  return [mode, set];
}
