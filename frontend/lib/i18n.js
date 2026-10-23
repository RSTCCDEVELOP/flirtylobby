// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

// Pick a text for `key` in `lang`, falling back to the default language, nl, then any language that has it.
export function pick(texts, lang, def, key) {
  const order = [lang, def, "nl", ...Object.keys(texts || {})];
  for (const l of order) {
    const v = texts?.[l]?.[key];
    if (v !== undefined && v !== "" && !(Array.isArray(v) && !v.length)) return v;
  }
  return key === "warnings" ? [] : "";
}

// First language from an Accept-Language header that the site offers
export function detectLang(acceptLanguage, languages, def) {
  const wanted = (acceptLanguage || "").split(",").map((p) => p.trim().split(";")[0].slice(0, 2).toLowerCase());
  return wanted.find((l) => languages?.includes(l)) || def || "nl";
}
