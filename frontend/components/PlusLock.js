// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { IconLock, IconUnlock } from "./Icons";
import { useAuth } from "./AuthContext";
import { tx } from "../lib/t";

// A small lock (single colour) at everything that is for a superadmin+ only: a tile, a module, a screen, a role.
// A superadmin+ sees an open lock (it is open for them), everybody else a closed one.
export default function PlusLock({ style, corner = false }) {
  const { user } = useAuth();
  const open = !!user?.is_superadmin_plus;
  return (
    <span className={`plus-lock${corner ? " tile-corner" : ""}`} title={tx("Alleen superadmin+")} aria-label={tx("Alleen superadmin+")} role="img" style={style}>{open ? <IconUnlock /> : <IconLock />}</span>
  );
}
