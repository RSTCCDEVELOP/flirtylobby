// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useState } from "react";
import { usePresets } from "./PresetPicker";
import { markPlan } from "../lib/planFlag";
import ProgressBar from "./ProgressBar";
import Tabs from "./Tabs";
import { api, errorText, clearToken } from "../lib/api";
import { tx } from "../lib/t";
import { useAuth } from "./AuthContext";

// Back to a clean system: first a back-up (settings, themes and plugins) if wanted, then a confirmation with the password; then everything of the site goes.
export default function SystemReset() {
  const { user } = useAuth();
  const [step, setStep] = useState(0); // 0 closed · 1 back-up? · 2 confirm · 3 done
  const [info, setInfo] = useState(null);
  const [adminMail, setAdminMail] = useState("");
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState(""); // what the progress bar says: "backup" | "reset" | ""
  const [finished, setFinished] = useState(false);
  const [msg, setMsg] = useState(null);
  const [word, setWord] = useState("");
  const [pw, setPw] = useState("");
  // only on your own computer (localhost): "@" as password fills in DEV_LOGIN_PASSWORD (backend/.env), like at the login; the backend gives it only to localhost in DEBUG
  const devFill = async (value) => {
    setPw(value);
    if (value !== "@" || typeof window === "undefined" || !["localhost", "127.0.0.1"].includes(window.location.hostname)) return;
    try {
      const d = await api("/auth/dev-login/");
      if (d?.configured && d.password) setPw(d.password);  // (the password comes with the token: a superadmin+ exists, so the answer holds a token and the password of DEV_LOGIN_PASSWORD)  // (never undefined: the field stays a controlled field)
    } catch {}
  };
  const [saved, setSaved] = useState(false);
  const presets = usePresets();
  const [preset, setPreset] = useState(""); // set up as this standard installation right after the reset
  const [adminsToo, setAdminsToo] = useState(false); // also remove the administrators (users with a role)? by default they stay
  const [superToo, setSuperToo] = useState(false); // also remove the other superadmins (the standard superadmin always stays)? by default they stay
  const [rtab, setRtab] = useState("what"); // the tab of the confirm step: what goes · options · confirm
  const [replay, setReplay] = useState(false); // the switch Onboarding: do the onboarding again, nothing is removed (confirmed with REPLAY)
  const [keepId, setKeepId] = useState(false); // keep the licence, the entities and all users?
  const [remoteToo, setRemoteToo] = useState(false); // also remove the owner and the company from the easy2edit master site?
  const [logsToo, setLogsToo] = useState(false); // also empty the log (Logboek)?
  const [aiToo, setAiToo] = useState(false); // also remove the AI data (calls, costs, credit and its history)?

  async function open() {
    setMsg(null); setSaved(false); setWord(""); setPw("");
    try { setInfo(await api("/system/reset/")); setStep(1); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  }

  async function backup() {
    setBusy(true); setMsg(null); setFinished(false); setJob("backup");
    try {
      const sections = (await api("/settings-backup/sections/")).sections.map((s) => s.key);
      const plugins = (await api("/plugins/").catch(() => ({ plugins: [] }))).plugins.map((x) => x.name);
      const themes = (await api("/theme/packs/").catch(() => ({ packs: [] }))).packs.filter((x) => !x.builtin).map((x) => x.key);
      const b = await api("/settings-backup/export/", { method: "POST", body: { sections, include_secrets: true, include_files: true, plugins, themes } });
      const a = document.createElement("a");
      const d = new Date(), p = (n) => String(n).padStart(2, "0");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(b, null, 2)], { type: "application/json" }));
      a.download = `easy2edit-back-up-voor-reset-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      setSaved(true);
      const failed = Object.keys(b.errors || {});
      setMsg({ ok: !failed.length, text: failed.length ? tx("Back-up gemaakt, maar niet alles lukte: {0}", failed.join(", ")) : tx("Back-up gedownload ({0} onderdelen).", Object.keys(b.sections).length) });
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setFinished(true); await new Promise((r) => setTimeout(r, 500)); setJob(""); setFinished(false);
    setBusy(false);
  }

  async function startReplay() {
    setBusy(true); setMsg(null);
    try {
      await api("/system/reset/", { method: "POST", body: { mode: "replay", confirm: word, password: pw } });
      setStep(4);
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  }

  async function reset() {
    setBusy(true); setMsg(null); setFinished(false); setJob("reset");
    try {
      const r = await api("/system/reset/", { method: "POST", body: { confirm: word, password: pw, preset, ai: aiToo, clear_logs: logsToo, delete_admins: adminsToo && !keepId, delete_superadmins: superToo, keep_identity: keepId, remove_remote: remoteToo && !!info.remote_owner } });
      setAdminMail(r?.admin || "");
      setFinished(true);
      await new Promise((r) => setTimeout(r, 700)); // the bar shows 100% for a moment
      markPlan();  // after a reset the step plan of Website ontwerpen opens
      try { localStorage.removeItem("theme"); document.documentElement.dataset.theme = "light"; } catch {}  // back to the standard theme in light mode (also on this device)
      setStep(3);
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setJob(""); setFinished(false); setBusy(false);
  }

  const localPlus = typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname) && !!user?.is_superadmin_plus;
  const atHint = localPlus ? <small className="muted" style={{ display: "block", marginTop: ".2rem" }}>{tx("Op localhost: typ een @ om je lokale wachtwoord in te vullen.")}</small> : null;
  const tabNow = replay && rtab === "what" ? "options" : rtab;
  const ONB = (
    <label className="check sec-toggle" style={{ borderTop: "1px solid var(--e2e-line, rgba(0,0,0,.12))", paddingTop: ".7rem" }}>
                  <span className="switch"><input type="checkbox" checked={replay} onChange={(e) => { setReplay(e.target.checked); setWord(""); setMsg(null); }} /><span /></span>
      <span>{tx("Onboarding")}
        <small className="muted" style={{ display: "block" }}>{tx("Aan: er wordt niets verwijderd. Bij het inloggen van een admin of superadmin komt de onboarding opnieuw. Bestaat alles al, dan is het alleen een controle; wat nog niet bestaat wordt aangemaakt.")}</small>
      </span>
    </label>
  );
  const close = () => { if (!busy) { setStep(0); if (step === 3) { clearToken(); window.location.href = "/login"; } } };  // after a reset everybody is logged out (the server removed every login): always to the login, with or without a standard superadmin
  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>{tx("Maakt het systeem schoon: alle gebruikers (behalve de superadmins), afbeeldingen, pagina's, thema's en gegevens van de modules en plugins worden verwijderd. Alle modules en alle plugins gaan uit (alleen Users en de kernonderdelen blijven aan), het thema wordt easy2edit en de licentie wordt leeggemaakt.")}</p>
      <button type="button" className="btn danger" onClick={open}>{tx("Systeem resetten…")}</button>
      {msg && step === 0 && <div className="alert" style={{ marginTop: ".6rem" }}>{msg.text}</div>}

      {step > 0 && (
        <div className="overlay" onClick={close}>
          <div className="card modal form" style={{ maxWidth: step === 2 ? 680 : 560, width: "100%" }} onClick={(e) => e.stopPropagation()}>
            {step === 1 && info && (
              <>
                <h2 style={{ margin: 0 }}>{tx("Systeem resetten")}</h2>
                <strong>{tx("Wil je eerst een back-up maken van alle huidige instellingen, thema's en plugins?")}</strong>
                <p className="muted" style={{ margin: 0 }}>{tx("Het bestand bevat de instellingen, de thema's, de plugins en de logo's en afbeeldingen van de instellingen. Je kunt het later terugzetten bij Super admin → Instellingen back-up.")}</p>
                {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
                <ProgressBar running={job === "backup"} done={finished && job === "backup"} label={tx("Back-up wordt gemaakt…")} />
                <div className="row" style={{ justifyContent: "flex-end" }}>
                  <button type="button" className="btn" disabled={busy} onClick={close}>{tx("Annuleren")}</button>
                  <button type="button" className="btn primary" disabled={busy} onClick={backup}>{busy ? tx("Bezig…") : saved ? tx("Opnieuw een back-up maken") : tx("Back-up downloaden")}</button>
                  <button type="button" className="btn danger" disabled={busy} onClick={() => { setMsg(null); setRtab("what"); setStep(2); }}>{saved ? tx("Verder") : tx("Zonder back-up verder")}</button>
                </div>
              </>
            )}
            {step === 2 && info && (
              <form onSubmit={(e) => e.preventDefault()} style={{ display: "contents" }}>
                <h2 style={{ margin: 0 }}>{replay ? tx("Onboarding opnieuw doen") : tx("Weet je het zeker?")}</h2>
                <Tabs value={tabNow} onChange={setRtab} tabs={replay ? [["options", tx("Opties")], ["confirm", tx("Bevestigen")]] : [["what", tx("Wat verdwijnt")], ["options", tx("Opties")], ["confirm", tx("Bevestigen")]]} />
                <div className="stack" style={{ gap: ".8rem", minHeight: 330, maxHeight: "52vh", overflowY: "auto", alignContent: "start", paddingRight: ".2rem" }}>
                  {tabNow === "what" && !replay && (<>
                <div className="alert">
                  {tx("Dit verwijdert voorgoed:")}
                  <ul style={{ margin: ".4rem 0 0", paddingLeft: "1.2rem" }}>
                    {!keepId && <li>{tx("{0} gebruikers met hun profielen, berichten en gegevens", Math.max(0, info.users - (adminsToo ? 0 : info.admins || 0)))}</li>}
                    {adminsToo && info.admins > 0 && <li>{tx("{0} admins (gebruikers met een rol)", info.admins)}</li>}
                    {superToo && info.other_superadmins > 0 && <li>{tx("{0} andere superadmins", info.other_superadmins)}</li>}
                    <li>{tx("{0} afbeeldingen en video's uit de bibliotheek", info.media)}</li>
                    <li>{tx("{0} eigen pagina's en alle teksten en blokken", info.pages)}</li>
                    {(info.designs > 0 || info.imports > 0) && <li>{tx("{0} ontwerpen en {1} geïmporteerde websites, met hun bestanden", info.designs || 0, info.imports || 0)}</li>}
                    <li>{tx("De gegevens van {0} plugins (de plugins gaan uit) en {1} thema's", info.plugins, info.themes)}</li>
                    <li>{tx("Bestellingen, abonnementen, donaties, chats en alle andere gegevens van de modules")}</li>
                  </ul>
                </div>
                <small className="muted">{info.standard_admin ? tx("Blijft: de standaard superadmin {0} (met het standaardwachtwoord opnieuw gemaakt), de talen,", info.standard_admin) : tx("Blijft: {0} superadmin(s), de talen,", info.superadmins)}{" "}{tx("de instellingen van de installatie (adressen, beveiliging, e-mail, API keys) en de ingebouwde thema's. Daarna staan alle modules en plugins uit en is het thema easy2edit, in lichte weergave.")}{" "}{tx("In de map site blijven alleen de database, de backups, de instellingen en exports van de superadmin (content) en de plugins staan; de rest (geëxporteerde pagina's, imports, toegevoegde templates, bestanden in de mediamap) wordt opgeruimd.")}</small>
                  </>)}
                  {tabNow === "options" && (<>
                    {ONB}
                    {replay ? (
                      <div className="alert ok">{tx("Alle gegevens blijven bestaan: gebruikers, pagina's, instellingen, de licentie en de installatie. De eerste vragen en het formulier met de basisgegevens komen opnieuw, ingevuld met wat er is. Ontbreekt er een superadmin, de entiteit van de website of de contactpersoon als gebruiker, dan wordt die aangemaakt.")}</div>
                    ) : (<>
                <label className="check sec-toggle">
                  <span className="switch"><input type="checkbox" checked={keepId} onChange={(e) => setKeepId(e.target.checked)} /><span /></span>
                  <span>{tx("Licentie, entiteiten en users behouden?")}
                    <small className="muted" style={{ display: "block" }}>{tx("Aan: de licentie, alle entiteiten en alle users (met hun koppelingen) blijven bestaan. Hun berichten, bestanden en andere inhoud gaan wel weg. Uit: alles gaat weg.")}</small>
                  </span>
                </label>
                {info.admins > 0 && !keepId && (
                  <label className="check sec-toggle">
                    <span className="switch"><input type="checkbox" checked={adminsToo} onChange={(e) => setAdminsToo(e.target.checked)} /><span /></span>
                    <span>{tx("Ook de admins verwijderen?")}
                      <small className="muted" style={{ display: "block" }}>{tx("{0} admins (gebruikers met een rol of eigen rechten). Uit: ze blijven bestaan met hun rol en kunnen blijven inloggen; hun inhoud gaat wel weg.", info.admins)}</small>
                    </span>
                  </label>
                )}
                {info.remote_owner && (
                  <label className="check sec-toggle">
                    <span className="switch"><input type="checkbox" checked={remoteToo} onChange={(e) => setRemoteToo(e.target.checked)} /><span /></span>
                    <span>{tx("Ook de eigenaar en het bedrijf van de easy2edit server verwijderen?")}
                      <small className="muted" style={{ display: "block" }}>{tx("Bij het aanmaken van de licentie zijn de eigenaar en het bedrijf van deze website ook op de easy2edit server gemaakt (voor de facturen). Aan: ze worden daar weer verwijderd, of alleen het adres van deze website, als ze ook voor een andere website van jou gelden. Uit: ze blijven daar staan.")}</small>
                    </span>
                  </label>
                )}
                {info.other_superadmins > 0 && (
                  <label className="check sec-toggle">
                    <span className="switch"><input type="checkbox" checked={superToo} onChange={(e) => setSuperToo(e.target.checked)} /><span /></span>
                    <span>{tx("Ook de andere superadmins verwijderen?")}
                      <small className="muted" style={{ display: "block" }}>{tx("{0} andere superadmins. De standaard superadmin blijft altijd. Uit: ze blijven bestaan en kunnen blijven inloggen.", info.other_superadmins)}</small>
                    </span>
                  </label>
                )}
                {(info.ai_calls > 0 || info.ai_ledger > 0 || info.ai_credit > 0) && (
                  <label className="check sec-toggle">
                    <span className="switch"><input type="checkbox" checked={aiToo} onChange={(e) => setAiToo(e.target.checked)} /><span /></span>
                    <span>{tx("Ook de AI-gegevens in de database verwijderen?")}
                      <small className="muted" style={{ display: "block" }}>{tx("{0} AI-aanroepen met hun kosten, het tegoed (en de geschiedenis van {1} betalingen en boekingen) van de superadmins. De AI-instellingen (prijzen, marges, koppelingen) blijven. Het tegoed van gebruikers verdwijnt sowieso met de gebruikers.", info.ai_calls, info.ai_ledger)}{info.ai_credit > 0 ? ` ${tx("Let op: er staat nog {0} aan tegoed van gebruikers.", info.ai_credit.toFixed(2))}` : ""}</small></span>
                  </label>
                )}
                <label className="check sec-toggle">
                  <span className="switch"><input type="checkbox" checked={logsToo} onChange={(e) => setLogsToo(e.target.checked)} /><span /></span>
                  <span>{tx("Ook het logboek legen?")}
                    <small className="muted" style={{ display: "block" }}>{tx("Uit: het logboek blijft bewaard, ook wie de reset deed. Aan: alle regels worden verwijderd en het logboek begint opnieuw met de reset.")}</small>
                  </span>
                </label>
                {presets?.length > 0 && (
                  <label>{tx("Daarna meteen instellen als")}
                    <select value={preset} onChange={(e) => setPreset(e.target.value)}>
                      <option value="">{tx("Niets: alles uit")}</option>
                      {presets.map((p) => <option key={p.key} value={p.key}>{p.icon} {tx(p.name)}</option>)}
                    </select>
                  </label>
                )}
                    </>)}
                  </>)}
                  {tabNow === "confirm" && (replay ? (<>
                    <label>{tx("Typ REPLAY om te bevestigen")}<input value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" /></label>
                    <label>{tx("Je wachtwoord")}<input type="password" value={pw} onChange={(e) => devFill(e.target.value)} autoComplete="current-password" />{atHint}</label>
                  </>) : (<>
                <label>{tx("Typ RESET om te bevestigen")}<input value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" /></label>
                <label>{tx("Je wachtwoord")}<input type="text" name="username" value={user?.email || ""} autoComplete="username" readOnly tabIndex={-1} aria-hidden="true" style={{ position: "absolute", width: 1, height: 1, margin: -1, padding: 0, border: 0, overflow: "hidden", clip: "rect(0 0 0 0)" }} /><input type="password" name="password" value={pw} onChange={(e) => devFill(e.target.value)} autoComplete="current-password" />{atHint}</label>
                  </>))}
                </div>
                {msg && <div className="alert">{msg.text}</div>}
                <ProgressBar running={job === "reset"} done={finished} label={tx("Het systeem wordt schoongemaakt…")} />
                <div className="row" style={{ justifyContent: "flex-end", borderTop: "1px solid var(--e2e-line, rgba(0,0,0,.12))", paddingTop: ".8rem" }}>
                  <button type="button" className="btn" disabled={busy} onClick={close}>{tx("Annuleren")}</button>
                  {replay
                    ? <button type="button" className="btn primary" disabled={busy || word.trim().toUpperCase() !== "REPLAY" || !pw} onClick={startReplay}>{busy ? tx("Bezig…") : tx("Onboarding opnieuw starten")}</button>
                    : <button type="button" className="btn danger" disabled={busy || word !== "RESET" || !pw} onClick={reset}>{busy ? tx("Bezig…") : tx("Alles verwijderen")}</button>}
                </div>
              </form>
            )}
            {step === 4 && (
              <>
                <h2 style={{ margin: 0 }}>{tx("De onboarding komt opnieuw")}</h2>
                <p style={{ margin: 0 }}>{tx("Er is niets verwijderd. Bij het inloggen van een admin of superadmin komen de eerste vragen en het formulier met de basisgegevens opnieuw. Wat al bestaat, hoef je alleen te controleren.")}</p>
                <div className="row" style={{ justifyContent: "flex-end" }}><button type="button" className="btn primary" onClick={() => { setStep(0); window.location.reload(); }}>{tx("Sluiten")}</button></div>
              </>
            )}
            {step === 3 && (
              <>
                <h2 style={{ margin: 0 }}>{tx("Het systeem is schoon")}</h2>
                <p style={{ margin: 0 }}>{tx("Alle gegevens van de site zijn verwijderd, alle modules en plugins staan uit en het thema is easy2edit. Zet bij Super admin → Modules en Plugins aan wat je nodig hebt.")}</p>
                {!adminMail && <p style={{ margin: 0 }}>{tx("Iedereen is uitgelogd: je gaat nu naar het inlogscherm.")}</p>}
                {adminMail && <p style={{ margin: 0 }}>{tx("De standaard superadmin is {0}. Andere superadmins zijn verwijderd en iedereen is uitgelogd: log opnieuw in met het standaardwachtwoord.", adminMail)}</p>}
                <div className="row" style={{ justifyContent: "flex-end" }}><button type="button" className="btn primary" onClick={close}>{tx("Sluiten")}</button></div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
