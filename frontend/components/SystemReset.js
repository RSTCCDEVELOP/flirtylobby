"use client";

import { useState } from "react";
import { usePresets } from "./PresetPicker";
import ProgressBar from "./ProgressBar";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";

// Back to a clean system: first a back-up (settings, themes and plugins) if wanted, then a confirmation with the password; then everything of the site goes.
export default function SystemReset() {
  const [step, setStep] = useState(0); // 0 closed · 1 back-up? · 2 confirm · 3 done
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState(""); // what the progress bar says: "backup" | "reset" | ""
  const [finished, setFinished] = useState(false);
  const [msg, setMsg] = useState(null);
  const [word, setWord] = useState("");
  const [pw, setPw] = useState("");
  const [saved, setSaved] = useState(false);
  const presets = usePresets();
  const [preset, setPreset] = useState(""); // set up as this standard installation right after the reset

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
      a.download = `flirtylobby-back-up-voor-reset-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      setSaved(true);
      const failed = Object.keys(b.errors || {});
      setMsg({ ok: !failed.length, text: failed.length ? tx("Back-up gemaakt, maar niet alles lukte: {0}", failed.join(", ")) : tx("Back-up gedownload ({0} onderdelen).", Object.keys(b.sections).length) });
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setFinished(true); await new Promise((r) => setTimeout(r, 500)); setJob(""); setFinished(false);
    setBusy(false);
  }

  async function reset() {
    setBusy(true); setMsg(null); setFinished(false); setJob("reset");
    try {
      await api("/system/reset/", { method: "POST", body: { confirm: word, password: pw, preset } });
      setFinished(true);
      await new Promise((r) => setTimeout(r, 700)); // the bar shows 100% for a moment
      setStep(3);
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setJob(""); setFinished(false); setBusy(false);
  }

  const close = () => { if (!busy) { setStep(0); if (step === 3) window.location.href = "/dashboard/superadmin"; } };
  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>{tx("Maakt het systeem schoon: alle gebruikers (behalve de superadmins), afbeeldingen, pagina's, thema's en gegevens van de modules en plugins worden verwijderd. Alle modules en alle plugins gaan uit (alleen Users en de kernonderdelen blijven aan), het thema wordt Easy2edit en de licentie wordt leeggemaakt.")}</p>
      <button type="button" className="btn danger" onClick={open}>{tx("Systeem resetten…")}</button>
      {msg && step === 0 && <div className="alert" style={{ marginTop: ".6rem" }}>{msg.text}</div>}

      {step > 0 && (
        <div className="overlay" onClick={close}>
          <div className="card modal form" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
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
                  <button type="button" className="btn danger" disabled={busy} onClick={() => { setMsg(null); setStep(2); }}>{saved ? tx("Verder") : tx("Zonder back-up verder")}</button>
                </div>
              </>
            )}
            {step === 2 && info && (
              <>
                <h2 style={{ margin: 0 }}>{tx("Weet je het zeker?")}</h2>
                <div className="alert">
                  {tx("Dit verwijdert voorgoed:")}
                  <ul style={{ margin: ".4rem 0 0", paddingLeft: "1.2rem" }}>
                    <li>{tx("{0} gebruikers met hun profielen, berichten en gegevens", info.users)}</li>
                    <li>{tx("{0} afbeeldingen en video's uit de bibliotheek", info.media)}</li>
                    <li>{tx("{0} eigen pagina's en alle teksten en blokken", info.pages)}</li>
                    <li>{tx("De gegevens van {0} plugins (de plugins gaan uit) en {1} thema's", info.plugins, info.themes)}</li>
                    <li>{tx("Bestellingen, abonnementen, donaties, chats en alle andere gegevens van de modules")}</li>
                  </ul>
                </div>
                <small className="muted">{tx("Blijft: {0} superadmin(s), de talen, de instellingen van de installatie (adressen, beveiliging, e-mail, API keys) en de ingebouwde thema's. Daarna staan alle modules en plugins uit en is het thema Easy2edit.", info.superadmins)}</small>
                {presets?.length > 0 && (
                  <label>{tx("Daarna meteen instellen als")}
                    <select value={preset} onChange={(e) => setPreset(e.target.value)}>
                      <option value="">{tx("Niets: alles uit")}</option>
                      {presets.map((p) => <option key={p.key} value={p.key}>{p.icon} {tx(p.name)}</option>)}
                    </select>
                  </label>
                )}
                <label>{tx("Typ RESET om te bevestigen")}<input value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" /></label>
                <label>{tx("Je wachtwoord")}<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></label>
                {msg && <div className="alert">{msg.text}</div>}
                <ProgressBar running={job === "reset"} done={finished} label={tx("Het systeem wordt schoongemaakt…")} />
                <div className="row" style={{ justifyContent: "flex-end" }}>
                  <button type="button" className="btn" disabled={busy} onClick={close}>{tx("Annuleren")}</button>
                  <button type="button" className="btn danger" disabled={busy || word !== "RESET" || !pw} onClick={reset}>{busy ? tx("Bezig…") : tx("Alles verwijderen")}</button>
                </div>
              </>
            )}
            {step === 3 && (
              <>
                <h2 style={{ margin: 0 }}>{tx("Het systeem is schoon")}</h2>
                <p style={{ margin: 0 }}>{tx("Alle gegevens van de site zijn verwijderd, alle modules en plugins staan uit en het thema is Easy2edit. Zet bij Super admin → Modules en Plugins aan wat je nodig hebt.")}</p>
                <div className="row" style={{ justifyContent: "flex-end" }}><button type="button" className="btn primary" onClick={close}>{tx("Sluiten")}</button></div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
