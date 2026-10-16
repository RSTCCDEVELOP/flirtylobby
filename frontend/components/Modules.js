"use client";

import { createContext, useContext, useEffect, useState } from "react";

const ModulesContext = createContext({});

// Which modules are switched on (from the server layout). Missing key = on.
export function ModulesProvider({ value, children }) {
  const [mods, setMods] = useState(value || {});
  useEffect(() => setMods(value || {}), [value]); // after router.refresh()
  return <ModulesContext.Provider value={mods}>{children}</ModulesContext.Provider>;
}

export const useModules = () => useContext(ModulesContext);
export const useModule = (key) => useContext(ModulesContext)[key] !== false;
