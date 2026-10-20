"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Busy } from "../../../components/PageLoader";
import LanguageSwitcher from "../../../components/LanguageSwitcher";
import ThemeToggle from "../../../components/ThemeToggle";
import NotificationPrefs from "../../../components/NotificationPrefs";
import CodeInput from "../../../components/CodeInput";
import { Logo } from "../../../components/BrandingContext";
import { api, errorText, setToken } from "../../../lib/api";
import { GENDER_LABELS, useGenders } from "../../../lib/genders";
import { checkedBirthMonth } from "../../../lib/age-check";
import { tx } from "../../../lib/t";

const Switch = ({ checked, onChange, disabled }) => (
  <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /><span /></span></label>
);

const Shell = ({ children, onSubmit }) => (
  <main className="login-page">
    <div className="login-theme"><LanguageSwitcher flags /><ThemeToggle /></div>
    <form className="card login-card" style={{ maxWidth: 520 }} onSubmit={onSubmit || ((e) => e.preventDefault())}><Logo />{children}</form>
  </main>
);

// The page of an invitation link: password and terms, e-mail code, the rest of the settings (profile, notifications) and then the dashboard.
export default function Invite() {
  const { token } = useParams();
  const router = useRouter();
  const genders = useGenders();
  const [info, setInfo] = useState(null);
  const [gone, setGone] = useState("");
  const [step, setStep] = useState("account"); // account | verify | profile | prefs
  const [f, setF] = useState({ password: "", password2: "", accept: false });
  const [code, setCode] = useState("");
  const [dest, setDest] = useState("");
  const [sandboxCode, setSandboxCode] = useState("");
  const [p, setP] = useState({ display_name: "", birth_date: "", gender: "", phone: "" });
  const [prefs, setPrefs] = useState(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const base = `/invite/${token}/`;

  useEffect(() => { api(base).then((d) => { setInfo(d); setP((x) => ({ ...x, display_name: d.first_name })); }).catch((e) => setGone(errorText(e))); }, [base]);

  const done = async (r) => {
    setToken(r.token);
    setP((x) => ({ ...x, display_name: r.user?.display_name || x.display_name, birth_date: x.birth_date || checkedBirthMonth() }));
    setStep("profile");
    setBusy(false);
  };
  async function account(e) {
    e.preventDefault();
    setError("");
    if (f.password !== f.password2) return setError(tx("De wachtwoorden zijn niet gelijk."));
    setBusy(true);
    try {
      const r = await api(base, { method: "POST", body: { password: f.password, accept_terms: f.accept } });
      if (r.done) return done(r);
      setDest(r.destination); setSandboxCode(r.sandbox_code || ""); setStep("verify"); setBusy(false);
    } catch (er) { setError(errorText(er)); setBusy(false); }
  }
  async function verify(e) {
    e?.preventDefault();
    setError(""); setBusy(true);
    try { done(await api(`${base}verify/`, { method: "POST", body: { code } })); } catch (er) { setError(errorText(er)); setCode(""); setBusy(false); }
  }
  async function resend() {
    setError(""); setMsg("");
    try { const r = await api(`${base}resend/`, { method: "POST", body: {} }); if (r.sandbox_code) setSandboxCode(r.sandbox_code); setMsg(tx("Nieuwe code verstuurd.")); } catch (er) { setError(errorText(er)); }
  }
  async function profile(e) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      await api("/auth/me/", { method: "PATCH", body: { display_name: p.display_name, phone: p.phone, gender: p.gender, birth_date: p.birth_date || null } });
      let pr = null;
      try { pr = await api("/notify/prefs/"); } catch {}
      if (pr?.kinds?.length) { setPrefs(pr); setStep("prefs"); } else router.push("/dashboard");
    } catch (er) { setError(errorText(er)); }
    setBusy(false);
  }
  async function setPref(k, field, v) {
    const kinds = prefs.kinds.map((x) => (x.key === k ? { ...x, [field]: v } : x));
    setPrefs({ ...prefs, kinds });
    const row = kinds.find((x) => x.key === k);
    try { await api("/notify/prefs/", { method: "PUT", body: { kinds: { [k]: { show: row.show, email: row.email } } } }); } catch (er) { setError(errorText(er)); }
  }

  const steps = () => {
    const all = [["account", "Account"], ...(info?.require_email_verify ? [["verify", "Controle"]] : []), ["profile", "Profiel"], ["prefs", "Meldingen"]];
    return <ol className="invite-steps">{all.map(([k, l]) => <li key={k} className={step === k ? "on" : ""}>{tx(l)}</li>)}</ol>;
  };

  if (gone) return <Shell><h1>{tx("Uitnodiging")}</h1><div className="alert">{gone}</div><Link href="/login" className="btn">{tx("Naar inloggen")}</Link></Shell>;
  if (!info) return <Shell><Busy /></Shell>;

  if (step === "account") return (
    <Shell onSubmit={account}>
      <h1>{tx("Welkom, {0}", info.first_name)}</h1>
      <p className="muted">{tx("Je bent uitgenodigd om een account aan te maken voor {0}. Kies een wachtwoord om te beginnen.", info.email)}</p>
      {steps()}
      <label>{tx("Naam")}<input value={`${info.first_name} ${info.last_name}`} disabled /></label>
      <label>{tx("E-mailadres")}<input value={info.email} disabled /></label>
      <label>{tx("Wachtwoord")}<input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required autoComplete="new-password" minLength={info.password_min_length || 8} /></label>
      <label>{tx("Herhaal wachtwoord")}<input type="password" value={f.password2} onChange={(e) => setF({ ...f, password2: e.target.value })} required autoComplete="new-password" /></label>
      {info.require_terms && (
        <label className="check"><input type="checkbox" checked={f.accept} onChange={(e) => setF({ ...f, accept: e.target.checked })} required /> <span>{tx("Ik ga akkoord met de")} <a href={info.terms_url} target="_blank" rel="noreferrer">{tx("voorwaarden")}</a></span></label>
      )}
      {error && <div className="alert">{error}</div>}
      <button className="btn primary" disabled={busy}>{tx("Verder")}</button>
    </Shell>
  );

  if (step === "verify") return (
    <Shell onSubmit={verify}>
      <h1>{tx("Bevestig je e-mailadres")}</h1>
      {steps()}
      <p className="muted">{tx("We hebben een code gestuurd naar {0}.", dest)}</p>
      {sandboxCode && <div className="alert ok">{tx("Sandbox: je code is {0}", sandboxCode)}</div>}
      <CodeInput value={code} onChange={setCode} autoFocus onComplete={(c) => setTimeout(verify, 0)} invalid={!!error} />
      {error && <div className="alert">{error}</div>}
      {msg && <p className="muted">{msg}</p>}
      <button className="btn primary" disabled={busy || code.length < 6}>{tx("Bevestigen")}</button>
      <button type="button" className="btn" onClick={resend}>{tx("Code opnieuw versturen")}</button>
    </Shell>
  );

  if (step === "profile") return (
    <Shell onSubmit={profile}>
      <h1>{tx("Je profiel")}</h1>
      {steps()}
      <p className="muted">{tx("Je account is aangemaakt. Loop even langs je instellingen.")}</p>
      <label>{tx("Naam die anderen zien")}<input value={p.display_name} onChange={(e) => setP({ ...p, display_name: e.target.value })} required maxLength={60} /></label>
      <label>{tx("Geboortedatum")}{p.birth_date.endsWith("-01") && <small className="muted"> {tx("Maand en jaar komen uit de leeftijdscheck; vul de dag aan.")}</small>}<input type="date" value={p.birth_date} onChange={(e) => setP({ ...p, birth_date: e.target.value })} /></label>
      <label>{tx("Geslacht")}<select value={p.gender} onChange={(e) => setP({ ...p, gender: e.target.value })}><option value="">—</option>{genders.map((g) => <option key={g} value={g}>{tx(GENDER_LABELS[g])}</option>)}</select></label>
      <label>{tx("Telefoon (met landcode)")}<input value={p.phone} placeholder="+31612345678" onChange={(e) => setP({ ...p, phone: e.target.value })} /></label>
      <label>{tx("Taal van de website")}<span style={{ display: "block" }}><LanguageSwitcher flags /></span></label>
      {error && <div className="alert">{error}</div>}
      <button className="btn primary" disabled={busy || !p.display_name.trim()}>{tx("Volgende")}</button>
    </Shell>
  );

  return (
    <Shell onSubmit={(e) => { e.preventDefault(); router.push("/dashboard"); }}>
      <h1>{tx("Meldingen")}</h1>
      {steps()}
      <p className="muted">{tx("Kies welke meldingen je wilt zien en wanneer je een e-mail wilt. Je kunt dit later altijd aanpassen.")}</p>
      <NotificationPrefs bare />
      {error && <div className="alert">{error}</div>}
      <button className="btn primary">{tx("Naar het dashboard")}</button>
    </Shell>
  );
}
