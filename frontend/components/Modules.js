"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";

const ModulesContext = createContext({});

// Which modules are switched on (from the server layout). Missing key = on.
export function ModulesProvider({ value, children }) {
  const [mods, setMods] = useState(value || {});
  useEffect(() => setMods(value || {}), [value]); // after router.refresh()
  // the server could not ask for the modules (the backend was not reachable for the server of Next, for instance with an untrusted https certificate): then every module would look "on". Ask from the browser instead.
  useEffect(() => { if (!value || !Object.keys(value).length) api("/modules/").then((m) => m && setMods(m)).catch(() => {}); }, [value]);
  return <ModulesContext.Provider value={mods}>{children}</ModulesContext.Provider>;
}

export const useModules = () => useContext(ModulesContext);
export const useModule = (key) => useContext(ModulesContext)[key] !== false;
