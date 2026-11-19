// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { api } from "./api";

// The entity of the website (module Entiteit): the organisation behind it. Everything is local in the site.
// The texts of the website can use its data as variables: {{organisatie.naam}}, {{organisatie.adres}} ... they are filled in when the text is shown (never in edit mode, so the variable stays in the text).
let cache = null;
let loading = null;
const listeners = new Set();

export function loadEntity(force = false) {
  if (cache && !force) return Promise.resolve(cache);
  if (!loading || force) {
    loading = api("/entity/public/").then((d) => { cache = d; listeners.forEach((f) => f(d)); loading = null; return d; }).catch(() => { loading = null; return cache; });
  }
  return loading;
}

export function useEntity() {
  const [e, setE] = useState(cache);
  useEffect(() => {
    listeners.add(setE);
    if (!cache) loadEntity();
    const again = () => loadEntity(true);
    window.addEventListener("entity-changed", again);
    return () => { listeners.delete(setE); window.removeEventListener("entity-changed", again); };
  }, []);
  return e;
}

const VAR = /\{\{\s*organisatie\.([a-z_]+)\s*\}\}/g;
export const hasVars = (text) => typeof text === "string" && text.includes("{{");
// until the data is there (and on the server) a variable is left out, so a visitor never sees the braces
// {{user.*}}: the person who looks at the page (empty for a visitor who is not logged in)
const USER_VAR = /\{\{\s*user\.([a-z_]+)\s*\}\}/g;
export const userVariables = (u) => {
  if (!u) return {};
  const first = u.first_name || "", last = u.last_name || "";
  return { naam: u.display_name || [first, last].filter(Boolean).join(" ") || u.email || "", voornaam: first, achternaam: last, email: u.email || "", functie: u.function || "", bedrijf: u.company || "" };
};
export const fillVars = (text, entity, user) => {
  if (!hasVars(text)) return text;
  const uv = userVariables(user);
  return text.replace(VAR, (_, k) => entity?.variables?.[k] ?? "").replace(USER_VAR, (_, k) => uv[k] ?? "");
};
// one variable by its name ("organisatie.naam", "user.email") for the system objects of the page editor
export const variableValue = (name, entity, user) => fillVars(`{{${name}}}`, entity, user);
