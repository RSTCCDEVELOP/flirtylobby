// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, errorText, downloadPost } from "../lib/api";
import { tx, getLanguage } from "../lib/t";
import { useAuth } from "./AuthContext";
import { canAdmin } from "../lib/perms";
import { useModules } from "./Modules";
import { IconCheck, IconReceipt } from "./Icons";
import PhoneInput from "./PhoneInput";
import { confirmDialog } from "../lib/dialog";
import CostsInfo from "./CostsInfo";
import { revertSwitch } from "./LicenseChangePrompt";
import { money } from "../lib/format";
import KitScope from "../lib/ui-kit/KitScope";
import { RichText } from "./SmallEditor";
import CodeInput from "./CodeInput";
import { setBlock, useSandboxFirst } from "../lib/firstRun";
import Loading from "./Loading";

// The basic data (name, main address, address, contact person, e-mail and phone numbers) are required. Are they empty when an administrator logs in? Then this wizard opens.
// Everybody who may administer can fill it in; only a superadmin may close it without filling it in (for this session).
const STEPS = [
  ["site", "Website", ["site_name", "company_name", "frontend_url"]],
  ["address", "Adres", ["street", "house_number", "postal_code", "city", "country"]],
  ["contact", "Contact", ["contact_first_name", "contact_last_name", "contact_email", "mobile"]],
  ["agree", "Voorwaarden", ["consent_ok"]],  // the terms of easy2edit: read to the end, then the consent with a code by e-mail or SMS (only when the licence is made now); a superadmin passes it with an @
  ["hosting", "Hosting", ["hosting"]],  // the hosting that goes with the licence (only when there is no licence yet): from the price list
  ["preset", "Standaard installatie", []],  // the standard installation decides what is in use and so what it costs: chosen between the hosting and the costs
  ["ai", "AI-tegoed", []],  // optional: AI credit to buy once the licence is made (it is bought in the next screen, at the payment page); before the costs
  ["trees", "Bomen planten", []],  // easy2edit plants trees with every website (the link with Ecologi is mandatory and always on); the choice and the cost; before the costs
  ["costs", "Kosten", ["license_until"]],
  ["pay", "Betalen", ["pay_ok"]],  // a Stripe subscription (test mode with test keys): the licence is made only after paying
  ["overview", "Overzicht", []],  // the last screen: everything of the licence together, with its number; Save makes it
   // what the website costs, from everything that is in use; the end date of the licence (only when there is no licence yet: it is made by itself)
];
const SKIP_KEY = "e2e_setup_skipped";
// Only for testing: on this computer (localhost) a superadmin who types a single @ in any field gets all fields filled with made-up data.
const TEST_DATA = { site_name: "Testwebsite", company_name: "Testbedrijf BV", frontend_url: "www.testbedrijf.nl", street: "Teststraat", house_number: "12", postal_code: "1234 AB", city: "Utrecht", country: "Nederland",
  contact_first_name: "Test", contact_last_name: "Gebruiker", contact_email: "demo@easy2edit.com", phone: "+31 301234567", mobile: "+31 612345678" };
const isLocal = () => typeof window !== "undefined" && ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);

export default function SetupWizard() {
  const { user } = useAuth();
  const mods = useModules();
  const first = useSandboxFirst(!!user?.is_staff); // the onboarding done again: the form comes after the first questions (welcome, licence check, terms, sandbox, manual)
  const allowed = !!user && (user.is_staff || canAdmin(user, mods));
  const [d, setD] = useState(null);
  const [form, setForm] = useState({});
  const [step, setStep] = useState("site");
  const [error, setError] = useState("");
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const [closed, setClosed] = useState(false);
  const [costs, setCosts] = useState(null);
  const [termsDoc, setTermsDoc] = useState(null); // the terms and conditions of easy2edit (step Voorwaarden)
  const [termsErr, setTermsErr] = useState(false);
  const [termsRead, setTermsRead] = useState(false); // read to the end: only then the consent is asked
  const termsBox = useRef(null);
  const [presetList, setPresetList] = useState(null); // the standard installations (read when the step is opened)
  const [presetBusy, setPresetBusy] = useState(false);
  const [costInfo, setCostInfo] = useState(false);
  const [upd, setUpd] = useState(null);  // update mode: a module or plugin was switched on or off and the licence price changed: {old, new, delta, number}; the licence is updated with a new agreement
  const [done, setDone] = useState(null);  // the licence that was made: shown when everything is saved
  const [pay, setPay] = useState({ busy: false, error: "" });  // the payment step (Stripe)
  const [owner, setOwner] = useState({ source: "email", checked: "", status: "", challenge: "", hint: "", code: "", busy: false, error: "" });  // the contact e-mail is known on the easy2edit server: "" | "found" | "code" | "done"
  const [consent, setConsent] = useState({ method: "email", sent: false, busy: false, error: "", shown: "" });  // the consent with the licence: a code (000-000) by e-mail or SMS
  const [forced, setForced] = useState(false);  // opened again by hand (button on the Basisgegevens page), also when everything is filled in

  useEffect(() => {
    if (!allowed) return;
    try { if (sessionStorage.getItem(SKIP_KEY)) { setClosed(true); return; } } catch { /* no storage */ }
    api("/system/setup/").then((r) => { setD(r); setForm({ ...(r.settings || {}), license_until: r.license_until || "", renew_months: r.renew_months || 12, hosting: r.hosting_current || r.hosting_default || "shared", consent_ok: r.consent_ok ? "1" : "", pay_ok: r.pay?.ok ? "1" : "" }); if (r.settings && !r.settings.frontend_url && typeof window !== "undefined") setForm((f) => ({ ...f, frontend_url: window.location.origin.includes("localhost") ? "" : window.location.origin })); }).catch(() => {});
  }, [allowed]);

  useEffect(() => {
    if (!allowed) return undefined;
    const again = (to, detail) => (detail?.mode === "update" ? api("/system/license/update/reset/", { method: "POST", body: {} }).catch(() => {}) : Promise.resolve()).then(() => api("/system/setup/")).then((r) => { setD(r); setForm({ ...(r.settings || {}), license_until: r.license_until || "", renew_months: r.renew_months || 12, hosting: r.hosting_current || r.hosting_default || "shared", consent_ok: r.consent_ok ? "1" : "", pay_ok: r.pay?.ok ? "1" : "" }); setErrs({}); setError(""); setUpd(detail?.mode === "update" ? detail.change : null); setStep(detail?.mode === "update" ? "costs" : typeof to === "string" ? to : "site"); setClosed(false); setForced(true); }).catch(() => {});
    const onOpen = (e) => again(undefined, e?.detail);
    window.addEventListener("open-setup-wizard", onOpen);
    try { // back from Stripe: is the session paid? Then the wizard goes on with the agreement
      const qs = new URLSearchParams(window.location.search);
      if (qs.get("setup_paid") && qs.get("session_id")) {
        window.history.replaceState(null, "", window.location.pathname);
        api("/system/setup/pay/confirm/", { method: "POST", body: { session_id: qs.get("session_id") } }).then(() => again("overview")).catch((e) => { again("pay").then(() => setError(errorText(e))); });
      } else if (qs.get("setup_cancel")) { window.history.replaceState(null, "", window.location.pathname); again("pay"); }
    } catch { /* no address bar */ }
    try { if (sessionStorage.getItem("e2e_open_setup")) { sessionStorage.removeItem("e2e_open_setup"); again(); } } catch { /* no storage */ }  // asked for on another page (the licence question): open now
    return () => window.removeEventListener("open-setup-wizard", onOpen);
  }, [allowed]);

  useEffect(() => { // the hosting options come from the price list: read them again when they are not there (an older answer of the server)
    if (step === "hosting" && d && !(d.hosting_options || []).length) api("/system/setup/").then((r) => { setD(r); setForm((f) => ({ ...f, hosting: f.hosting || r.hosting_default || "shared" })); }).catch(() => {});
  }, [step, d]); // eslint-disable-line react-hooks/exhaustive-deps

  // The terms: the chosen language, then Dutch and English when that one is empty. A failed or empty answer is never kept: it is asked again (a few times by itself, or with the button).
  const loadTerms = async () => {
    setTermsErr(false);
    for (let i = 0; i < 3; i += 1) {
      for (const lang of [...new Set([getLanguage(), "nl", "en"])]) {
        try { const r = await api(`/system/terms/?lang=${lang}`); if (r?.body) { setTermsDoc(r); return; } } catch { /* try the next one */ }
      }
      await new Promise((r) => setTimeout(r, 800));
    }
    setTermsDoc(null); setTermsErr(true);
  };
  useEffect(() => { // the terms of easy2edit for the step Voorwaarden
    if (step !== "agree" || termsDoc?.body) return;
    loadTerms();
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { // a text that fits without scrolling counts as read
    const el = termsBox.current;
    if (step === "agree" && el && termsDoc && el.scrollHeight <= el.clientHeight + 8) setTermsRead(true);
  }, [step, termsDoc]);
  useEffect(() => { // the password of the contact person (made a user with admin rights when the licence is made): a new one for the overview
    if (step === "overview" && d?.needs_license && !form.contact_password) api("/system/setup/password/").then((r) => setForm((f) => ({ ...f, contact_password: r.password }))).catch(() => {});
  }, [step, d?.needs_license]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { // the standard installations with their price: for the step "Standaard installatie" (administrators see the ones that were released for them)
    if (step !== "preset" || presetList) return;
    api("/system/presets/").then((l) => { const list = user?.is_staff ? l : l.filter((x) => x.admin); setPresetList(list); setForm((f) => ({ ...f, preset: f.preset || (list.find((x) => x.active) || list[0] || {}).key || "" })); /* the one in use; nothing known: the first one */ }).catch(() => setPresetList([]));
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const [aiInfo, setAiInfo] = useState(null); // the offer of AI credit (the slider): read when the step "AI-tegoed" is opened
  useEffect(() => {
    if (step !== "ai" || aiInfo) return;
    api("/ai/me/").then(setAiInfo).catch(() => setAiInfo({ module: false }));
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  const [treesInfo, setTreesInfo] = useState(null);
  const [treesOn, setTreesOn] = useState(true);
  useEffect(() => {
    if (step !== "trees" || treesInfo) return;
    api("/ecologi/onboarding/").then((r) => { setTreesInfo(r); setTreesOn(!r.asked || r.linked); }).catch(() => setTreesInfo({ error: true, per_tree: 0.8, service_fee: 0, currency: "EUR", examples: [] }));
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  const chooseTrees = async (on) => { setTreesOn(on); try { await api("/ecologi/onboarding/", { method: "POST", body: { choice: on ? "yes" : "no" } }); } catch { /* shown again at the next login (onboarding) */ } };
  const setAiAmount = (v) => { setForm((f) => ({ ...f, ai_amount: v ? String(v) : "" })); try { if (v) sessionStorage.setItem("e2e_ai_amount", String(v)); else sessionStorage.removeItem("e2e_ai_amount"); } catch {} };

  useEffect(() => { // the costs of everything that is in use (read when the tab is opened)
    if ((step === "costs" || step === "pay" || step === "overview") && !costs) api("/system/license/usage/").then(setCosts).catch(() => setCosts({ items: [], error: true }));
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // what is known about the logged in person (the server's suggestion, and the profile of the login itself) is read in when a step is shown: only the fields that are still empty
  useEffect(() => {
    if (!d?.needed && !forced) return;
    const known = { contact_first_name: user?.first_name, contact_last_name: user?.last_name, contact_email: user?.email, mobile: user?.phone, ...(d.suggest || {}) };
    setForm((f) => {
      const o = { ...f };
      STEPS.find((x) => x[0] === step)[2].forEach((k) => { if (!String(o[k] || "").trim() && String(known[k] || "").trim()) o[k] = String(known[k]).trim(); });
      return o;
    });
  }, [step, d, user, forced]); // eslint-disable-line react-hooks/exhaustive-deps

  const waiting = !forced && !done && (first.welcomeOpen || first.licenseMessageOpen || (user?.is_staff && !first.known)); // the very first question (colour) and the licence message come before the form
  const shown = !!allowed && !closed && !!(d?.needed || forced || done) && typeof document !== "undefined" && !waiting;
  useEffect(() => { // while the form (where the licence is made) or the screen "licence made" is open, the terms, the AI and the rest wait for it; they follow when it is closed
    setBlock("setup", shown);
    return () => setBlock("setup", false);
  }, [shown]);
  if (!shown) return null;
  const steps = upd ? STEPS.filter((x) => ["costs", "agree", "pay", "overview"].includes(x[0])).map((x) => (x[0] === "costs" ? [x[0], x[1], []] : x)) : STEPS.filter((x) => (x[0] !== "trees" || user?.is_staff)).filter((x) => (x[0] !== "hosting" && x[0] !== "agree" && x[0] !== "pay" && x[0] !== "overview") || (d.needs_license && (x[0] !== "pay" || d.pay?.provider || user?.is_staff || user?.is_superadmin_plus))).map((x) => (x[0] === "costs" && !d.needs_license ? [x[0], x[1], []] : x));
  const hostOpt = d.needs_license ? (d.hosting_options || []).find((o) => o.key === form.hosting) : null;  // the chosen hosting: a line of the price (not in the base price)
  const hostPrice = hostOpt ? Number(hostOpt.price) : 0;
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrs((x) => ({ ...x, [k]: "" })); };
  const empty = (k) => !String(form[k] || "").trim();
  const stepIdx = steps.findIndex((s) => s[0] === step);
  const stepDone = (s) => !steps.find((x) => x[0] === s)[2].some(empty);
  const checkStep = () => {
    const bad = {};
    steps[stepIdx][2].forEach((k) => { if (empty(k)) bad[k] = tx("Dit veld is verplicht."); });
    setErrs((x) => ({ ...x, ...bad }));
    return !Object.keys(bad).length;
  };
  // what is known about the logged in person is read when you go to a step: only the fields that are still empty
  const fill = (key) => setForm((f) => { const o = { ...f }; steps.find((s) => s[0] === key)[2].forEach((k) => { if (!String(o[k] || "").trim() && d.suggest?.[k]) o[k] = d.suggest[k]; }); return o; });
  const next = async () => {
    if (!checkStep()) return;
    if (step === "preset" && form.preset && presetList && !(presetList.find((x) => x.key === form.preset) || {}).active) {  // another installation than the one in use: it is set now, so the costs follow it (no data is removed)
      setPresetBusy(true); setError("");
      try { await api(`/system/presets/${form.preset}/apply/`, { method: "POST", body: { overwrite_pages: false } }); setCosts(null); await api("/system/presets/").then((l) => setPresetList(user?.is_staff ? l : l.filter((x) => x.admin))).catch(() => {}); window.dispatchEvent(new Event("presets-changed")); }
      catch (e) { setError(errorText(e)); setPresetBusy(false); return; }
      setPresetBusy(false);
    }
    const n = steps[stepIdx + 1][0]; fill(n); setStep(n);
  };
  const saveUpdate = async () => {  // update mode: the licence runs on with the new price (same number)
    setBusy(true); setError("");
    try { const r = await api("/system/license/update/", { method: "POST", body: {} }); setForced(false); setUpd(null); window.dispatchEvent(new Event("setup-saved")); setDone({ ...r.license, updated: true, old: r.old, new: r.new }); }
    catch (e) { setError(errorText(e)); if (e?.data?.errors?.consent) setStep("agree"); else if (e?.data?.errors?.pay) setStep("pay"); }
    setBusy(false);
  };
  const save = async () => {
    if (upd) return saveUpdate();
    if (!checkStep()) return;
    setBusy(true); setError("");
    try { const r = await api("/system/setup/", { method: "PUT", body: form }); setD(r); if (r.needed) setError(tx("Niet alle verplichte velden zijn ingevuld.")); else { setForced(false); window.dispatchEvent(new Event("setup-saved")); /* the last screen: "Voltooid" with "Afronden en verder gaan" (also when the licence was there already or the onboarding is done again); the reload that follows brings the next steps (terms, installation, AI, design wizard) */ setDone(r.license?.number && d.needs_license ? r.license : { finished: true, number: r.license?.number || "", client: form.company_name, main_url: form.frontend_url, valid_until: r.license?.valid_until }); } }
    catch (e) {
      const bad = Object.fromEntries(Object.entries(e?.data?.errors || {}).map(([k, v]) => [k, tx(v)]));  // each message in the chosen language
      setError(Object.keys(bad).length ? Object.values(bad).join(" ") : errorText(e));
      setErrs(bad);
      const first = bad.consent ? steps.find((s) => s[0] === "agree") : steps.find((s) => s[2].some((k) => bad[k]));
      if (first) setStep(first[0]);
    }
    setBusy(false);
  };
  const closeWizard = () => { // closing the update screen before it is finished: the decision is undone (the switched module or plugin goes back) and the code and payment are cleared
    if (upd) { const c = upd; setUpd(null); api("/system/license/update/reset/", { method: "POST", body: {} }).catch(() => {}); revertSwitch(c); }
    setForced(false); setClosed(true);
  };
  const skip = () => { try { sessionStorage.setItem(SKIP_KEY, "1"); } catch { /* no storage */ } setClosed(true); };
  // the fields are the form components of the set (ui-form-fields): e2e-field, e2e-label, e2e-input, e2e-error
  const field = (k, label, { type = "text", span, ...rest } = {}) => (
    <div key={k} className="e2e-field" style={span ? { gridColumn: span } : undefined}>
      <label className="e2e-label" htmlFor={`sw-${k}`}><span>{label} <span style={{ color: "var(--e2e-danger)" }} aria-hidden="true">*</span></span></label>
      <input id={`sw-${k}`} className={`e2e-input${errs[k] ? " e2e-input--error" : ""}`} type={type} value={form[k] || ""} onChange={set(k)} aria-invalid={errs[k] ? "true" : undefined} aria-required="true" {...rest} />
      {errs[k] && <span className="e2e-error">{errs[k]}</span>}
    </div>
  );
  const phoneField = (k, label, req) => (
    <div key={k} className="e2e-field">
      <label className="e2e-label" htmlFor={`sw-${k}`}><span>{label}{req && <> <span style={{ color: "var(--e2e-danger)" }} aria-hidden="true">*</span></>}</span></label>
      <PhoneInput id={`sw-${k}`} value={form[k] || ""} onChange={(v) => { setForm((f) => ({ ...f, [k]: v })); setErrs((x) => ({ ...x, [k]: "" })); }} invalid={!!errs[k]} required={req} />
      {errs[k] && <span className="e2e-error">{errs[k]}</span>}
    </div>
  );
  const pct = Math.round((steps.filter((s) => stepDone(s[0])).length / steps.length) * 100);
  // the consent: send a code, check it (the code has the form 000-000)
  const canMail = !!d.consent_methods?.email || (isLocal() && user?.is_staff), canSms = !!d.consent_methods?.sms || (isLocal() && user?.is_staff);
  const startPay = async () => {
    setPay({ busy: true, error: "" });
    try { const r = await api("/system/setup/pay/", { method: "POST", body: form }); window.location.assign(r.url); }
    catch (e) { setPay({ busy: false, error: errorText(e) }); }
  };
  const payTest = async () => { // only for testing, on localhost: as if it was paid
    setPay({ busy: true, error: "" });
    try { await api("/system/setup/pay/test/", { method: "POST", body: {} }); setForm((f) => ({ ...f, pay_ok: "1" })); setPay({ busy: false, error: "" }); } catch (e) { setPay({ busy: false, error: errorText(e) }); }
  };
  const payNone = async () => { // not paying: a warning first; the licence then runs for a short time only
    if (!(await confirmDialog(tx("Als je niet betaalt, gaat je website binnenkort in free mode. Wil je toch doorgaan zonder te betalen?"), { okLabel: tx("Toch doorgaan"), cancelLabel: tx("Annuleren") }))) return;
    setPay({ busy: true, error: "" });
    try { await api("/system/setup/pay/none/", { method: "POST", body: { hosting: form.hosting, renew_months: form.renew_months } }); setForm((f) => ({ ...f, pay_ok: "1", pay_none_done: "1", pay_invoice_done: "" })); setPay({ busy: false, error: "" }); }
    catch (e) { setPay({ busy: false, error: errorText(e) }); }
  };
  const payUpdate = async (choice) => { // update mode: after the code, the new amount is confirmed (paid the way the licence is paid) or not paid
    if (choice === "none" && !(await confirmDialog(tx("Als je niet betaalt, gaat je website binnenkort in free mode. Wil je toch doorgaan zonder te betalen?"), { okLabel: tx("Toch doorgaan"), cancelLabel: tx("Annuleren") }))) return;
    setPay({ busy: true, error: "" });
    try { await api("/system/license/update/pay/", { method: "POST", body: { choice } }); setForm((f) => ({ ...f, pay_ok: "1", pay_none_done: choice === "none" ? "1" : "" })); setPay({ busy: false, error: "" }); }
    catch (e) { setPay({ busy: false, error: errorText(e) }); }
  };
  const downloadPdf = async () => { // the licence overview as a PDF (with the easy2edit logo)
    setPay((p) => ({ ...p, error: "" }));
    try { await downloadPost("/system/setup/pdf/", { ...form, lang: getLanguage(), pay: form.pay_none_done === "1" ? "none" : form.pay_invoice_done === "1" ? "invoice" : form.pay_ok === "1" ? "stripe" : "open" }, `easy2edit-licence-${(upd ? upd.number : d.license_number) || ""}.pdf`.replace("-.pdf", ".pdf")); }
    catch (e) { setPay((p) => ({ ...p, error: errorText(e) })); }
  };
  const payInvoice = async () => { // a superadmin: the licence is paid on account (an invoice)
    setPay({ busy: true, error: "" });
    try { await api("/system/setup/pay/invoice/", { method: "POST", body: { hosting: form.hosting, renew_months: form.renew_months } }); setForm((f) => ({ ...f, pay_ok: "1", pay_invoice_done: "1", pay_none_done: "" })); setPay({ busy: false, error: "" }); }
    catch (e) { setPay({ busy: false, error: errorText(e) }); }
  };
  const method = canMail && (consent.method === "email" || !canSms) ? "email" : "sms";  // SMS only when the SMS service (API keys) is on
  const sendCode = async () => {
    setConsent((c) => ({ ...c, busy: true, error: "" }));
    try {
      const to = method === "email" ? form.contact_email : String(form.mobile || "").replace(/[\s-]/g, "");
      const r = await api("/system/setup/consent/", { method: "POST", body: { method, to } });
      setConsent((c) => ({ ...c, busy: false, sent: true, shown: r.code || "" }));
      return r.code || "";
    } catch (e) { setConsent((c) => ({ ...c, busy: false, error: errorText(e) })); return ""; }
  };
  const checkCode = async (code) => {
    setConsent((c) => ({ ...c, busy: true, error: "" }));
    try { await api("/system/setup/consent/verify/", { method: "POST", body: { code } }); setForm((f) => ({ ...f, consent_ok: "1" })); setErrs((x) => ({ ...x, consent_ok: "" })); setConsent((c) => ({ ...c, busy: false })); }
    catch (e) { setConsent((c) => ({ ...c, busy: false, error: errorText(e) })); }
  };
  const typeCode = async (raw) => {  // raw: the digits from the code boxes, or "@" (a superadmin shortcut)
    let v = raw;
    if (v === "@" && user?.is_staff) {  // a superadmin passes the code with an @ (also on a live website): approved at once
      setConsent((c) => ({ ...c, busy: true, error: "" }));
      try { await api("/system/setup/consent/verify/", { method: "POST", body: { code: "@" } }); setForm((f) => ({ ...f, consent_code: "000-000", consent_ok: "1" })); setErrs((x) => ({ ...x, consent_ok: "" })); setConsent((c) => ({ ...c, busy: false })); }
      catch (err) { setConsent((c) => ({ ...c, busy: false, error: errorText(err) })); }
      return;
    }
    if (v === "@" && user?.is_staff && isLocal()) { const c = consent.shown || await sendCode(); if (c) setForm((f) => ({ ...f, consent_code: c, consent_ok: "" })); return; }  // only for testing on this computer: an @ puts the code in the field (not approved yet: that happens with Next)
    v = v.replace(/\D/g, "").slice(0, 6);
    v = v.length > 3 ? `${v.slice(0, 3)}-${v.slice(3)}` : v;
    setForm((f) => ({ ...f, consent_code: v }));
    if (v.length === 7) checkCode(v);
  };
  const OWNER_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
  const lookupOwner = async () => {  // the contact e-mail is left: is it known on the easy2edit server already?
    const email = String(form.contact_email || "").trim().toLowerCase();
    if (!OWNER_RE.test(email) || email === owner.checked || d?.license_server?.mode !== "linked") return;
    setOwner({ source: "email", checked: email, status: "", challenge: "", hint: "", code: "", busy: false, error: "" });
    try { const r = await api("/system/setup/owner/lookup/", { method: "POST", body: { email } }); if (r.exists) setOwner((o) => (o.checked === email ? { ...o, status: "found" } : o)); } catch { /* the form never waits for this */ }
  };
  const checkCompany = async () => {  // the button Controleer after the company name: is this company known on the easy2edit server?
    const name = String(form.company_name || "").trim();
    if (name.length < 3) return;
    setOwner({ source: "company", checked: name, status: "", challenge: "", hint: "", code: "", busy: true, error: "" });
    try {
      const r = await api("/system/setup/owner/company/", { method: "POST", body: { name } });
      setOwner((o) => (o.checked === name ? { ...o, busy: false, status: r.exists ? "found" : "none", hint: r.hint || "" } : o));
    } catch (e) { setOwner((o) => ({ ...o, busy: false, status: "none", error: errorText(e) })); }
  };
  const sendOwnerCode = async () => {
    setOwner((o) => ({ ...o, busy: true, error: "" }));
    try { const r = await api("/system/setup/owner/send/", { method: "POST", body: owner.source === "company" ? { company: owner.checked } : { email: owner.checked } }); setOwner((o) => ({ ...o, busy: false, status: "code", challenge: r.challenge, hint: r.hint, code: "" })); }
    catch (e) { setOwner((o) => ({ ...o, busy: false, error: errorText(e) })); }
  };
  const typeOwnerCode = async (raw) => {
    let v = String(raw || "").replace(/\D/g, "").slice(0, 6);
    v = v.length > 3 ? `${v.slice(0, 3)}-${v.slice(3)}` : v;
    setOwner((o) => ({ ...o, code: v, error: "" }));
    if (v.length !== 7) return;
    setOwner((o) => ({ ...o, busy: true }));
    try {
      const r = await api("/system/setup/owner/fetch/", { method: "POST", body: { challenge: owner.challenge, code: v } });
      setForm((f) => ({ ...f, ...(r.fields || {}) }));  // the data of the person and the company fill the form
      setErrs({});
      setOwner((o) => ({ ...o, busy: false, status: "done" }));
    } catch (e) { setOwner((o) => ({ ...o, busy: false, code: "", error: errorText(e) })); }
  };
  const co = owner.source === "company";
  const ownerBox = owner.status ? (
    <div className="e2e-stack" data-easy2edit-tag="ui-alerts" style={{ gridColumn: "1 / -1", gap: ".6rem", padding: ".75rem .9rem", border: "1px solid var(--e2e-border, #e5e0d8)", borderRadius: "var(--e2e-radius, 10px)" }}>
      {owner.status === "none" && <span className="e2e-hint">{owner.error || tx("Dit bedrijf is niet gevonden bij easy2edit. Vul de gegevens zelf in.")}</span>}
      {owner.status === "found" && <>
        <strong>{co ? tx("Dit bedrijf is al bekend bij easy2edit.") : tx("Dit e-mailadres is al bekend bij easy2edit.")}</strong>
        <span className="e2e-hint">{co ? `${tx("Wil je alle gegevens overnemen? Je krijgt eerst een code per e-mail, die gaat naar")} ${owner.hint}.` : tx("Wil je de gegevens downloaden en laten invullen? Je krijgt eerst een code per e-mail.")}</span>
        {owner.error && <span className="e2e-error">{owner.error}</span>}
        <div><button type="button" className="btn primary" disabled={owner.busy} onClick={sendOwnerCode}>{co ? tx("Alles overnemen") : tx("Gegevens downloaden")}</button></div>
      </>}
      {owner.status === "code" && <>
        <span className="e2e-hint">{tx("De code is verstuurd naar")} {owner.hint}. {tx("Vul de code in om de gegevens in te vullen.")}</span>
        <CodeInput value={owner.code} onChange={typeOwnerCode} invalid={!!owner.error} label={tx("Code")} />
        {owner.error && <span className="e2e-error">{owner.error}</span>}
      </>}
      {owner.status === "done" && <span className="e2e-hint"><IconCheck width={14} height={14} style={{ verticalAlign: "-2px", marginRight: ".3rem" }} />{tx("De gegevens zijn ingevuld. Controleer ze en pas ze zo nodig aan.")}</span>}
    </div>
  ) : null;
  const go = (s) => { const i = steps.findIndex((x) => x[0] === s); if (i <= stepIdx || steps.slice(0, i).every((x) => stepDone(x[0]))) { if (i > stepIdx) fill(s); setStep(s); } };
  return createPortal(
    <div className="overlay" role="dialog" aria-modal="true" aria-label={tx("Licentiegegevens")}>
      {done ? (
      <div className="card modal" style={{ maxWidth: 520, width: "100%", padding: "1.6rem 1.8rem" }}>
        <KitScope tag="ui-alerts">
          <div className="e2e-stack" style={{ gap: "1.1rem", textAlign: "center", alignItems: "center" }}>
            <span className="e2e-alert__icon" style={{ width: 44, height: 44 }}><IconCheck width={22} height={22} /></span>
            <h2 style={{ margin: 0 }}>{done.updated ? tx("Licentie bijgewerkt") : done.finished ? tx("Voltooid") : tx("Licentie aangemaakt")}</h2>
            {done.number && <div style={{ width: "100%", padding: "1rem", borderRadius: "var(--e2e-radius, 10px)", background: "var(--e2e-surface, #f4f6fa)", border: "1px solid var(--e2e-line, var(--line, rgba(0,0,0,.12)))" }}>
              <span className="e2e-hint">{tx("Licentienummer")}</span>
              <div style={{ fontFamily: "monospace", fontSize: "1.45rem", fontWeight: 700, letterSpacing: ".06em", userSelect: "all", wordBreak: "break-all" }}>{done.number}</div>
            </div>}
            <div className="e2e-stack" style={{ gap: ".25rem" }}>
              {done.updated && <span><strong>{money(done.old)} → {money(done.new)}</strong> {tx("per maand")} · {tx("incl. btw")}</span>}
              {done.client && <span>{done.client}</span>}
              {done.main_url && <span className="e2e-hint">{done.main_url.replace(/^https?:\/\//, "")}</span>}
              {!done.updated && form.contact_password && <span className="e2e-hint">{tx("Wachtwoord contactpersoon")}: <code style={{ userSelect: "all" }}>{form.contact_password}</code> · {tx("per e-mail verstuurd naar {0}", form.contact_email)}</span>}
              {done.valid_until && <span className="e2e-hint">{tx("Verlengdatum")}: {new Date(done.valid_until).toLocaleDateString(getLanguage(), { day: "numeric", month: "long", year: "numeric" })}</span>}
            </div>
            <div className="e2e-row" style={{ gap: ".6rem", justifyContent: "center", flexWrap: "wrap" }}>
              <button type="button" className="e2e-btn e2e-btn--outline" onClick={downloadPdf} style={{ gap: ".5rem" }}><span style={{ display: "inline-flex", width: 18, height: 18 }}><IconReceipt /></span>{tx("Download PDF")}</button>
              <button type="button" className="e2e-btn" onClick={() => { const updated = !!done?.updated; setDone(null); setClosed(true); window.dispatchEvent(new Event("setup-saved")); if (!updated) window.location.reload(); }}>{tx("Afronden en verder gaan")}</button>  {/* a licence was made: the page loads again so the next screens of the onboarding follow (terms, AI, design wizard) */}
            </div>
          </div>
        </KitScope>
      </div>
      ) : (
      <div className="card modal" style={{ maxWidth: 860, width: "100%", maxHeight: "94vh", padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}
        onInputCapture={(e) => { if (user?.is_staff && isLocal() && e.target?.tagName === "INPUT" && e.target.id !== "sw-consent_code" && e.target.value === "@") { setForm((f) => ({ ...f, ...TEST_DATA })); setErrs({}); setError(""); } }}>
        <KitScope tag="ui-form-fields" className="sw-col">
          <div className="sw-wrap">
            <div className="sw-head">
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: ".8rem", flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ margin: 0 }}>{upd ? tx("Licentie bijwerken") : tx("Licentiegegevens")}</h2>
                <p className="e2e-hint" style={{ margin: ".3rem 0 0" }}>{upd ? tx("De prijs van de licentie is veranderd. Controleer de kosten en geef akkoord om de licentie bij te werken.") : tx("Vul de gegevens van deze website in. Alle velden zijn verplicht.")}</p>
              </div>
              {(() => { // where the licence comes from: the easy2edit licence server, or only this computer
                const ls = d.license_server || { mode: "local" };
                const look = { linked: ["var(--e2e-success, #2f9e6a)", tx("Gekoppeld aan easy2edit (licentieserver)")], server: ["var(--e2e-primary)", tx("Dit is de easy2edit licentieserver")], disconnected: ["var(--e2e-secondary, #939497)", tx("Lokaal: ontkoppeld van easy2edit")], local: ["var(--e2e-secondary, #939497)", tx("Lokaal: niet gekoppeld aan easy2edit")] }[ls.mode] || [];
                return (
                  <div role="status" data-easy2edit-tag="ui-badge" style={{ display: "inline-flex", alignItems: "center", gap: ".45rem", padding: ".3rem .7rem", maxWidth: "100%", flex: "0 1 auto", borderRadius: "var(--e2e-radius, 10px)", background: `color-mix(in srgb, ${look[0]} 16%, var(--e2e-bg, #fff))`, border: `1px solid color-mix(in srgb, ${look[0]} 45%, var(--e2e-bg, #fff))`, fontSize: ".8rem", fontWeight: 600 }}>
                    <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: "50%", background: look[0], flex: "0 0 auto" }} />
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{look[1]}{ls.url ? <span style={{ fontWeight: 400, opacity: .75 }}> · {ls.url.replace(/^https?:\/\//, "")}</span> : null}</span>
                  </div>
                );
              })()}
            </div>
            <div className="e2e-progress" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100" data-easy2edit-tag="ui-progress"><span style={{ width: `${pct}%` }} /></div>
            <div className="e2e-tabs" data-easy2edit-tag="ui-tabs">
              <div className="e2e-tabs__list" role="tablist">
                {steps.map((s, i) => <button key={s[0]} type="button" role="tab" className="e2e-tabs__tab" aria-selected={step === s[0]} onClick={() => go(s[0])}>{i + 1}. {tx(s[1])}{stepDone(s[0]) && <IconCheck width={14} height={14} style={{ marginLeft: ".35rem", verticalAlign: "-2px" }} />}</button>)}
              </div>
            </div>
            </div>
            <div className={`sw-body${step === "costs" ? " fit" : ""}`}>
            {error && <div className="e2e-alert" role="alert" data-easy2edit-tag="ui-alerts"><span className="e2e-alert__icon">!</span><div>{error}</div></div>}
            <form className="e2e-grid" style={{ "--e2e-min": "230px" }} onSubmit={(e) => { e.preventDefault(); if (stepIdx < steps.length - 1) next(); else save(); }}>
              {step === "site" && <>
                {field("site_name", tx("Naam van de website"), { span: "1 / -1" })}
                <div className="e2e-field" style={{ gridColumn: "1 / -1" }}>
                  <label className="e2e-label" htmlFor="sw-company_name"><span>{tx("Bedrijfsnaam")} <span style={{ color: "var(--e2e-danger)" }} aria-hidden="true">*</span></span></label>
                  <div style={{ display: "flex", gap: ".5rem", alignItems: "stretch" }}>
                    <input id="sw-company_name" className={`e2e-input${errs.company_name ? " e2e-input--error" : ""}`} style={{ flex: 1, minWidth: 0 }} value={form.company_name || ""} onChange={set("company_name")} autoComplete="organization" aria-invalid={errs.company_name ? "true" : undefined} aria-required="true" />
                    {d?.license_server?.mode === "linked" && <button type="button" className="btn" disabled={owner.busy || String(form.company_name || "").trim().length < 3} onClick={checkCompany}>{owner.busy && owner.source === "company" ? tx("Bezig…") : tx("Controleer")}</button>}
                  </div>
                  {errs.company_name && <span className="e2e-error">{errs.company_name}</span>}
                </div>
                {owner.source === "company" && ownerBox}
                {field("frontend_url", tx("Hoofd-URL"), { placeholder: "www.voorbeeld.nl", inputMode: "url", span: "1 / -1" })}
                <span className="e2e-hint" style={{ gridColumn: "1 / -1" }}>{tx("Het hoofdadres van de website, zonder pad of slash erachter. Dit staat ook op het licentiescherm.")}</span>
              </>}
              {step === "address" && <>
                {field("street", tx("Straat"), { autoComplete: "address-line1", span: "1 / -1" })}
                {field("house_number", tx("Huisnummer"), { maxLength: 12 })}
                {field("postal_code", tx("Postcode"), { maxLength: 10, autoComplete: "postal-code" })}
                {field("city", tx("Plaats"), { autoComplete: "address-level2" })}
                {field("country", tx("Land"), { placeholder: "Nederland" })}
              </>}
              {step === "contact" && <>
                {field("contact_first_name", tx("Voornaam contactpersoon"), { autoComplete: "given-name" })}
                {field("contact_last_name", tx("Achternaam contactpersoon"), { autoComplete: "family-name" })}
                {field("contact_email", tx("Contact e-mail"), { type: "email", autoComplete: "email", span: "1 / -1", onBlur: lookupOwner })}
                {owner.source === "email" && ownerBox}
                {phoneField("phone", tx("Telefoon"), false)}
                {phoneField("mobile", tx("Mobiel nummer"), true)}
              </>}
              {step === "preset" && (
                <div className="e2e-stack" style={{ gridColumn: "1 / -1", gap: ".6rem" }} role="radiogroup" aria-label={tx("Standaard installatie")}>
                  <span className="e2e-hint">{tx("Kies het soort website. De standaard installatie bepaalt welke modules en plugins aan staan en dus wat het kost.")}</span>
                  {!presetList ? <span className="e2e-hint">{tx("Bezig…")}</span> : !presetList.length ? <span className="e2e-hint">{tx("Er zijn geen standaard installaties beschikbaar.")}</span> : presetList.map((o) => (
                    <label key={o.key} className="e2e-check" style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", gap: ".7rem", padding: ".7rem .9rem", border: `1px solid ${form.preset === o.key ? "var(--e2e-primary)" : "var(--e2e-line, rgba(0,0,0,.12))"}`, borderRadius: "var(--e2e-radius, 10px)", cursor: "pointer" }}>
                      <input type="radio" name="sw-preset" style={{ flex: "0 0 auto", marginTop: ".2rem" }} checked={form.preset === o.key} disabled={presetBusy} onChange={() => setForm((f) => ({ ...f, preset: o.key }))} />
                      <span style={{ flex: 1 }}><strong>{tx(o.name)}</strong>{o.active && <span className="e2e-badge" style={{ marginLeft: ".5rem" }}>{tx("In gebruik")}</span>}<br /><small className="e2e-hint">{tx(o.desc)}</small></span>
                      {o.price?.monthly != null && <span style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{money(o.price.monthly)} {tx("per maand")}</span>}
                    </label>
                  ))}
                  <span className="e2e-hint">{tx("Prijzen per maand, exclusief btw. Een andere installatie kiezen haalt geen gegevens weg.")}</span>
                </div>
              )}
              {step === "trees" && (
                <div className="e2e-stack" style={{ gridColumn: "1 / -1", gap: ".8rem" }}>
                  <span className="e2e-hint">{tx("Laat je website bomen planten. Bezoekers, het energiegebruik en jouw eigen bijdrage planten samen bomen met Ecologi; easy2edit plant er zelf ook elke maand één voor je website. Bezoekers zien het resultaat in het energievenster onderaan de website.")}</span>
                  <label className="e2e-check" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: ".7rem", padding: ".7rem .9rem", border: `1px solid ${treesOn ? "var(--e2e-primary, var(--blue))" : "var(--e2e-line, var(--line))"}`, borderRadius: "var(--e2e-radius, 10px)" }}>
                    <input type="checkbox" checked={treesOn} onChange={(e) => chooseTrees(e.target.checked)} />
                    <span style={{ flex: 1 }}><strong>{tx("Bomen planten met easy2edit")}</strong><br /><small className="e2e-hint">{tx("Begint in testmodus: er wordt niets gekocht totdat jij dat zelf aanzet.")}</small></span>
                  </label>
                  <div className="e2e-alert" role="status" data-easy2edit-tag="ui-alerts"><span className="e2e-alert__icon">i</span><div>{tx("De koppeling met Ecologi (API) is verplicht en staat altijd aan. De sleutel komt van de easy2edit-server; je hoeft niets in te vullen.")}</div></div>
                  {treesInfo && !treesInfo.error && (
                    <div className="e2e-row" style={{ gap: "1.4rem", flexWrap: "wrap" }}>
                      <div className="e2e-field"><span className="e2e-hint">{tx("Prijs per boom")}</span><strong>{money(treesInfo.per_tree, treesInfo.currency)}</strong></div>
                      <div className="e2e-field"><span className="e2e-hint">{tx("Beheer en overzicht")}</span><strong>{money(treesInfo.service_fee, treesInfo.currency)}</strong><small className="e2e-hint">{tx("per maand, ex btw (bij je licentie)")}</small></div>
                      {treesInfo.examples?.map((x) => <div key={x.trees} className="e2e-field"><span className="e2e-hint">{x.trees} {tx("bomen per maand")}</span><strong>{money(x.amount, treesInfo.currency)}</strong></div>)}
                    </div>
                  )}
                </div>
              )}
              {step === "ai" && (() => {
                const p = aiInfo?.proposal, cur = aiInfo?.currency || "EUR", on = !!form.ai_amount;
                return (
                  <div className="e2e-stack" style={{ gridColumn: "1 / -1", gap: ".8rem" }}>
                    <span className="e2e-hint">{tx("easy2edit gebruikt AI (Claude) voor onder meer vertalen, teksten en het importeren van een website. Gebruikers en admins kunnen AI pas gebruiken als er AI-tegoed is. Superadmins hebben zelf geen tegoed nodig.")}</span>
                    {!aiInfo ? <span className="e2e-hint">{tx("Bezig…")}</span> : aiInfo.module === false || !p ? <span className="e2e-hint">{tx("AI staat niet aan in deze installatie.")}</span> : (
                      <>
                        <label className="e2e-check" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: ".7rem", padding: ".7rem .9rem", border: `1px solid ${on ? "var(--e2e-primary)" : "var(--e2e-line, rgba(0,0,0,.15))"}`, borderRadius: "var(--e2e-radius, 10px)", cursor: "pointer" }}>
                          <input type="checkbox" checked={on} onChange={(e) => setAiAmount(e.target.checked ? p.suggest : 0)} />
                          <span style={{ flex: 1 }}><strong>{tx("Ik wil AI-tegoed kopen")}</strong><br /><small className="e2e-hint">{tx("Je betaalt het na het aanmaken van de licentie, op de betaalpagina. Je kunt dit later ook doen.")}</small></span>
                        </label>
                        {on && (
                          <div className="ai-slider" style={{ padding: ".2rem .4rem" }}>
                            <div className="ai-slider-val" style={{ fontWeight: 700, fontSize: "1.3rem" }}>{money(Number(form.ai_amount), cur)}</div>
                            <input type="range" style={{ width: "100%" }} min={p.min} max={p.max} step={p.step} value={Number(form.ai_amount)} onChange={(e) => setAiAmount(Number(e.target.value))} aria-label={tx("Bedrag")} />
                            <div style={{ display: "flex", justifyContent: "space-between" }}><small className="e2e-hint">{money(p.min, cur)}</small><small className="e2e-hint">{tx("Voorstel")}: {money(p.suggest, cur)}</small><small className="e2e-hint">{money(p.max, cur)}</small></div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}
              {step === "hosting" && (
                <div className="e2e-stack" style={{ gridColumn: "1 / -1", gap: ".6rem" }} role="radiogroup" aria-label={tx("Hosting")}>
                  {(d.hosting_options || []).map((o) => (
                    <label key={o.key} className="e2e-check" style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", gap: ".7rem", padding: ".7rem .9rem", border: `1px solid ${form.hosting === o.key ? "var(--e2e-primary)" : "var(--e2e-line, rgba(0,0,0,.12))"}`, borderRadius: "var(--e2e-radius, 10px)", background: form.hosting === o.key ? "var(--e2e-primary-soft, transparent)" : "transparent", cursor: "pointer" }}>
                      <input type="radio" name="sw-hosting" style={{ flex: "0 0 auto", marginTop: ".2rem" }} checked={form.hosting === o.key} onChange={() => { setForm((f) => ({ ...f, hosting: o.key })); setErrs((x) => ({ ...x, hosting: "" })); }} />
                      <span style={{ flex: 1 }}><strong>{o.label}</strong><br /><small className="e2e-hint">{o.desc}</small></span>
                      <span style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{money(o.price)} {tx("per maand")}</span>
                    </label>
                  ))}
                  <span className="e2e-hint">{tx("De prijs van de hosting staat apart in de kosten en zit niet in de basisprijs. Prijzen inclusief btw, uit de prijslijst.")}</span>
                  {errs.hosting && <span className="e2e-error">{errs.hosting}</span>}
                </div>
              )}
              {step === "pay" && upd && (() => {
                const now = new Date(), days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), left = days - now.getDate() + 1;
                const diff = Math.round((Number(upd.delta) * left / days) * 100) / 100, invoice = upd.payment_method === "invoice";
                return (
                  <div className="e2e-stack" style={{ gridColumn: "1 / -1", gap: "1rem" }}>
                    <div style={{ paddingBottom: "1rem", borderBottom: "1px solid var(--e2e-line, var(--line, rgba(0,0,0,.15)))" }}>
                      <strong style={{ fontSize: "1.05rem" }}>{tx("Betaal de wijziging")}</strong>
                      <p style={{ margin: ".3rem 0 0" }}>{invoice ? tx("De licentie wordt op rekening betaald: het nieuwe bedrag staat op de factuur die iedere 1e van de maand wordt verstuurd.") : tx("De licentie loopt via een abonnement: het nieuwe bedrag wordt vanaf nu via je abonnement berekend, het verschil van deze maand naar rato.")}</p>
                    </div>
                    <div className="e2e-grid" style={{ "--e2e-min": "170px" }}>
                      <div className="e2e-field" data-easy2edit-tag="ui-kpi"><span className="e2e-hint">{tx("Verschil tot einde van de maand")}</span><strong style={{ fontSize: "1.35rem" }}>{diff > 0 ? "+" : ""}{money(diff)}</strong></div>
                      <div className="e2e-field" data-easy2edit-tag="ui-kpi"><span className="e2e-hint">{tx("Daarna per maand")}</span><strong style={{ fontSize: "1.35rem" }}>{money(upd.new)}</strong><span className="e2e-hint">{tx("incl. btw")}</span></div>
                    </div>
                    {form.pay_ok === "1" ? (
                      form.pay_none_done === "1"
                        ? <div className="e2e-alert" role="alert" data-easy2edit-tag="ui-alerts"><span className="e2e-alert__icon">!</span><div>{tx("Niet betaald. De licentie loopt maar kort; daarna gaat je website in free mode.")}</div></div>
                        : <div className="e2e-alert" role="status" data-easy2edit-tag="ui-alerts"><span className="e2e-alert__icon"><IconCheck width={14} height={14} /></span><div>{tx("Betaling bevestigd. Je kunt doorgaan naar het overzicht.")}</div></div>
                    ) : (
                      <div className="e2e-row" style={{ gap: ".7rem", alignItems: "center", flexWrap: "wrap" }}>
                        <button type="button" className="e2e-btn" disabled={pay.busy} onClick={() => payUpdate("confirm")}>{invoice ? tx("Op rekening") : tx("Betaling bevestigen")}</button>
                        <button type="button" className="e2e-btn e2e-btn--outline" disabled={pay.busy} onClick={() => payUpdate("none")}>{tx("Betaal niet")}</button>
                      </div>
                    )}
                    {pay.error && <span className="e2e-error">{pay.error}</span>}
                    {form.pay_ok !== "1" && <span className="e2e-hint">{tx("Je kunt pas verder als de betaling is bevestigd, of kies Betaal niet.")}</span>}
                  </div>
                );
              })()}
              {step === "pay" && !upd && (() => {
                const mo = Number(costs?.monthly || 0), per = [1, 3, 12].includes(Number(form.renew_months)) ? Number(form.renew_months) : 12;
                const pr = (costs?.periods || []).find((x) => Number(x.months) === per), disc = pr ? Number(pr.discount) : 0;
                const price = (mo + hostPrice) * per * (1 - disc / 100), perMonth = price / per, now = new Date();
                const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), left = days - now.getDate() + 1;
                const perLabel = per === 1 ? "Daarna per maand" : per === 3 ? "Daarna per kwartaal" : "Daarna per jaar";
                return (
                  <div className="e2e-stack" style={{ gridColumn: "1 / -1", gap: "1rem" }}>
                    <div style={{ paddingBottom: "1rem", borderBottom: "1px solid var(--e2e-line, var(--line, rgba(0,0,0,.15)))" }}>
                      <strong style={{ fontSize: "1.05rem" }}>{tx("Betaal het abonnement")}</strong>
                      <p style={{ margin: ".3rem 0 0" }}>{tx("Je betaalt via Stripe. Het abonnement start op de 1e van de maand: eerst betaal je de dagen tot het einde van deze maand naar rato, daarna elke periode het volledige bedrag.")}</p>
                    </div>
                    {!costs ? <span className="e2e-hint">{<Loading compact />}</span> : (
                      <div className="e2e-grid" style={{ "--e2e-min": "170px" }}>
                        <div className="e2e-field" data-easy2edit-tag="ui-kpi"><span className="e2e-hint">{tx("Nu tot einde van de maand")}</span><strong style={{ fontSize: "1.35rem" }}>{money(Math.round((perMonth * left / days) * 100) / 100)}</strong></div>
                        {form.ai_amount && <div className="e2e-field" data-easy2edit-tag="ui-kpi"><span className="e2e-hint">{tx("AI-tegoed")}</span><strong style={{ fontSize: "1.35rem" }}><span style={{ color: "#f97316", marginRight: ".35rem" }} aria-hidden="true">+</span>{money(Number(form.ai_amount))}</strong><span className="e2e-hint">{tx("eenmalig")}</span></div>}
                        {form.ai_amount && <div className="e2e-field" data-easy2edit-tag="ui-kpi"><span className="e2e-hint">{tx("Totaal nu te betalen")}</span><strong style={{ fontSize: "1.35rem" }}><span style={{ color: "var(--e2e-primary)", marginRight: ".35rem" }} aria-hidden="true">=</span>{money(Math.round((perMonth * left / days + Number(form.ai_amount)) * 100) / 100)}</strong><span className="e2e-hint">{tx("het AI-tegoed betaal je na het aanmaken van de licentie")}</span></div>}
                        <div className="e2e-field" data-easy2edit-tag="ui-kpi"><span className="e2e-hint">{tx(perLabel)}</span><strong style={{ fontSize: "1.35rem" }}>{money(Math.round(price * 100) / 100)}</strong><span className="e2e-hint">{tx("incl. btw")}</span></div>
                      </div>
                    )}
                    {d.pay?.mode === "test" && <div className="e2e-alert" role="status" data-easy2edit-tag="ui-alerts"><span className="e2e-alert__icon">i</span><div><strong>{tx("Testmodus")}</strong><br />{tx("Gebruik de testkaart 4242 4242 4242 4242, een datum in de toekomst en een willekeurige CVC.")}</div></div>}
                    {form.pay_ok === "1" ? (
                      form.pay_none_done === "1"
                        ? <div className="e2e-alert" role="alert" data-easy2edit-tag="ui-alerts"><span className="e2e-alert__icon">!</span><div>{tx("Niet betaald. De licentie loopt maar kort; daarna gaat je website in free mode.")}</div></div>
                        : <div className="e2e-alert" role="status" data-easy2edit-tag="ui-alerts"><span className="e2e-alert__icon"><IconCheck width={14} height={14} /></span><div>{form.pay_invoice_done === "1" ? tx("Op rekening gekozen. Je kunt doorgaan naar het overzicht.") : tx("Betaald. Je kunt doorgaan naar het overzicht.")}</div></div>
                    ) : (
                      <>
                        {form.pay_invoice === "1" && <div className="e2e-alert" role="status" data-easy2edit-tag="ui-alerts"><span className="e2e-alert__icon">i</span><div>{tx("De factuur wordt iedere 1e van de maand verstuurd.")}</div></div>}
                        {!d.pay?.provider && form.pay_invoice !== "1" && <div className="e2e-alert" role="alert" data-easy2edit-tag="ui-alerts"><span className="e2e-alert__icon">!</span><div>{tx("Stripe is niet gekoppeld voor de licentie (Super admin → Licentie → Betalen). Kies Op rekening om door te gaan.")}</div></div>}
                        <div className="e2e-row" style={{ gap: ".7rem", alignItems: "center", flexWrap: "wrap" }}>
                          {form.pay_invoice === "1"
                            ? <button type="button" className="e2e-btn" disabled={pay.busy} onClick={payInvoice}>{tx("Op rekening")}</button>
                            : d.pay?.provider
                              ? <button type="button" className="e2e-btn" disabled={pay.busy} onClick={startPay}>{pay.busy ? tx("Je wordt doorgestuurd naar Stripe…") : tx("Betalen met Stripe")}</button>
                              : isLocal() && user?.is_staff ? <button type="button" className="e2e-btn" disabled={pay.busy} onClick={payTest}>{tx("Betaal (test)")}</button> : null}
                          <button type="button" className="e2e-btn e2e-btn--outline" disabled={pay.busy} onClick={payNone}>{tx("Betaal niet")}</button>
                          {(user?.is_staff || user?.is_superadmin_plus) && (
                            <label className="e2e-switch" data-easy2edit-tag="ui-form-fields" style={{ display: "inline-flex", flexDirection: "row", alignItems: "center", gap: ".5rem", marginLeft: "auto", whiteSpace: "nowrap" }}><input type="checkbox" checked={form.pay_invoice === "1"} onChange={(e) => setForm((f) => ({ ...f, pay_invoice: e.target.checked ? "1" : "" }))} /> {tx("Op rekening (factuur)")}</label>
                          )}
                        </div>

                      </>
                    )}
                    {pay.error && <span className="e2e-error">{pay.error}</span>}
                    {form.pay_ok !== "1" && <span className="e2e-hint">{tx("Je kunt pas verder als de betaling is gelukt, of kies Betaal niet.")}</span>}
                  </div>
                );
              })()}
              {step === "overview" && (() => {
                const mo = Number(costs?.monthly || 0), per = [1, 3, 12].includes(Number(form.renew_months)) ? Number(form.renew_months) : 12;
                const pr = (costs?.periods || []).find((x) => Number(x.months) === per), disc = pr ? Number(pr.discount) : 0;
                const price = (mo + hostPrice) * per * (1 - disc / 100);
                const perLabel = tx(per === 1 ? "Per maand" : per === 3 ? "Per kwartaal" : "Per jaar");
                const how = form.pay_none_done === "1" ? tx("Niet betaald (free mode na korte tijd)") : form.pay_invoice_done === "1" ? tx("Op rekening") : form.pay_ok === "1" ? tx("Betaald") : "";
                const rows = [
                  [tx("Opdrachtgever"), form.company_name || form.site_name],
                  [tx("Naam van de website"), form.site_name],
                  [tx("Hoofd-URL"), form.frontend_url],
                  [tx("Adres"), [[form.street, form.house_number].filter(Boolean).join(" "), [form.postal_code, form.city].filter(Boolean).join(" "), form.country].filter(Boolean).join(", ")],
                  [tx("Contactpersoon"), [form.contact_first_name, form.contact_last_name].filter(Boolean).join(" ")],
                  [tx("Contact e-mail"), form.contact_email],
                  [tx("Mobiel nummer"), form.mobile],
                  ...(!upd && d.needs_license && form.contact_password ? [[tx("Wachtwoord contactpersoon"), form.contact_password]] : []),
                  [tx("Hosting"), hostOpt ? hostOpt.label : ""],
                  [tx("Standaard installatie"), (presetList || []).find((x) => x.key === form.preset)?.name ? tx((presetList || []).find((x) => x.key === form.preset).name) : ""],
                  ...(!upd && form.ai_amount ? [[tx("AI-tegoed"), `${money(Number(form.ai_amount))} · ${tx("te betalen na het aanmaken van de licentie")}`]] : []),
                  [tx("Abonnement"), `${perLabel}${disc > 0 ? ` · ${tx("korting")} ${disc}%` : ""}`],
                  [tx("Prijs"), `${money(Math.round(price * 100) / 100)} ${perLabel.toLowerCase()} · ${tx("incl. btw")}`],
                  [tx("Verlengdatum"), form.license_until ? new Date(form.license_until).toLocaleDateString(getLanguage(), { day: "numeric", month: "long", year: "numeric" }) : ""],
                  [tx("Betaling"), how],
                ].filter((r) => r[1]);
                return (
                  <div className="e2e-stack" style={{ gridColumn: "1 / -1", gap: "1rem" }}>
                    <div style={{ textAlign: "center", padding: ".9rem 1rem", borderRadius: "var(--e2e-radius, 10px)", background: "var(--e2e-surface, #f4f6fa)", border: "1px solid var(--e2e-line, var(--line, rgba(0,0,0,.12)))" }} data-easy2edit-tag="ui-kpi">
                      <span className="e2e-hint">{tx("Licentienummer")}</span>
                      <div style={{ fontFamily: "monospace", fontSize: "1.5rem", fontWeight: 700, letterSpacing: ".06em", userSelect: "all" }}>{upd ? upd.number : d.license_number}</div>
                      <span className="e2e-hint">{upd ? tx("Dit is je bestaande licentie: het nummer blijft hetzelfde.") : tx("Het nummer wordt actief zodra je opslaat.")}</span>
                    </div>
                    <div className="e2e-table-wrap" data-easy2edit-tag="ui-data-table">
                      <table className="e2e-table"><tbody>
                        {rows.map(([l, v]) => <tr key={l}><td style={{ width: "38%", opacity: .75 }}>{l}</td><td><strong>{v}</strong></td></tr>)}
                      </tbody></table>
                    </div>
                    {!upd && d.needs_license && (
                      <div className="e2e-field" data-easy2edit-tag="ui-form-fields">
                        <label className="e2e-label" htmlFor="sw-contact_password"><span>{tx("Wachtwoord van de contactpersoon")}</span></label>
                        <div className="e2e-row" style={{ gap: ".5rem", flexWrap: "nowrap" }}>
                          <input id="sw-contact_password" className="e2e-input" style={{ fontFamily: "monospace", flex: 1 }} value={form.contact_password || ""} onChange={(e) => setForm((f) => ({ ...f, contact_password: e.target.value }))} autoComplete="off" spellCheck={false} />
                          <button type="button" className="e2e-btn e2e-btn--outline" onClick={() => api("/system/setup/password/").then((r) => setForm((f) => ({ ...f, contact_password: r.password }))).catch(() => {})} aria-label={tx("Nieuw wachtwoord")} title={tx("Nieuw wachtwoord")}>{tx("Vernieuwen")}</button>
                        </div>
                        <span className="e2e-hint">{tx("De contactpersoon wordt als gebruiker met beheerrechten aangemaakt, in de groep Admins en gekoppeld aan het bedrijf. Dit wachtwoord staat in het overzicht en de PDF en wordt per e-mail naar hem gestuurd.")}</span>
                      </div>
                    )}
                    {form.pay_none_done === "1" && <div className="e2e-alert" role="alert" data-easy2edit-tag="ui-alerts"><span className="e2e-alert__icon">!</span><div>{tx("Niet betaald. De licentie loopt maar kort; daarna gaat je website in free mode.")}</div></div>}
                    <div className="e2e-row" style={{ justifyContent: "center" }}>
                      <button type="button" className="e2e-btn e2e-btn--outline" onClick={downloadPdf} data-easy2edit-tag="ui-button-variants" style={{ gap: ".5rem" }}><span style={{ display: "inline-flex", width: 18, height: 18 }}><IconReceipt /></span>{tx("Download PDF")}</button>
                    </div>
                    {pay.error && <span className="e2e-error" style={{ textAlign: "center" }}>{pay.error}</span>}
                  </div>
                );
              })()}
              {step === "agree" && (
                <div className="e2e-stack" style={{ gridColumn: "1 / -1", gap: "1rem" }}>
                  <div style={{ paddingBottom: ".6rem", borderBottom: "1px solid var(--e2e-line, var(--line, rgba(0,0,0,.15)))" }}>
                    <strong style={{ fontSize: "1.05rem" }}>{tx("Algemene voorwaarden van easy2edit")}</strong>
                    <p style={{ margin: ".3rem 0 0" }}>{tx("Lees de voorwaarden helemaal door, tot het einde. Daarna vragen we je akkoord te geven met een code die je per e-mail of SMS krijgt.")}</p>
                  </div>
                  {form.consent_ok !== "1" && !upd && (
                    <div className="e2e-stack" style={{ gap: ".4rem" }}>
                      <div ref={termsBox} tabIndex={0} role="region" aria-label={tx("Algemene voorwaarden van easy2edit")}
                        onScroll={(e) => { const el = e.currentTarget; if (el.scrollTop + el.clientHeight >= el.scrollHeight - 12) setTermsRead(true); }}
                        style={{ maxHeight: "34vh", overflowY: "auto", padding: ".8rem 1rem", border: "1px solid var(--e2e-line, var(--line, rgba(0,0,0,.2)))", borderRadius: "var(--e2e-radius, 10px)", background: "var(--e2e-surface, #fff)" }}>
                        {termsDoc ? (termsDoc.title && <h3 style={{ marginTop: 0 }}>{termsDoc.title}</h3>) : null}
                        {termsDoc ? <RichText value={termsDoc.body} /> : termsErr ? <span className="e2e-hint" role="alert">{tx("De voorwaarden konden niet worden geladen.")} <button type="button" className="e2e-btn e2e-btn--sm" onClick={loadTerms}>{tx("Opnieuw laden")}</button></span> : <span className="e2e-hint">{<Loading compact />}</span>}
                      </div>
                      <span className="e2e-hint">{termsRead ? tx("Je hebt de voorwaarden tot het einde gelezen.") : tx("Scroll naar het einde van de voorwaarden om akkoord te kunnen geven.")}</span>
                    </div>
                  )}
                  {form.consent_ok === "1" ? (
                    <div className="e2e-alert" role="status" data-easy2edit-tag="ui-alerts"><span className="e2e-alert__icon"><IconCheck width={14} height={14} /></span><div>{user?.is_staff ? tx("Als superadmin hoef je geen code in te geven. Ga verder naar de betaling.") : tx("Akkoord gegeven. Ga verder naar de betaling.")}</div></div>
                  ) : (!termsRead && !upd) ? null : (
                    <div className="e2e-stack" style={{ gap: "1rem", alignItems: "center", textAlign: "center" }}>
                      {!canMail && !canSms && <div className="e2e-alert" role="alert" data-easy2edit-tag="ui-alerts"><span className="e2e-alert__icon">!</span><div>{tx("Er is geen e-mail- of SMS-koppeling actief (API keys), dus er kan geen code worden verstuurd.")}</div></div>}
                      {canMail && canSms && (
                        <div className="e2e-field" style={{ alignItems: "center" }}>
                          <span className="e2e-label">{tx("Code versturen via")}</span>
                          <div className="e2e-tabs e2e-pills" data-easy2edit-tag="ui-tabs-pills"><div className="e2e-tabs__list" role="radiogroup" aria-label={tx("Code versturen via")}>
                            {[["email", "E-mail"], ["sms", "SMS"]].map(([m, l]) => (
                              <button key={m} type="button" role="radio" className="e2e-tabs__tab" aria-checked={method === m} aria-selected={method === m} onClick={() => setConsent((c) => ({ ...c, method: m, sent: false, shown: "", error: "" }))}>{l}</button>
                            ))}
                          </div></div>
                        </div>
                      )}
                      <div className="e2e-row" style={{ alignItems: "flex-end", justifyContent: "center", gap: ".8rem", flexWrap: "wrap" }}>
                        <div className="e2e-field" style={{ alignItems: "center" }}>
                          <label className="e2e-label" htmlFor="sw-consent_code"><span>{tx("Code")} <span style={{ color: "var(--e2e-danger)" }} aria-hidden="true">*</span></span></label>
                          <CodeInput value={form.consent_code || ""} onChange={typeCode} onAt={user?.is_staff ? () => typeCode("@") : undefined} invalid={!!(consent.error || errs.consent_ok)} label={tx("Code")} />
                        </div>
                        <button type="button" className="e2e-btn e2e-btn--outline" disabled={consent.busy || (!canMail && !canSms)} onClick={sendCode} style={{ height: 46 }}>{consent.sent ? tx("Opnieuw versturen") : tx("Code versturen")}</button>
                      </div>
                      <span className="e2e-hint">{consent.sent ? tx("De code is verstuurd. Die is 10 minuten geldig.") : `${tx("De code gaat naar")} ${method === "email" ? form.contact_email : form.mobile}`}{consent.shown ? ` · ${tx("Code")}: ${consent.shown}` : ""}</span>
                      {(consent.error || errs.consent_ok) && <span className="e2e-error">{consent.error || errs.consent_ok}</span>}
                    </div>
                  )}
                </div>
              )}
              {step === "costs" && (
                <div className="e2e-stack sw-fit-costs" style={{ gridColumn: "1 / -1", gap: ".8rem" }}>
                  {!costs ? <span className="e2e-hint">{<Loading compact />}</span> : <>
                    {upd && <div className="e2e-alert" role="status" data-easy2edit-tag="ui-alerts"><span className="e2e-alert__icon">i</span><div><strong>{Number(upd.delta) > 0 ? tx("De licentie wordt duurder") : tx("De licentie wordt goedkoper")}</strong><br />{money(upd.old)} → <strong>{money(upd.new)}</strong> {tx("per maand")} ({Number(upd.delta) > 0 ? "+" : ""}{money(upd.delta)}) · {tx("incl. btw")}</div></div>}
                    {(() => { // the subscription starts on the 1st: until the end of this month you pay in proportion, after that the full month price
                      const now = new Date(), lang = getLanguage(), mo = Number(costs.monthly || 0), per = [1, 3, 12].includes(Number(form.renew_months)) ? Number(form.renew_months) : 12;
                      const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), left = days - now.getDate() + 1;
                      const pr = (costs.periods || []).find((x) => Number(x.months) === per);  // the discount of the chosen subscription (price list > Subscriptions)
                      const disc = pr ? Number(pr.discount) : 0, price = (mo + hostPrice) * per * (1 - disc / 100), perMonth = price / per;
                      const fmt = (d) => d.toLocaleDateString(lang, { day: "numeric", month: "long" });
                      const tiles = [
                        [tx("Nu tot einde van de maand"), money(Math.round((perMonth * left / days) * 100) / 100), `${fmt(now)} – ${fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0))}`],
                        ...(form.ai_amount ? [[tx("AI-tegoed"), money(Number(form.ai_amount)), tx("eenmalig"), true]] : []),  // AI credit chosen in the step AI-tegoed: next to the first amount, with a + in another colour
                        [tx(per === 1 ? "Daarna per maand" : per === 3 ? "Daarna per kwartaal" : "Daarna per jaar"), money(Math.round(price * 100) / 100), `${tx("vanaf")} ${fmt(new Date(now.getFullYear(), now.getMonth() + 1, 1))}`],  // the price of the chosen subscription: the price per month times its months
                        [tx("Per maand"), money(Math.round(perMonth * 100) / 100), disc > 0 ? `${tx("korting")} ${disc}% · ${tx("incl. btw")}` : tx("incl. btw")],
                      ];
                      return (
                        <div className="e2e-grid" style={{ "--e2e-min": "150px" }}>
                          {tiles.map(([l, v, sub, plus]) => (
                            <div key={l} className="e2e-field" data-easy2edit-tag="ui-kpi"><span className="e2e-hint">{l}</span><strong style={{ fontSize: "1.35rem" }}>{plus && <span style={{ color: "#f97316", marginRight: ".35rem" }} aria-hidden="true">+</span>}{v}</strong><span className="e2e-hint">{sub}</span></div>
                          ))}
                        </div>
                      );
                    })()}
                    <span className="e2e-hint">{tx("Het abonnement gaat altijd in op de 1e van de maand. Voor de rest van deze maand betaal je naar rato van het aantal dagen; vanaf de 1e van de volgende maand betaal je de volledige maandprijs.")}</span>
                    {d.needs_license && (
                      <>
                      <div className="e2e-row" style={{ alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
                      <div className="e2e-field">
                        <span className="e2e-label">{tx("Abonnement")}</span>
                        <div className="e2e-tabs e2e-pills" data-easy2edit-tag="ui-tabs-pills" style={{ minHeight: 46, display: "flex", alignItems: "center" }}><div className="e2e-tabs__list" role="radiogroup" aria-label={tx("Abonnement")}>
                          {[[1, "Per maand"], [3, "Per kwartaal"], [12, "Per jaar"]].map(([m, l]) => (
                            <button key={m} type="button" role="radio" className="e2e-tabs__tab" aria-checked={Number(form.renew_months) === m} aria-selected={Number(form.renew_months) === m} onClick={() => setForm((f) => { const e = new Date(); e.setMonth(e.getMonth() + m); return { ...f, renew_months: m, license_until: e.toISOString().slice(0, 10) }; })}>{tx(l)}</button>
                          ))}
                        </div></div>
                      </div>
                      <div className="e2e-field">
                        <label className="e2e-label" htmlFor="sw-license_until"><span>{tx("Verlengdatum")} <span style={{ color: "var(--e2e-danger)" }} aria-hidden="true">*</span></span></label>
                        <input id="sw-license_until" className={`e2e-input${errs.license_until ? " e2e-input--error" : ""}`} type="date" min={new Date(Date.now() + 864e5).toISOString().slice(0, 10)} value={form.license_until || ""} onChange={set("license_until")} aria-required="true" style={{ maxWidth: 240 }} />
                        {errs.license_until && <span className="e2e-error">{errs.license_until}</span>}
                        
                      </div>
                      </div>
                      <span className="e2e-hint">{tx("Standaard één jaar. De licentie wordt automatisch gemaakt met de gegevens die je hebt ingevuld.")}</span>
                      </>
                    )}
                    <div className="e2e-table-wrap" data-easy2edit-tag="ui-data-table">
                      <table className="e2e-table">
                        <thead><tr><th>{tx("Onderdeel")}</th><th style={{ textAlign: "right" }}>{tx("Per maand")}</th></tr></thead>
                        <tbody>
                          {(() => { const base = Number(costs.monthly || 0) - (costs.items || []).reduce((t, i) => t + Number(i.price || 0), 0); return base > 0.005 ? <tr><td>{tx("Basisprijs en backups")}</td><td style={{ textAlign: "right" }}>{money(base)}</td></tr> : null; })()}
                          {hostOpt && hostPrice > 0 && <tr><td>{tx("Hosting")}: {hostOpt.label}</td><td style={{ textAlign: "right" }}>{money(hostPrice)}</td></tr>}
                          {(costs.items || []).map((i) => <tr key={`${i.kind}:${i.key}`}><td>{i.label}</td><td style={{ textAlign: "right" }}>{money(i.price)}</td></tr>)}
                          {!(costs.items || []).length && <tr><td colSpan={2} className="e2e-hint">{tx("Er zijn geen kosten.")}</td></tr>}
                        </tbody>
                      </table>
                    </div>
                    <div className="e2e-row" style={{ gap: ".5rem", alignItems: "center", flexWrap: "wrap" }}><span className="e2e-hint">{tx("De kosten van AI zijn niet meegerekend in de licentie.")}</span><button type="button" className="e2e-btn e2e-btn--outline e2e-btn--sm" onClick={() => setCostInfo(true)}>{tx("Uitleg over de kosten")}</button></div>
                    
                  </>}
                </div>
              )}
              <button type="submit" hidden />
            </form>
            </div>
            <div className="e2e-row sw-foot" style={{ justifyContent: "space-between", gap: ".6rem", flexWrap: "wrap" }} data-easy2edit-tag="ui-button-variants">
              <div>{forced ? <button type="button" className="e2e-btn e2e-btn--ghost" onClick={closeWizard}>{tx("Sluiten")}</button> : d.can_skip && <button type="button" className="e2e-btn e2e-btn--ghost" onClick={skip}>{tx("Nu niet invullen")}</button>}</div>
              <div className="e2e-row" style={{ gap: ".6rem" }}>
                {stepIdx > 0 && <button type="button" className="e2e-btn e2e-btn--outline" onClick={() => setStep(steps[stepIdx - 1][0])}>{tx("Vorige")}</button>}
                {stepIdx < steps.length - 1
                  ? <button type="button" className="e2e-btn" disabled={presetBusy || (step === "pay" && form.pay_ok !== "1") || (step === "agree" && form.consent_ok !== "1" && (String(form.consent_code || "").length !== 7 || consent.busy))} onClick={step === "agree" && form.consent_ok !== "1" ? () => checkCode(form.consent_code) : next}>{tx("Volgende")}</button>
                  : <button type="button" className="e2e-btn" disabled={busy} onClick={save}>{tx("Opslaan")}</button>}
              </div>
            </div>
          </div>
        </KitScope>
      </div>
      )}
      {costInfo && <CostsInfo onClose={() => setCostInfo(false)} />}
    </div>, document.body);
}
