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
