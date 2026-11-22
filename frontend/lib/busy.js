// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect } from "react";

// What is going on that must not be interrupted by an automatic logout (a page is being made, an import is running ...). The idle logout (components/IdleGuard.js) never logs out while something is busy:
// it asks first and waits for the answer.
const keys = new Set();
export const setBusy = (key, on) => { if (on) keys.add(key); else keys.delete(key); };
export const isBusy = () => keys.size > 0;
export function useBusy(key, on) {
  useEffect(() => { setBusy(key, !!on); return () => setBusy(key, false); }, [key, on]);
}
