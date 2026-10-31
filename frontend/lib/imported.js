// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { api } from "./api";

let known = null; // has a site been imported? (asked once; the screen of the imports tells the page again with markImported)
const listeners = new Set();
export const markImported = (v) => { known = !!v; listeners.forEach((f) => f(known)); };

// true when Site importeren has been used: its button is then called "Geïmporteerd"
export function useImported(enabled = true) {
  const [v, setV] = useState(known);
  useEffect(() => {
    listeners.add(setV);
    if (enabled && known === null) api("/siteimport/").then((l) => markImported(Array.isArray(l) ? l.length > 0 : (l?.imports || l?.results || []).length > 0)).catch(() => {});
    return () => listeners.delete(setV);
  }, [enabled]);
  return !!v;
}
export const IMPORTED_HREF = "/dashboard/admin/siteimport";
