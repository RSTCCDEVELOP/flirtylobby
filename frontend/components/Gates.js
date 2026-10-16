"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { pick } from "../lib/i18n";
import { Logo } from "./BrandingContext";

const ORDER = ["age", "gambling", "cookies"];
const NEVER = ["/dashboard", "/login", "/geo-blocked"];

const read = (store, key) => { try { return JSON.parse(store.getItem(key)); } catch { return null; } };
const write = (store, key, val) => { try { store.setItem(key, JSON.stringify(val)); } catch {} };

// Should this popup be shown now, given its frequency setting and what the visitor did before?
function due(name, gate, pathname, doneThisLoad) {
  if (!gate?.enabled || doneThisLoad[name]) return false;
  if (gate.show_on === "home" && pathname !== "/") return false;
  if (gate.exclude_paths.some((p) => pathname === p || pathname.startsWith(p.replace(/\/$/, "") + "/"))) return false;
  const seen = read(localStorage, `gate:${name}`);
  const versionOk = seen && seen.v === gate.version;
  switch (gate.frequency) {
    case "always": return true;
    case "session": return read(sessionStorage, `gate:${name}`)?.v !== gate.version;
    case "days": return !versionOk || Date.now() - seen.t > gate.days * 86400000;
    default: return !versionOk; // once
  }
}

function remember(name, gate) {
  const rec = { v: gate.version, t: Date.now() };
  write(localStorage, `gate:${name}`, rec);
  write(sessionStorage, `gate:${name}`, rec);
}

// Cookie policy in a popup (opened from the banner link or the footer link)
function CookiePolicyModal({ cfg, lang }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("open-cookie-policy", show);
    return () => window.removeEventListener("open-cookie-policy", show);
  }, []);
  if (!open || !cfg?.cookies) return null;
  const c = cfg.cookies;
  const t = (k) => pick(c.texts, lang, cfg.default_language, k);
  const cats = ["necessary", ...["analytics", "marketing", "preferences"].filter((x) => c[x])];
  return (
    <div className="gate-overlay policy-overlay" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
      <div className="gate-modal policy-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t("policy_title")}</h2>
        <div className="policy-body">
          <p className="doc-body">{t("policy_body")}</p>
          <ul className="doc-list">
            {cats.map((x) => <li key={x}><strong>{t(`cat_${x}`)}</strong><span>{t(`cat_${x}_desc`)}</span></li>)}
          </ul>
        </div>
        <div className="row">
          <button className="btn" onClick={() => { setOpen(false); window.dispatchEvent(new Event("open-cookie-settings")); }}>{t("settings")}</button>
          <button className="btn primary" onClick={() => setOpen(false)}>OK</button>
        </div>
      </div>
    </div>
  );
}

export default function Gates({ cfg }) {
  const pathname = usePathname();
  const [lang, setLang] = useState(cfg?.default_language || "nl");
  const [done, setDone] = useState({});
  const [active, setActive] = useState(null);
  const [test, setTest] = useState(null); // preview from the Vormgeving page
  const [denied, setDenied] = useState(false);
  const [panel, setPanel] = useState(false);
  const [checked, setChecked] = useState(false);
  const [choices, setChoices] = useState({ analytics: false, marketing: false, preferences: false });

  // visitor language: saved choice (language switcher) or the site default
  useEffect(() => {
    const sync = () => {
      let saved = null;
      try { saved = localStorage.getItem("lang"); } catch {}
      setLang(cfg?.languages?.includes(saved) ? saved : cfg?.default_language || "nl");
    };
    sync();
    window.addEventListener("langchange", sync);
    return () => window.removeEventListener("langchange", sync);
  }, [cfg]);

  const evaluate = useCallback(() => {
    if (!cfg || NEVER.some((p) => pathname.startsWith(p))) return setActive(null);
    setActive(ORDER.find((n) => due(n, cfg[n], pathname, done)) || null);
  }, [cfg, pathname, done]);
  useEffect(evaluate, [evaluate]);

  // footer link "Cookie-instellingen" reopens the banner
  useEffect(() => {
    const open = () => {
      const saved = read(localStorage, "cookie-consent");
      if (saved) setChoices(saved.choices);
      setPanel(true);
      setDone((d) => ({ ...d, cookies: false }));
      setActive("cookies");
    };
    window.addEventListener("open-cookie-settings", open);
    return () => window.removeEventListener("open-cookie-settings", open);
  }, []);

  // "Test" buttons on the Vormgeving page: show a popup with the current style, without remembering anything
  useEffect(() => {
    const run = (e) => (e.detail === "policy" ? window.dispatchEvent(new Event("open-cookie-policy")) : setTest(e.detail));
    window.addEventListener("test-popup", run);
    return () => window.removeEventListener("test-popup", run);
  }, []);

  // no scrolling behind a blocking popup
  useEffect(() => {
    const shown = test || active;
    document.body.style.overflow = shown === "age" || shown === "gambling" ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [active, test]);

  if (!cfg) return null;
  const policy = <CookiePolicyModal cfg={cfg} lang={lang} />;
  const current = test || active;
  if (!current) return policy;
  if (current === "example") {
    // sample popup with an image (the site logo) to judge the popup style
    return (
      <>
        {policy}
        <div className="gate-overlay" role="dialog" aria-modal="true" onClick={() => setTest(null)}>
          <div className="gate-modal gate-example" onClick={(e) => e.stopPropagation()}>
            <Logo className="gate-logo" />
            <h2>Voorbeeld-popup</h2>
            <p>Zo ziet een popup met een afbeelding eruit. Het logo komt uit je logo-instellingen en past zich aan de lichte of donkere modus aan.</p>
            <div className="row">
              <button className="btn" onClick={() => setTest(null)}>Sluiten</button>
              <button className="btn primary" onClick={() => setTest(null)}>Doorgaan</button>
            </div>
          </div>
        </div>
      </>
    );
  }
  const gate = cfg[current];
  const t = (k) => pick(gate.texts, lang, cfg.default_language, k).toString().replaceAll("{age}", gate.min_age ?? "");
  const finish = () => {
    setChecked(false);
    setPanel(false);
    if (test) return setTest(null); // preview: remember nothing
    remember(active, gate);
    setDone((d) => ({ ...d, [active]: true }));
  };
  const deny = () => (test ? setTest(null) : gate.deny_url ? (window.location.href = gate.deny_url) : setDenied(true));

  if (current === "age" || current === "gambling") {
    const warnings = current === "gambling" ? pick(gate.texts, lang, cfg.default_language, "warnings") : [];
    const needsConfirm = current === "gambling" && gate.require_confirm;
    return (
      <>
      {policy}
      <div className="gate-overlay" role="dialog" aria-modal="true">
        <div className="gate-modal">
          {denied ? (
            <p>{pick(gate.texts, lang, cfg.default_language, "deny_message") || t("message")}</p>
          ) : (
            <>
              <h2>{t("title")}</h2>
              <p>{t("message")}</p>
              {warnings.length > 0 && <ul className="gate-warnings">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
              {needsConfirm && (
                <label className="check"><input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} /> {t("confirm")}</label>
              )}
              <div className="row">
                <button className="btn" onClick={deny}>{t(current === "age" ? "no" : "deny")}</button>
                <button className="btn primary" disabled={needsConfirm && !checked} onClick={finish}>
                  {t(current === "age" ? "yes" : "confirm") || "OK"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      </>
    );
  }

  // cookies
  const offered = ["analytics", "marketing", "preferences"].filter((c) => gate[c]);
  const save = (c) => {
    if (!test) write(localStorage, "cookie-consent", { v: gate.version, t: Date.now(), choices: c });
    if (!test) window.dispatchEvent(new CustomEvent("cookie-consent", { detail: c }));
    finish();
  };
  const all = Object.fromEntries(offered.map((c) => [c, true]));
  return (
    <>
    {policy}
    <div className={`cookie-banner ${gate.position}`} role="dialog" aria-label={t("title")}>
      <strong>{t("title")}</strong>
      <p>{t("message")} <a href="/cookies" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new Event("open-cookie-policy")); }}>{t("policy_link")}</a></p>
      {panel && (
        <div className="cookie-cats">
          <label className="check"><input type="checkbox" checked disabled /> <span><b>{t("cat_necessary")}</b><small>{t("cat_necessary_desc")}</small></span></label>
          {offered.map((c) => (
            <label className="check" key={c}>
              <input type="checkbox" checked={!!choices[c]} onChange={(e) => setChoices({ ...choices, [c]: e.target.checked })} />
              <span><b>{t(`cat_${c}`)}</b><small>{t(`cat_${c}_desc`)}</small></span>
            </label>
          ))}
        </div>
      )}
      <div className="row">
        {gate.show_reject && !panel && <button className="btn" onClick={() => save({})}>{t("reject")}</button>}
        {offered.length > 0 && !panel && <button className="btn" onClick={() => setPanel(true)}>{t("settings")}</button>}
        {panel && <button className="btn" onClick={() => save(choices)}>{t("save")}</button>}
        <button className="btn primary" onClick={() => save(all)}>{t("accept_all")}</button>
      </div>
    </div>
    </>
  );
}
