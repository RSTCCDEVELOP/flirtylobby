// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { api } from "./api";

// The phase of a licence that has ended (set in Default and global settings): 0 = fine, 1 = full control (a notice), 2 = no page editor, 3 = no administration (only the licence), 4 = offline.
// {phase, days_over, days_left, plan, valid_until}. Read once from the public site data.
let cache = null;
export function useLicencePhase() {
  const [p, setP] = useState(cache || { phase: 0 });
  useEffect(() => {
    if (cache) return;
    api("/site/").then((s) => { cache = s?.license_phase || { phase: 0 }; setP(cache); }).catch(() => {});
  }, []);
  return p;
}

// what the person gets to read: where the licence is now and what happens next
export const PHASE_NOW = { 1: "Je hebt nog volledige toegang.", 2: "De pagina-editor is gesloten.", 3: "De administratie is gesloten: je kunt alleen nog de licentie bijwerken.", 4: "De website staat offline." };
export const PHASE_NEXT = { 1: "de pagina-editor wordt gesloten", 2: "de administratie wordt gesloten (alleen de licentie kan nog worden bijgewerkt)", 3: "de website gaat offline" };
