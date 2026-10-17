"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { ageFrom, MONTHS } from "../lib/age";
import { tx } from "../lib/t";
import Flag from "./Flag";

const read = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

// The "Gegevens" screen of a direct connection: name and gender, plus what the admin switched on
// (Community → Directe verbinding → Gegevens): language flags and birth month and year (a warning when younger than the minimum age).
// cfg: {ask_languages, ask_birth, min_age}; onSubmit({name, gender, languages, birth_month, birth_year}); intro goes above the fields.
export function DirectDataFields({ cfg, name, setName, gender, setGender, langs, setLangs, birth, setBirth, languages = [], preview = false }) {
  const toggle = (c) => setLangs(langs.includes(c) ? langs.filter((x) => x !== c) : [...langs, c]);
  return (
    <>
      <label>{tx("Jouw naam")}<input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} autoFocus={!preview} autoComplete="name" readOnly={preview} tabIndex={preview ? -1 : undefined} /></label>
      <div>
        <span style={{ fontWeight: 600, fontSize: ".9rem" }}>{tx("Geslacht")}</span>
        <div className="gender-pick" role="radiogroup" aria-label={tx("Geslacht")} style={{ marginTop: ".35rem" }}>
          {[["m", "Man"], ["f", "Vrouw"], ["x", "Overig"], ...(cfg?.couple ? [["k", "Koppel"]] : [])].map(([k, l]) => <button type="button" key={k} data-g={k} role="radio" aria-checked={gender === k} tabIndex={preview ? -1 : undefined} className={gender === k ? "on" : ""} onClick={() => setGender(k)}>{tx(l)}</button>)}
        </div>
      </div>
      {cfg?.ask_languages && languages.length > 1 && (
        <div>
          <span style={{ fontWeight: 600, fontSize: ".9rem" }}>{tx("In welke talen wil je zoeken?")} <small className="muted" style={{ fontWeight: 400 }}>{tx("meerdere mogelijk")}</small></span>
          <div className="lang-flags" role="group" aria-label={tx("Talen")} style={{ marginTop: ".35rem", flexWrap: "wrap" }}>
            {languages.map((l) => (
              <button type="button" key={l.code} className={`lang-flag ${langs.includes(l.code) ? "active" : ""}`} aria-pressed={langs.includes(l.code)} title={l.native_name} aria-label={l.native_name} tabIndex={preview ? -1 : undefined} onClick={() => toggle(l.code)}>
                <Flag code={l.code} width={28} title={l.native_name} />
              </button>
            ))}
          </div>
        </div>
      )}
      {cfg?.ask_birth && (
        <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-end" }}>
          <label style={{ flex: 2 }}>{tx("Geboortemaand")}
            <select value={birth.month} onChange={(e) => setBirth({ ...birth, month: e.target.value })} required disabled={preview}>
              <option value="">{tx("Kies…")}</option>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{tx(m)}</option>)}
            </select>
          </label>
          <label style={{ flex: 1 }}>{tx("Geboortejaar")}
            <input value={birth.year} onChange={(e) => setBirth({ ...birth, year: e.target.value.replace(/\D/g, "").slice(0, 4) })} inputMode="numeric" placeholder="1990" required autoComplete="bday-year" readOnly={preview} tabIndex={preview ? -1 : undefined} />
          </label>
        </div>
      )}
    </>
  );
}

export default function DirectDataForm({ intro, submitLabel, busy, onSubmit, children }) {
  const [cfg, setCfg] = useState(null);
  const [languages, setLanguages] = useState([]);
  const [name, setNameState] = useState("");
  const [gender, setGenderState] = useState("m");
  const [langs, setLangsState] = useState([]);
  const [birth, setBirth] = useState({ month: "", year: "" });
  const [young, setYoung] = useState(false);

  useEffect(() => {
    const n = read("direct_name", ""), g = read("direct_gender", "m"), l = read("direct_langs", "");
    if (n) setNameState(n);
    if (["m", "f", "x", "k"].includes(g)) setGenderState(g);
    if (l) setLangsState(l.split(",").filter(Boolean));
    api("/direct/config/").then(setCfg).catch(() => setCfg({}));
    api("/languages/").then((d) => setLanguages(d.languages || [])).catch(() => {});
  }, []);
  const setName = (v) => { setNameState(v); write("direct_name", v); };
  const setGender = (v) => { setGenderState(v); write("direct_gender", v); };
  const setLangs = (v) => { setLangsState(v); write("direct_langs", v.join(",")); };

  function submit(e) {
    e.preventDefault();
    const y = parseInt(birth.year, 10), m = parseInt(birth.month, 10);
    if (cfg?.ask_birth) {
      if (!(m >= 1 && m <= 12 && y >= 1900 && y <= new Date().getFullYear())) return;
      if (ageFrom(y, m) < (cfg.min_age || 18)) return setYoung(true);
    }
    onSubmit({ name: name.trim(), gender, languages: cfg?.ask_languages ? langs : [], ...(cfg?.ask_birth ? { birth_month: m, birth_year: y } : {}) });
  }
  if (!cfg) return null;
  if (young) return (
    <div className="form">
      <div className="alert">{tx("Volgens deze geboortedatum ben je jonger dan {0}. Je hebt geen toegang.", cfg.min_age || 18)}</div>
      <div className="row">
        <Link href="/" className="btn">{tx("Stoppen")}</Link>
        <button type="button" className="btn primary" onClick={() => setYoung(false)}>{tx("Datum aanpassen")}</button>
      </div>
    </div>
  );
  return (
    <form className="form" onSubmit={submit}>
      {intro}
      <DirectDataFields cfg={cfg} name={name} setName={setName} gender={gender} setGender={setGender} langs={langs} setLangs={setLangs} birth={birth} setBirth={setBirth} languages={languages} />
      <button className="btn primary" disabled={busy || !name.trim()}>{busy ? tx("Bezig…") : submitLabel}</button>
      {children}
    </form>
  );
}
