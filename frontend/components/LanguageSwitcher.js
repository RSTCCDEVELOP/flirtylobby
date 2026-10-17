"use client";

import { tx } from "../lib/t";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import Flag from "./Flag";

// Shows enabled languages (only when there is a choice), as a text pulldown or as little flags (Admin -> Talen).
// Sets <html lang/dir>; LangRoot translates the UI when the "langchange" event fires.
export default function LanguageSwitcher() {
  const [data, setData] = useState(null);
  const [current, setCurrent] = useState("");

  function apply(lang) {
    document.documentElement.lang = lang.code;
    document.documentElement.dir = lang.rtl ? "rtl" : "ltr";
    window.dispatchEvent(new CustomEvent("langchange", { detail: lang.code }));
  }

  useEffect(() => {
    const load = () => api("/languages/").then((d) => {
      let saved = null;
      try { saved = localStorage.getItem("lang"); } catch {}
      const lang = d.languages.find((l) => l.code === saved) || d.languages.find((l) => l.code === d.default) || d.languages[0];
      setData(d);
      if (lang) { setCurrent(lang.code); apply(lang); }
    }).catch(() => {});
    load();
    // the admin changed the language settings (active languages, flags or pulldown): show it without a reload
    window.addEventListener("languages-changed", load);
    return () => window.removeEventListener("languages-changed", load);
  }, []);

  if (!data || data.languages.length < 2) return null;

  function choose(code) {
    const lang = data.languages.find((l) => l.code === code);
    if (!lang || lang.code === current) return;
    setCurrent(lang.code);
    apply(lang);
    try { localStorage.setItem("lang", lang.code); } catch {}
  }

  if (data.switcher === "flags") {
    return (
      <span className="lang-flags" role="group" aria-label={tx("Taal")}>
        {data.languages.map((l) => (
          <button key={l.code} type="button" className={`lang-flag ${l.code === current ? "active" : ""}`} title={l.native_name} aria-label={l.native_name} aria-pressed={l.code === current} onClick={() => choose(l.code)}>
            <Flag code={l.code} width={24} title={l.native_name} />
          </button>
        ))}
      </span>
    );
  }
  return (
    <select className="lang-select" value={current} onChange={(e) => choose(e.target.value)} aria-label={tx("Taal")}>
      {data.languages.map((l) => <option key={l.code} value={l.code}>{l.native_name}</option>)}
    </select>
  );
}
