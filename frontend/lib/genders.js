// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { api } from "./api";

// Genders the forms offer: man, woman, other, and couple (purple) only when the community theme is Dating.
export const GENDER_LABELS = { m: "Man", f: "Vrouw", x: "Anders", k: "Koppel" };

let cached = null;
export function useGenders() {
  const [list, setList] = useState(cached || ["m", "f", "x"]);
  useEffect(() => {
    if (cached) return;
    api("/genders/").then((d) => { cached = d.genders; setList(d.genders); }).catch(() => {});
  }, []);
  return list;
}
