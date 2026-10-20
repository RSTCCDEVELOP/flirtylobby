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
