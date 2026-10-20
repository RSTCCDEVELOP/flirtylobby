"use client";

import { Busy } from "../../components/PageLoader";
import { getLanguage, tx } from "../../lib/t";
import LanguageSwitcher from "../../components/LanguageSwitcher";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "../../components/BrandingContext";
import ThemeToggle from "../../components/ThemeToggle";
import { api, setToken, errorText } from "../../lib/api";
import { confirmDialog } from "../../lib/dialog";
import { GENDER_LABELS, useGenders } from "../../lib/genders";
import CodeInput from "../../components/CodeInput";
import { checkedBirthMonth } from "../../lib/age-check";


const EMPTY = { first_name: "", last_name: "", display_name: "", email: "", password: "", password2: "", birth_date: "", gender: "", phone: "", method: "", accept: false };

// defined outside the page so the inputs keep their focus while typing
const Shell = ({ children, onSubmit }) => (
  <main className="login-page">
    <div className="login-theme"><LanguageSwitcher flags /><ThemeToggle /></div>
    <form className="card login-card" style={{ maxWidth: 520 }} onSubmit={onSubmit}>{children}</form>
  </main>
);

// Self sign-up. The account is only created after the verifications the security settings ask for.
export default function Register() {
  const genders = useGenders();
  const router = useRouter();
  const [cfg, setCfg] = useState(null);
  const [f, setF] = useState(EMPTY);
  useEffect(() => { const b = checkedBirthMonth(); if (b) setF((x) => (x.birth_date ? x : { ...x, birth_date: b })); }, []); // month and year from the 18+ check
  const [step, setStep] = useState(null); // null = form, else {token, step, destination, steps_left}
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [emailState, setEmailState] = useState({ status: "" }); // "" | checking | ok | invalid | taken
  const emailSeq = useRef(0);
  const [showPw, setShowPw] = useState(false);
  const [pwCopied, setPwCopied] = useState(false);
  const autoName = useRef(""); // the profile name we filled in ourselves (so we may replace it when the first name changes)

  useEffect(() => {
    api("/auth/register/config/").then((c) => { setCfg(c); if (c.twofa_methods?.length) setF((x) => ({ ...x, method: c.twofa_methods[0] })); }).catch((e) => setError(errorText(e)));
  }, []);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  // profile name: filled in from the first name (with a number behind it when taken); a name typed by the member is checked: green tick = free, red = taken
  const [nameState, setNameState] = useState({ status: "", suggestion: "" }); // status: "" | checking | ok | taken
  const nameSeq = useRef(0);
  async function checkName(value, fill = false) {
    const wanted = (value || "").trim();
    const seq = ++nameSeq.current;
    if (!wanted) return setNameState({ status: "", suggestion: "" });
    setNameState({ status: "checking", suggestion: "" });
    try {
      const r = await api(`/auth/register/name/?name=${encodeURIComponent(wanted)}`);
      if (seq !== nameSeq.current) return;
      if (fill) { autoName.current = r.name; setF((x) => ({ ...x, display_name: r.name })); setNameState({ status: "ok", suggestion: "" }); }
      else setNameState({ status: r.available ? "ok" : "taken", suggestion: r.name });
    } catch { if (seq === nameSeq.current) setNameState({ status: "", suggestion: "" }); }
  }
  useEffect(() => {  // typing in the profile name: check shortly after the last key
    if (!f.display_name || f.display_name === autoName.current) return;
    const t = setTimeout(() => checkName(f.display_name), 400);
    return () => clearTimeout(t);
  }, [f.display_name]); // eslint-disable-line react-hooks/exhaustive-deps
  const suggestName = (first) => { if (first.trim() && (!f.display_name || f.display_name === autoName.current)) checkName(first, true); };
  // e-mail: only the format is checked (whether an address already has an account is never shown)
  async function checkEmail(value) {
    const v = (value || "").trim();
    const seq = ++emailSeq.current;
    if (!v) return setEmailState({ status: "" });
    setEmailState({ status: "checking" });
    try {
      const r = await api(`/auth/register/email/?email=${encodeURIComponent(v)}`);
      if (seq === emailSeq.current) setEmailState({ status: r.valid ? "ok" : "invalid" });
    } catch { if (seq === emailSeq.current) setEmailState({ status: "" }); }
  }
  useEffect(() => {
    if (!f.email) { setEmailState({ status: "" }); return; }
    const t = setTimeout(() => checkEmail(f.email), 500);
    return () => clearTimeout(t);
  }, [f.email]); // eslint-disable-line react-hooks/exhaustive-deps
  // a strong random password that follows the rules of this site; it is copied to the clipboard and shown
  async function generatePassword() {
    const min = Math.max(16, cfg.password_min_length || 8);
    const sets = ["abcdefghijkmnopqrstuvwxyz", "ABCDEFGHJKLMNPQRSTUVWXYZ", "23456789", "!@#$%&*?+-="];
    const rnd = (n) => { const a = new Uint32Array(1); let x; do { crypto.getRandomValues(a); x = a[0]; } while (x >= 4294967296 - (4294967296 % n)); return x % n; };
    const all = sets.join("");
    const chars = sets.map((c) => c[rnd(c.length)]);   // at least one of each kind: lower, upper, digit, symbol
    while (chars.length < min) chars.push(all[rnd(all.length)]);
    for (let i = chars.length - 1; i > 0; i--) { const j = rnd(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
    const pw = chars.join("");
    setF((x) => ({ ...x, password: pw, password2: pw }));
    setShowPw(true);
    try { await navigator.clipboard.writeText(pw); }
    catch { const t = document.createElement("textarea"); t.value = pw; t.style.position = "fixed"; t.style.opacity = "0"; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); } catch {} t.remove(); }
    setPwCopied(true); setTimeout(() => setPwCopied(false), 2500);
  }
  const finish = (r) => { setToken(r.token); router.push("/dashboard"); };
  const fail = (err) => {
    if (err.data && !err.data.detail) setErrors(err.data), setError(tx("Controleer de gemarkeerde velden."));
    else setError(errorText(err));
    setBusy(false);
  };
  const err = (k) => errors[k] && <small style={{ color: "var(--danger, #d92d20)" }}>{[].concat(errors[k]).join(" ")}</small>;

  async function submit(e) {
    e.preventDefault();
    setError(""); setErrors({});
    if (f.password !== f.password2) { setErrors({ password2: tx("De wachtwoorden zijn niet gelijk.") }); return; }
    setBusy(true);
    try {
      const { password2, accept, ...body } = f;
      const r = await api("/auth/register/", { method: "POST", body: { ...body, birth_date: body.birth_date || undefined, language: getLanguage() } });
      if (r.done) return finish(r);
      setStep(r); setBusy(false);
    } catch (e2) { fail(e2); }
  }

  async function verify(e) {
    e.preventDefault();
    setError(""); setInfo(""); setBusy(true);
    try {
      const r = await api("/auth/register/verify/", { method: "POST", body: { token: step.token, code } });
      if (r.done) return finish(r);
      setStep(r); setCode(""); setBusy(false);
      setInfo(tx("Gelukt. Nog één controle."));
    } catch (e2) { fail(e2); }
  }

  async function resend() {
    setError(""); setInfo("");
    try { const r = await api("/auth/register/resend/", { method: "POST", body: { token: step.token } }); if (r.sandbox_code) setStep((x) => ({ ...x, sandbox_code: r.sandbox_code })); setInfo(tx("Nieuwe code verstuurd.")); }
    catch (e2) { setError(errorText(e2)); }
  }

  if (!cfg) return <Shell onSubmit={(e) => e.preventDefault()}><Logo />{error ? <div className="alert">{error}</div> : <Busy />}</Shell>;
  if (!cfg.enabled) return <Shell onSubmit={(e) => e.preventDefault()}><Logo /><h1>{tx("Aanmelden")}</h1><p className="muted">{tx("Aanmelden is op dit moment niet mogelijk.")}</p><Link href="/login" className="btn">{tx("Naar inloggen")}</Link></Shell>;
  if (cfg.unavailable) return <Shell onSubmit={(e) => e.preventDefault()}><Logo /><h1>{tx("Aanmelden")}</h1><div className="alert">{tx("Aanmelden is tijdelijk niet mogelijk. Probeer het later opnieuw.")}</div><Link href="/login" className="btn">{tx("Naar inloggen")}</Link></Shell>;

  if (step) {
    return (
      <Shell onSubmit={verify}>
        <Logo />
        <h1>{step.step === "sms" ? tx("Bevestig je telefoonnummer") : tx("Bevestig je e-mailadres")}</h1>
        <p className="muted" style={{ margin: 0 }}>{tx("We hebben een code gestuurd naar")} {step.destination}{tx(". Je account wordt aangemaakt zodra dit gelukt is.")}</p>
        <div className="code-field"><span>{tx("Code")}</span><CodeInput value={code} onChange={setCode} autoFocus invalid={!!error} /></div>
        {error && <div className="alert">{error}</div>}
        {info && <div className="alert ok">{info}</div>}
        {step.sandbox_code && <div className="alert ok" style={{ display: "flex", gap: ".6rem", alignItems: "center", flexWrap: "wrap" }}>{tx("Sandbox: je code is")} <strong style={{ letterSpacing: ".15em" }}>{step.sandbox_code}</strong> <button type="button" className="btn sm" onClick={() => setCode(step.sandbox_code)}>{tx("Invullen")}</button></div>}
        <button className="btn primary" disabled={busy || code.length < 6}>{busy ? tx("Bezig…") : tx("Bevestigen")}</button>
        <button type="button" className="btn" onClick={resend}>{tx("Code opnieuw sturen")}</button>
        <button type="button" className="muted center" style={{ background: "none", border: 0, cursor: "pointer" }} onClick={() => { setStep(null); setCode(""); setError(""); setInfo(""); }}>{tx("← Gegevens aanpassen")}</button>
      </Shell>
    );
  }

  // too young: warn at once, with the choice to correct the date or stop
  async function checkAge() {
    if (!cfg.min_age || !f.birth_date) return;
    const b = new Date(f.birth_date), n = new Date();
    if (isNaN(b) || b.getFullYear() < 1900) return;
    const age = n.getFullYear() - b.getFullYear() - (n.getMonth() * 100 + n.getDate() < b.getMonth() * 100 + b.getDate() ? 1 : 0);
    if (age >= cfg.min_age) return;
    const fix = await confirmDialog(tx("Volgens deze geboortedatum ben je jonger dan {0}. Je kunt je dan niet aanmelden. Klopt de datum niet? Pas hem dan aan.", cfg.min_age), { title: tx("Je bent jonger dan {0}", cfg.min_age), okLabel: tx("Datum aanpassen"), cancelLabel: tx("Stoppen") });
    if (fix) setF((x) => ({ ...x, birth_date: "" }));
    else window.location.href = cfg.deny_url || "/";
  }
  const phoneNeeded = cfg.require_phone || f.method === "sms";
  return (
    <Shell onSubmit={submit}>
      <Logo />
      <h1>{tx("Aanmelden")}</h1>
      <div className="grid2">
        <label>{tx("Voornaam")}<input value={f.first_name} onChange={set("first_name")} onBlur={(e) => suggestName(e.target.value)} required autoFocus autoComplete="given-name" />{err("first_name")}</label>
        <label>{tx("Achternaam")}<input value={f.last_name} onChange={set("last_name")} autoComplete="family-name" />{err("last_name")}</label>
        <label>{tx("Profielnaam")}
          <span className="name-field">
            <input value={f.display_name} onChange={set("display_name")} maxLength={60} placeholder={tx("Zo zien anderen je")} aria-invalid={nameState.status === "taken"} />
            {nameState.status === "ok" && <span className="name-status ok" title={tx("Deze naam is beschikbaar")}>✓</span>}
            {nameState.status === "taken" && <span className="name-status bad" title={tx("Deze naam is al in gebruik")}>✕</span>}
          </span>
          {nameState.status === "taken" && <small style={{ color: "var(--danger, #d92d20)" }}>{tx("Deze profielnaam is al in gebruik.")} {nameState.suggestion && <button type="button" className="muted" style={{ background: "none", border: 0, cursor: "pointer", textDecoration: "underline", padding: 0 }} onClick={() => { autoName.current = nameState.suggestion; setF((x) => ({ ...x, display_name: nameState.suggestion })); setNameState({ status: "ok", suggestion: "" }); }}>{tx("Gebruik")} {nameState.suggestion}</button>}</small>}
          {err("display_name")}</label>
        <label>{tx("E-mailadres")}
          <span className="name-field">
            <input type="email" value={f.email} onChange={set("email")} required autoComplete="email" aria-invalid={emailState.status === "invalid"} />
            {emailState.status === "ok" && <span className="name-status ok" title={tx("Dit e-mailadres ziet er goed uit")}>✓</span>}
            {emailState.status === "invalid" && <span className="name-status bad">✕</span>}
          </span>
          {emailState.status === "invalid" && <small style={{ color: "var(--danger, #d92d20)" }}>{tx("Dit is geen geldig e-mailadres.")}</small>}
          {err("email")}</label>
        {cfg.birth_date && <label>{tx("Geboortedatum")}{cfg.min_age ? <em className="muted"> ({cfg.min_age}+)</em> : null}
          <input type="date" value={f.birth_date} max={new Date().toISOString().slice(0, 10)} onChange={set("birth_date")} onBlur={checkAge} required />{err("birth_date")}</label>}
        <label>{tx("Geslacht")}
          <select value={f.gender} onChange={set("gender")}><option value="">{tx("Niet opgegeven")}</option>{genders.map((g) => <option key={g} value={g}>{tx(GENDER_LABELS[g])}</option>)}</select>
          {err("gender")}
        </label>
        <label>{tx("Wachtwoord")}<input type={showPw ? "text" : "password"} value={f.password} onChange={set("password")} required autoComplete="new-password" minLength={cfg.password_min_length} />{err("password")}</label>
        <label>{tx("Herhaal wachtwoord")}<input type={showPw ? "text" : "password"} value={f.password2} onChange={set("password2")} required autoComplete="new-password" />{err("password2")}</label>
        <div className="row" style={{ gridColumn: "1 / -1", justifyContent: "flex-start", flexWrap: "wrap" }}>
          <button type="button" className="btn sm" onClick={generatePassword}>{tx("Genereer wachtwoord")}</button>
          <button type="button" className="btn sm" onClick={() => setShowPw(!showPw)} aria-pressed={showPw}>{showPw ? tx("Verberg wachtwoorden") : tx("Toon wachtwoorden")}</button>
          {pwCopied && <span className="badge ok">{tx("Gekopieerd naar het klembord")}</span>}
        </div>
        {(phoneNeeded || f.phone) && <label>{tx("Telefoon")}<input type="tel" value={f.phone} onChange={set("phone")} required={phoneNeeded} placeholder="+31612345678" autoComplete="tel" />{err("phone")}</label>}
        {cfg.twofa_methods?.length > 0 && (
          <label>{tx("Verificatiecode ontvangen via")}
            <select value={f.method} onChange={set("method")}>{cfg.twofa_methods.map((m) => <option key={m} value={m}>{m === "sms" ? tx("Sms") : tx("E-mail")}</option>)}</select>
            {err("method")}
          </label>
        )}
      </div>
      <small className="muted">{tx("Wachtwoord: minimaal {0} tekens", cfg.password_min_length)}{cfg.password_complexity ? tx(", met hoofdletter, kleine letter, cijfer en leesteken") : ""}.
        {cfg.twofa_methods?.length > 0 && tx(" Twee-staps verificatie is verplicht en wordt direct voor je account ingesteld.")}</small>
      {error && <div className="alert">{error}</div>}
      <button className="btn primary" disabled={busy || ["taken", "checking"].includes(nameState.status) || ["invalid", "checking"].includes(emailState.status)}>{busy ? tx("Bezig…") : cfg.verify_email || cfg.twofa_required ? tx("Doorgaan") : tx("Account aanmaken")}</button>
      <Link href="/login" className="muted center">{tx("Al een account? Inloggen")}</Link>
    </Shell>
  );
}
