// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { api, errorText } from "../lib/api";
import { confirmDialog } from "../lib/dialog";
import { setBlock, useSandboxFirst } from "../lib/firstRun";
import { getLanguage, tx } from "../lib/t";
import { useAuth } from "./AuthContext";
import { Logo } from "./BrandingContext";
import { RichText } from "./SmallEditor";
import Tabs from "./Tabs";

// Admins and superadmins must sign the terms and conditions: read them, ask for a code by e-mail and type it. Comes right after the licence message, before the rest.
// A new version (published by the superadmin) must be signed again. On a local server a superadmin gets the code on the screen too (testing); typing @ puts it in.
export default function TermsGate() {
  const { user, logout } = useAuth();
  const adm = !!user && (user.is_staff || Object.values(user.module_levels || {}).some((v) => v >= 2)); // the same rule as on the server: superadmins and everybody with edit rights somewhere
  const { licenseOpen } = useSandboxFirst(adm);
  const [st, setSt] = useState(null);     // {required, signed, version, local, email}
  const [doc, setDoc] = useState(null);   // {title, body, lang, version}
  const [lang, setLang] = useState(getLanguage() || "nl");
  const [tab, setTab] = useState("read");
  const [code, setCode] = useState("");
  const [dev, setDev] = useState("");     // the code on a local server (a superadmin)
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => { if (adm) setBlock("terms", true); }, [adm]); // from the first moment: the other messages wait
  useEffect(() => () => setBlock("terms", false), []);
  useEffect(() => {
    if (!adm) return;
    api("/system/terms/status/").then((s) => { setSt(s); if (!s.required || s.signed) setBlock("terms", false); }).catch(() => setBlock("terms", false));
  }, [adm]);
  useEffect(() => { if (st && st.required && !st.signed) api(`/system/terms/?lang=${lang}`).then(setDoc).catch(() => {}); }, [st, lang]);

  if (!adm || !st || !st.required || st.signed || done || licenseOpen) return null;

  const ask = async () => {
    setBusy(true); setMsg(null);
    try { const r = await api("/system/terms/code/", { method: "POST", body: {} }); setSent(true); setDev(r.dev_code || ""); setMsg({ ok: true, text: r.sent ? tx("De code is naar {0} gestuurd.", st.email) : tx("De e-mail kon niet worden verstuurd; de code staat hieronder.") }); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  const enableMail = async () => { // a superadmin: switch the e-mail link on
    setBusy(true); setMsg(null);
    try {
      const r = await api("/system/terms/enable-mail/", { method: "POST", body: {} });
      if (r.mail_ok) { setSt({ ...st, mail_ok: true }); setDev(""); setMsg({ ok: true, text: tx("De e-mailkoppeling staat aan. Je kunt nu een code laten sturen.") }); }
      else setMsg({ ok: false, text: r.detail });
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  const signSkip = async () => { // a superadmin: without the e-mail code (recorded as such)
    if (!(await confirmDialog(tx("Zonder e-mailcode ondertekenen? Dit wordt zo vastgelegd. Alleen een superadmin kan dit."), { title: tx("Ondertekenen zonder code"), okLabel: tx("Ondertekenen") }))) return;
    setBusy(true); setMsg(null);
    try { await api("/system/terms/sign/", { method: "POST", body: { skip: true, lang: doc?.lang || lang } }); setDone(true); setBlock("terms", false); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  const onCode = async (raw) => { // a superadmin: typing @ puts the code in (the code that came back when it was asked on a local server, else a code that the system makes at once)
    if (raw.includes("@") && user?.is_staff) {
      if (dev) { setCode(dev); return; }
      setBusy(true); setMsg(null);
      try { const r = await api("/system/terms/code/fill/", { method: "POST", body: {} }); setCode(r.code); setSent(true); setMsg({ ok: true, text: tx("De code is automatisch ingevuld. Klik op Ondertekenen.") }); }
      catch (e) { setMsg({ ok: false, text: errorText(e) }); }
      setBusy(false);
      return;
    }
    setCode(raw.replace(/[^0-9]/g, "").slice(0, 6));
  };
  const shown = code.length > 3 ? `${code.slice(0, 3)}-${code.slice(3)}` : code;
  const sign = async () => {
    setBusy(true); setMsg(null);
    try { await api("/system/terms/sign/", { method: "POST", body: { code, lang: doc?.lang || lang } }); setDone(true); setBlock("terms", false); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  const langs = [["nl", "Nederlands"], ["en", "English"]];

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={tx("Algemene voorwaarden")}>
      <div className="card modal form" style={{ maxWidth: 760, width: "100%" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "nowrap" }}>
          <h2 style={{ margin: 0 }}>{doc?.title || tx("Algemene voorwaarden")}</h2>
          <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label={tx("Taal")} style={{ width: "auto" }}>{langs.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </div>
        <p className="muted" style={{ margin: 0 }}>{tx("Als beheerder of superadmin moet je de algemene voorwaarden van easy2edit ondertekenen. Je gebruikt easy2edit op eigen rekening en risico, ook bij hacken en gegevensverlies; je maakt zelf je back-ups.")}</p>
        <Tabs value={tab} onChange={setTab} tabs={[["read", tx("Voorwaarden")], ["sign", tx("Ondertekenen")]]} />
        {tab === "read" && (
          <>
            <div className="terms-text" style={{ maxHeight: "46vh", overflow: "auto", border: "1px solid var(--line)", borderRadius: 12, padding: ".8rem 1rem" }}>
              {doc ? <RichText value={doc.body} /> : <p className="muted">{tx("Laden…")}</p>}
            </div>
            <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
              <button type="button" className="btn" onClick={() => logout?.()}>{tx("Uitloggen")}</button>
              <button type="button" className="btn primary" onClick={() => setTab("sign")}>{tx("Verder naar ondertekenen")}</button>
            </div>
          </>
        )}
        {tab === "sign" && (
          <>
            {/* the look of the e-mail with the code: a card with an orange line on top, the title, and the code in big orange digits */}
            <div style={{ border: "1px solid var(--line)", borderTop: "4px solid var(--blue)", borderRadius: 14, background: "var(--card)", padding: "1.3rem 1.4rem 1.2rem", display: "grid", gap: ".95rem", justifyItems: "center", textAlign: "center" }}>
              <div className="info-logo"><Logo /></div>
              <h3 style={{ margin: 0, fontSize: "1.25rem", lineHeight: 1.3 }}>{tx("Je code voor het ondertekenen van de algemene voorwaarden")}</h3>
              <p className="muted" style={{ margin: 0, maxWidth: 520 }}>{tx("Je ondertekent versie {0} met een code die naar je e-mailadres wordt gestuurd: {1}.", doc?.version || st.version, st.email)}</p>
              <input value={shown} onChange={(e) => onCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={8} placeholder="000-000" aria-label={tx("Code")} autoFocus
                onKeyDown={(e) => { if (e.key === "Enter" && code.length === 6 && !busy) sign(); }}
                style={{ width: "min(17rem, 100%)", textAlign: "center", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "2.2rem", fontWeight: 800, letterSpacing: ".16em", color: "var(--blue)", padding: ".55rem .4rem", borderRadius: 14, border: "1px solid color-mix(in srgb, var(--blue) 35%, var(--line))", background: "color-mix(in srgb, var(--blue) 9%, var(--card))" }} />
              <small className="muted">{tx("De code is 15 minuten geldig. Heb je dit niet zelf gevraagd, negeer dit bericht dan.")}</small>
              <div className="row" style={{ justifyContent: "center", gap: ".6rem" }}>
                <button type="button" className="btn" disabled={busy} onClick={ask}>{sent ? tx("Nieuwe code sturen") : tx("Code sturen")}</button>
                <button type="button" className="btn primary" disabled={busy || code.length !== 6} onClick={sign}>{tx("Ondertekenen")}</button>
              </div>
              {user?.is_staff && <small className="muted">{tx("Superadmin: typ @ in het veld om de code automatisch in te vullen.")}{dev ? ` ${tx("Code")}: ${dev}` : ""}</small>}
            </div>
            {user?.is_staff && (
              <div className="row" style={{ justifyContent: "flex-start", gap: ".5rem", flexWrap: "wrap" }}>
                {st.mail_ok === false && <button type="button" className="btn" disabled={busy} onClick={enableMail}>{tx("E-mailkoppeling aanzetten")}</button>}
                <button type="button" className="btn" disabled={busy} onClick={signSkip}>{tx("Ondertekenen zonder e-mailcode (superadmin)")}</button>
              </div>
            )}
            {st.mail_ok === false && <div className="alert">{tx("Er is geen e-mailkoppeling ingesteld of ze staat uit. Zonder e-mail kunnen geen codes, facturen en meldingen worden verstuurd. Een superadmin zet de koppeling aan bij API keys (Postmark of SMTP); voor betalen is een Stripe-koppeling nodig.")}</div>}
            {msg && <div className={`alert ${msg.ok ? "ok" : ""}`}>{msg.text}</div>}
            <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
              <button type="button" className="btn" onClick={() => setTab("read")}>{tx("Terug naar de voorwaarden")}</button>
              <button type="button" className="btn" onClick={() => logout?.()}>{tx("Uitloggen")}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
