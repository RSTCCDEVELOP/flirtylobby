"use client";

import { Fragment, useEffect, useState } from "react";
import { loadDictionary, setLanguage } from "../lib/t";

// Keeps the UI language (visitor choice -> site default) and re-renders everything when it changes.
// The switcher (LanguageSwitcher) only has to dispatch a "langchange" event.
export default function LangRoot({ children, languages, defaultLanguage }) {
  const [lang, setLang] = useState("nl");

  useEffect(() => {
    let alive = true;
    const choose = async (wanted) => {
      const known = (languages || []).map((l) => l.code);
      const code = known.includes(wanted) ? wanted : known.includes(defaultLanguage) ? defaultLanguage : "nl";
      const dict = await loadDictionary(code);
      if (!alive) return;
      setLanguage(code, dict);
      const meta = (languages || []).find((l) => l.code === code);
      document.documentElement.lang = code;
      document.documentElement.dir = meta?.rtl ? "rtl" : "ltr";
      setLang(code);
    };
    let saved = null;
    try { saved = localStorage.getItem("lang"); } catch {}
    choose(saved);
    const onChange = (e) => choose(e.detail);
    window.addEventListener("langchange", onChange);
    return () => { alive = false; window.removeEventListener("langchange", onChange); };
  }, [languages, defaultLanguage]);

  return <Fragment key={lang}>{children}</Fragment>;
}
