// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { api } from "./api";

// Where the FAQ is shown (Admin → FAQ → Instellingen): link in the left menus, icon in the header, page public or private
const DEFAULT = { nav_link: true, header_icon: true, page_scope: "public" };
let cache = null;
const subs = new Set();
export const refreshFaqSettings = () => api("/faq/settings/").then((d) => { cache = d; subs.forEach((f) => f(d)); return d; }).catch(() => DEFAULT);
export function useFaqSettings() {
  const [v, setV] = useState(cache || DEFAULT);
  useEffect(() => { subs.add(setV); if (!cache) refreshFaqSettings(); else setV(cache); return () => subs.delete(setV); }, []);
  return v;
}
