// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

import { api } from "./api";

// How long a code stays valid (seconds), per kind: twofa (login, two-step), registration, terms, owner. Asked once; the round timer of every code input uses it.
let cache = null;
export function codeLifetimes() {
  if (!cache) cache = api("/system/code-lifetimes/").catch(() => ({}));
  return cache;
}
export const DEFAULT_LIFETIME = 600;
