"use client";

import { tx } from "../../lib/t";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "../../components/BrandingContext";
import ThemeToggle from "../../components/ThemeToggle";
import { api, setToken, errorText } from "../../lib/api";
import { GENDER_LABELS, useGenders } from "../../lib/genders";

const EMPTY = { first_name: "", last_name: "", display_name: "", email: "", password: "", password2: "", birth_date: "", gender: "", phone: "", method: "", accept: false };

// defined outside the page so the inputs keep their focus while typing
const Shell = ({ children, onSubmit }) => (
  <main className="login-page">
    <div className="login-theme"><ThemeToggle /></div>
    <form className="card login-card" style={{ maxWidth: 520 }} onSubmit={onSubmit}>{children}</form>
  </main>
);

// Self sign-up. The account is only created after the verifications the security settings ask for.
export default function Register() {
  const genders = useGenders();
  const router = useRouter();
  const [cfg, setCfg] = useState(null);
  const [f, setF] = useState(EMPTY);
  const [step, setStep] = useState(null); // null = form, else {token, step, destination, steps_left}
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/auth/register/config/").then((c) => { setCfg(c); if (c.twofa_methods?.length) setF((x) => ({ ...x, method: c.twofa_methods[0] })); }).catch((e) => setError(errorText(e)));
  }, []);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
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
      const r = await api("/auth/register/", { method: "POST", body: { ...body, birth_date: body.birth_date || undefined } });
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
    try { await api("/auth/register/resend/", { method: "POST", body: { token: step.token } }); setInfo(tx("Nieuwe code verstuurd.")); }
    catch (e2) { setError(errorText(e2)); }
  }

  if (!cfg) return <Shell onSubmit={(e) => e.preventDefault()}><Logo />{error ? <div className="alert">{error}</div> : <p className="muted">{tx("Laden…")}</p>}</Shell>;
  if (!cfg.enabled) return <Shell onSubmit={(e) => e.preventDefault()}><Logo /><h1>{tx("Aanmelden")}</h1><p className="muted">{tx("Aanmelden is op dit moment niet mogelijk.")}</p><Link href="/login" className="btn">{tx("Naar inloggen")}</Link></Shell>;
  if (cfg.unavailable) return <Shell onSubmit={(e) => e.preventDefault()}><Logo /><h1>{tx("Aanmelden")}</h1><div className="alert">{tx("Aanmelden is tijdelijk niet mogelijk. Probeer het later opnieuw.")}</div><Link href="/login" className="btn">{tx("Naar inloggen")}</Link></Shell>;

  if (step) {
    return (
      <Shell onSubmit={verify}>
        <Logo />
        <h1>{step.step === "sms" ? tx("Bevestig je telefoonnummer") : tx("Bevestig je e-mailadres")}</h1>
        <p className="muted" style={{ margin: 0 }}>{tx("We hebben een code gestuurd naar")} {step.destination}{tx(". Je account wordt aangemaakt zodra dit gelukt is.")}</p>
        <label>{tx("Code")}
          <input value={code} onChange={(e) => setCode(e.target.value)} required autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={8} />
        </label>
        {error && <div className="alert">{error}</div>}
        {info && <div className="alert ok">{info}</div>}
        <button className="btn primary" disabled={busy}>{busy ? tx("Bezig…") : tx("Bevestigen")}</button>
        <button type="button" className="btn" onClick={resend}>{tx("Code opnieuw sturen")}</button>
        <button type="button" className="muted center" style={{ background: "none", border: 0, cursor: "pointer" }} onClick={() => { setStep(null); setCode(""); setError(""); setInfo(""); }}>{tx("← Gegevens aanpassen")}</button>
      </Shell>
    );
  }

  const phoneNeeded = cfg.require_phone || f.method === "sms";
  return (
    <Shell onSubmit={submit}>
      <Logo />
      <h1>{tx("Aanmelden")}</h1>
      <div className="grid2">
        <label>{tx("Voornaam")}<input value={f.first_name} onChange={set("first_name")} required autoFocus autoComplete="given-name" />{err("first_name")}</label>
        <label>{tx("Achternaam")}<input value={f.last_name} onChange={set("last_name")} autoComplete="family-name" />{err("last_name")}</label>
        <label>{tx("Profielnaam")}<input value={f.display_name} onChange={set("display_name")} maxLength={60} placeholder={tx("Zo zien anderen je")} />{err("display_name")}</label>
        <label>{tx("E-mailadres")}<input type="email" value={f.email} onChange={set("email")} required autoComplete="email" />{err("email")}</label>
        {cfg.birth_date && <label>{tx("Geboortedatum")}{cfg.min_age ? <em className="muted"> ({cfg.min_age}+)</em> : null}
          <input type="date" value={f.birth_date} max={new Date().toISOString().slice(0, 10)} onChange={set("birth_date")} required />{err("birth_date")}</label>}
        <label>{tx("Geslacht")}
          <select value={f.gender} onChange={set("gender")}><option value="">{tx("Niet opgegeven")}</option>{genders.map((g) => <option key={g} value={g}>{tx(GENDER_LABELS[g])}</option>)}</select>
          {err("gender")}
        </label>
        <label>{tx("Wachtwoord")}<input type="password" value={f.password} onChange={set("password")} required autoComplete="new-password" minLength={cfg.password_min_length} />{err("password")}</label>
        <label>{tx("Herhaal wachtwoord")}<input type="password" value={f.password2} onChange={set("password2")} required autoComplete="new-password" />{err("password2")}</label>
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
      <button className="btn primary" disabled={busy}>{busy ? tx("Bezig…") : cfg.verify_email || cfg.twofa_required ? tx("Doorgaan") : tx("Account aanmaken")}</button>
      <Link href="/login" className="muted center">{tx("Al een account? Inloggen")}</Link>
    </Shell>
  );
}
