"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";

// Shows enabled languages (only when there is a choice). Sets <html lang/dir>; content translation comes later.
export default function LanguageSwitcher() {
  const [data, setData] = useState(null);
  const [current, setCurrent] = useState("");

  function apply(lang) {
    document.documentElement.lang = lang.code;
    document.documentElement.dir = lang.rtl ? "rtl" : "ltr";
    window.dispatchEvent(new CustomEvent("langchange", { detail: lang.code }));
  }

  useEffect(() => {
    api("/languages/").then((d) => {
      let saved = null;
      try { saved = localStorage.getItem("lang"); } catch {}
      const lang = d.languages.find((l) => l.code === saved) || d.languages.find((l) => l.code === d.default) || d.languages[0];
      setData(d);
      if (lang) { setCurrent(lang.code); apply(lang); }
    }).catch(() => {});
  }, []);

  if (!data || data.languages.length < 2) return null;

  function change(e) {
    const lang = data.languages.find((l) => l.code === e.target.value);
    setCurrent(lang.code);
    apply(lang);
    try { localStorage.setItem("lang", lang.code); } catch {}
  }

  return (
    <select className="lang-select" value={current} onChange={change} aria-label="Taal">
      {data.languages.map((l) => <option key={l.code} value={l.code}>{l.native_name}</option>)}
    </select>
  );
}
