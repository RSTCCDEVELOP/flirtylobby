// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../lib/t";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, downloadPost, errorText, ApiError } from "../lib/api";
import { IconFolder, IconGrid, IconLock, IconPalette, IconSliders, IconUsers } from "./Icons";
import Tabs from "./Tabs";
import { useAuth } from "./AuthContext";
import BackupLoadPopup from "./BackupLoadPopup";

// Super admin: export all settings to one file (complete backup) and load such a file again.
// The list of parts comes from the server, so new applications show up here by themselves and removed ones disappear.
// Ready-made selections: a theme package (look), theme + screens, or the settings without the look. Parts that do not exist are ignored.
const PRESETS = [
  ["all", "Alles", null, "Complete back-up van het hele systeem."],
  ["theme", "Thema & huisstijl", ["branding", "theme", "themepacks"], "Kleuren, lettertypen, popups, tabbladen en logo's."],
  ["screens", "Thema + schermen", ["branding", "media_files", "theme", "themepacks", "community", "pages", "content", "seo", "dashboard"], "Het thema plus pagina's, menu, teksten, SEO, profielthema en dashboard: om een nieuwe site in dezelfde stijl te starten."],
  ["settings", "Instellingen zonder thema", ["security", "modules", "languages", "communication", "integrations", "sandbox"], "Beveiliging, modules, talen, communicatie, koppelingen en sandbox."],
];

// The parts of the back-up in tabs, so the long list stays easy to survey (parts that are not listed end up under "Overig")
const GROUPS = [
  ["look", "Vormgeving", <IconPalette key="a" />, ["branding", "media_files", "theme", "dashboard"]],
  ["themes", "Thema's", <IconGrid key="t" />, ["themepacks"]],
  ["plugins", "Plugins", <IconGrid key="pl" />, ["plugins"]],
  ["site", "Website", <IconGrid key="b" />, ["system", "pages", "content", "seo", "languages"]],
  ["community", "Community", <IconUsers key="c" />, ["community", "subscriptions"]],
  ["system", "Systeem", <IconLock key="d" />, ["security", "modules", "communication", "integrations", "sandbox"]],
];

export default function SettingsBackup() {
  const { user } = useAuth();
  const [tab, setTab] = useState("export");
  const [sections, setSections] = useState([]);
  const [pick, setPick] = useState([]);
  const [secrets, setSecrets] = useState(false);
  const [grp, setGrp] = useState("look");
  const [themes, setThemes] = useState([]); // theme packages, to choose from
  const [themePick, setThemePick] = useState([]);
  const [plugins, setPlugins] = useState([]); // installed plugins, to choose from
  const [plugPick, setPlugPick] = useState([]);
  const [files, setFiles] = useState(true); // logos and pictures inside the file
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState(""); // the restore on the server (temporary files, removed when it is finished)
  const [zipPw, setZipPw] = useState(false); // protect the zip with a password
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [useLogin, setUseLogin] = useState(false); // the zip password is the login password of the logged-in person
  const [loginPw, setLoginPw] = useState("");
  const [remember, setRemember] = useState(false); // keep the password for my account (encrypted on the server)
  const [saved, setSaved] = useState(false); // a password is remembered for my account
  const [useSaved, setUseSaved] = useState(true);
  const [pending, setPending] = useState(null); // zip that asks for a password
  const [openPw, setOpenPw] = useState("");
  const [info, setInfo] = useState(null); // inspect result
  const [load, setLoad] = useState([]); // parts to load
  const [results, setResults] = useState(null);
  const [over, setOver] = useState(false);
  const [popup, setPopup] = useState(false); // the load popup
  const file = useRef(null);

  useEffect(() => { api("/settings-backup/sections/").then((d) => { setSections(d.sections); setPick(d.sections.map((s) => s.key)); }).catch((e) => setMsg({ ok: false, text: errorText(e) })); }, []);

  useEffect(() => { api("/settings-backup/password/").then((d) => setSaved(!!d.saved)).catch(() => {}); }, []);

  useEffect(() => { api("/plugins/").then((d) => { setPlugins(d.plugins); setPlugPick(d.plugins.map((x) => x.name)); }).catch(() => {}); }, []);

  useEffect(() => { api("/theme/packs/").then((d) => { const t = d.packs.filter((x) => !x.builtin); setThemes(t); setThemePick(t.map((x) => x.key)); }).catch(() => {}); }, []);

  const exportNow = async () => {
    const fromSaved = zipPw && !useLogin && saved && useSaved;
    if (zipPw && useLogin && !loginPw) return setMsg({ ok: false, text: tx("Vul je inlogwachtwoord in.") });
    if (zipPw && !useLogin && !fromSaved && (pw.length < 6 || pw !== pw2)) return setMsg({ ok: false, text: pw.length < 6 ? tx("Kies een wachtwoord van minstens 6 tekens.") : tx("De twee wachtwoorden zijn niet gelijk.") });
    setBusy(true); setMsg(null);
    try {
      const h = await downloadPost("/settings-backup/export-zip/", { sections: pick, include_secrets: secrets, include_files: files, plugins: plugPick, themes: themePick, password: zipPw && !fromSaved && !useLogin ? pw : "", login_password: zipPw && useLogin ? loginPw : "", use_saved: fromSaved, remember: zipPw && !fromSaved && !useLogin && remember }, "easy2edit-instellingen.zip");
      if (zipPw && !fromSaved && !useLogin && remember) { setSaved(true); setUseSaved(true); setPw(""); setPw2(""); }
      const failed = (h.get("X-Backup-Errors") || "").split(",").filter(Boolean);
      setMsg({ ok: !failed.length, text: failed.length ? tx("Back-up gemaakt, maar niet alles lukte: {0}", failed.join(", ")) : zipPw ? tx("Back-up gedownload als zip met wachtwoord.") : tx("Back-up gedownload als zip.") });
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };

  const tokenRef = useRef("");
  tokenRef.current = token;
  useEffect(() => () => { if (tokenRef.current) api("/settings-backup/restore/close/", { method: "POST", body: { token: tokenRef.current } }).catch(() => {}); }, []); // leaving the screen: the temporary files go too
  const endRestore = useCallback((t) => { if (t) api("/settings-backup/restore/close/", { method: "POST", body: { token: t } }).catch(() => {}); }, []);
  // the zip goes to the server, which reads it (asking for the password when it is protected) and keeps the parts as temporary files
  const open = async (f, password = "") => {
    setMsg(null); setResults(null); setInfo(null);
    if (token) { endRestore(token); setToken(""); }
    if (!f) return;
    setBusy(true);
    try {
      const fd = new FormData(); fd.append("file", f); if (password) fd.append("password", password);
      const i = await api("/settings-backup/restore/open/", { method: "POST", body: fd });
      setToken(i.token); setInfo(i); setLoad(i.known.map((k) => k.key)); setPending(null); setOpenPw("");
    } catch (e) {
      if (e instanceof ApiError && e.data?.code === "password_required") { setPending(f); setMsg(null); }
      else if (e instanceof ApiError && e.data?.code === "wrong_password") { setPending(f); setMsg({ ok: false, text: tx("Het wachtwoord klopt niet.") }); }
      else { setPending(null); setMsg({ ok: false, text: errorText(e) }); }
    }
    setBusy(false);
  };
  const choose = (f) => { setOpenPw(""); open(f); };

  const toggle = (list, setList, k) => setList(list.includes(k) ? list.filter((x) => x !== k) : [...list, k]);
  const Check = ({ s, list, setList }) => (
    <label key={s.key} className="check bk-item"><input type="checkbox" checked={list.includes(s.key)} onChange={() => toggle(list, setList, s.key)} />
      <span><strong>{tx(s.label)}</strong>{s.sensitive && <span className="badge" style={{ marginLeft: ".4rem" }}>{tx("gevoelig")}</span>}<br /><small className="muted">{tx(s.description)}</small></span></label>
  );

  return (
    <div className="form">
      <Tabs value={tab} onChange={setTab} tabs={[["export", "Back-up", <IconFolder key="e" />], ["load", "Restore", <IconSliders key="l" />]]} />
      {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}

      {popup && <BackupLoadPopup token={token} keys={load} labels={Object.fromEntries((info?.known || []).map((k) => [k.key, k.label]))} onClose={() => { setPopup(false); endRestore(token); setToken(""); setInfo(null); }} />}

      {tab === "export" && (
        <>
          <p className="muted" style={{ margin: 0 }}>{tx("Een complete back-up van alle instellingen in één bestand: vormgeving, beveiliging, modules, talen, pagina's, community, SEO en meer. Gebruikers, bestellingen en bestanden zitten er niet in.")}</p>
          <div className="chips" style={{ margin: 0 }}>
            {PRESETS.map(([k, label, keys, hint]) => <button key={k} type="button" className="chip" title={tx(hint)} onClick={() => setPick(keys ? sections.map((s) => s.key).filter((x) => keys.includes(x)) : sections.map((s) => s.key))}>{tx(label)}</button>)}
          </div>
          {(() => {
            const known = new Set(GROUPS.flatMap((g) => g[3]));
            const tabs = [...GROUPS.map(([k, l, i, keys]) => [k, l, i, keys]), ["other", "Overig", <IconSliders key="o" />, sections.map((x) => x.key).filter((k) => !known.has(k))]]
              .map(([k, l, i, keys]) => ({ k, l, i, items: sections.filter((x) => keys.includes(x.key)) })).filter((g) => g.items.length || g.k === "other");
            const cur = tabs.find((g) => g.k === grp) || tabs[0];
            if (!cur) return null;
            return (
              <>
                <Tabs value={cur.k} onChange={setGrp} tabs={tabs.map((g) => [g.k, g.l, g.i, `${g.items.filter((x) => pick.includes(x.key)).length}/${g.items.length}`])} />
                <div className="bk-grid">{cur.items.map((x) => <Check key={x.key} s={x} list={pick} setList={setPick} />)}</div>
                {cur.k === "other" && (
                  <div className="stack-sm">
                  <label className="check sec-toggle">
                    <span className="switch"><input type="checkbox" checked={files} onChange={(e) => setFiles(e.target.checked)} /><span /></span>
                    <span>{tx("Logo's, afbeeldingen en plugins meenemen")} <small className="muted">{tx("De bestanden zelf gaan in de back-up, zodat een nieuwe site er meteen hetzelfde uitziet. Het bestand wordt dan groter.")}</small></span>
                  </label>
                  <label className="check sec-toggle">
                    <span className="switch"><input type="checkbox" checked={secrets} onChange={(e) => setSecrets(e.target.checked)} /><span /></span>
                    <span>{tx("API-sleutels meenemen")} <small className="muted">{tx("Alleen aanzetten voor een eigen, veilig bewaarde back-up: iedereen met het bestand kan de sleutels lezen.")}</small></span>
                  </label>
                  </div>
                )}
                {cur.items.some((x) => x.key === "themepacks") && pick.includes("themepacks") && (
                  <div className="card" style={{ display: "grid", gap: ".4rem" }}>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <strong>{tx("Welke themapakketten")} ({themePick.length}/{themes.length})</strong>
                      <button type="button" className="btn sm" onClick={() => setThemePick(themePick.length === themes.length ? [] : themes.map((x) => x.key))}>{themePick.length === themes.length ? tx("Niets selecteren") : tx("Alles selecteren")}</button>
                    </div>
                    <div className="bk-cols">{themes.length ? themes.map((x) => (
                      <label key={x.key} className="check"><input type="checkbox" checked={themePick.includes(x.key)} onChange={() => toggle(themePick, setThemePick, x.key)} /><span>{x.name} <small className="muted">v{x.version}{x.enabled ? ` · ${tx("aan")}` : ` · ${tx("uit")}`}</small></span></label>
                    )) : <small className="muted">{tx("Er zijn geen themapakketten.")}</small>}</div>
                    <small className="muted">{tx("RSTCC en Studio2 zitten altijd in het systeem en gaan niet mee. Ook of een pakket aan of uit staat gaat mee.")}</small>
                  </div>
                )}
                {cur.items.some((x) => x.key === "plugins") && pick.includes("plugins") && (
                  <div className="card" style={{ display: "grid", gap: ".4rem" }}>
                    <strong>{tx("Welke plugins")}</strong>
                    <div className="bk-cols">{plugins.length ? plugins.map((x) => (
                      <label key={x.name} className="check"><input type="checkbox" checked={plugPick.includes(x.name)} onChange={() => toggle(plugPick, setPlugPick, x.name)} /><span>{x.title} <small className="muted">{x.version}{x.enabled ? "" : ` · ${tx("uit")}`}</small></span></label>
                    )) : <small className="muted">{tx("Er zijn geen plugins geïnstalleerd.")}</small>}</div>
                    <small className="muted">{tx("De plugin zelf (ondertekend) gaat mee als bij Overig de schakelaar Logo's, afbeeldingen en plugins meenemen aan staat. De gegevens die een plugin heeft opgeslagen, zoals advertenties, gaan niet mee.")}</small>
                  </div>
                )}
              </>
            );
          })()}
          <label className="check sec-toggle">
            <span className="switch"><input type="checkbox" checked={zipPw} onChange={(e) => { setZipPw(e.target.checked); setPw(""); setPw2(""); }} /><span /></span>
            <span>{tx("Zip beveiligen met een wachtwoord")} <small className="muted">{tx("De zip wordt versleuteld (AES-256). Bij het terugzetten wordt het wachtwoord gevraagd. Bewaar het goed: zonder wachtwoord is de back-up niet te openen.")}</small></span>
          </label>
          {zipPw && (
            <label className="check sec-toggle">
              <span className="switch"><input type="checkbox" checked={useLogin} onChange={(e) => { setUseLogin(e.target.checked); setLoginPw(""); }} /><span /></span>
              <span>{tx("Mijn inlogwachtwoord gebruiken")} <small className="muted">{tx("Het wachtwoord van de ingelogde gebruiker wordt het wachtwoord van de zip. Je vult het hier eenmalig in; het wordt gecontroleerd en niet bewaard.")}</small></span>
            </label>
          )}
          {zipPw && useLogin && (
            <label style={{ maxWidth: 320 }}>{tx("Je inlogwachtwoord")}
              <input type="text" name="username" value={user?.email || ""} autoComplete="username" readOnly tabIndex={-1} aria-hidden="true" style={{ position: "absolute", width: 1, height: 1, margin: -1, padding: 0, border: 0, overflow: "hidden", clip: "rect(0 0 0 0)" }} />
              <input type="password" value={loginPw} onChange={(e) => setLoginPw(e.target.value)} autoComplete="current-password" />
            </label>
          )}
          {zipPw && !useLogin && saved && (
            <div className="row" style={{ justifyContent: "flex-start", alignItems: "center" }}>
              <label className="check"><input type="checkbox" checked={useSaved} onChange={(e) => setUseSaved(e.target.checked)} /><span>{tx("Het opgeslagen wachtwoord van mijn account gebruiken")}</span></label>
              <button type="button" className="btn sm" onClick={async () => { await api("/settings-backup/password/", { method: "DELETE" }).catch(() => {}); setSaved(false); setUseSaved(true); }}>{tx("Wachtwoord vergeten")}</button>
            </div>
          )}
          {zipPw && !useLogin && !(saved && useSaved) && (
            <>
              <div className="row nw" style={{ justifyContent: "flex-start", flexWrap: "nowrap" }}>
                <label style={{ flex: 1, maxWidth: 260 }}>{tx("Wachtwoord")}<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></label>
                <label style={{ flex: 1, maxWidth: 260 }}>{tx("Herhaal wachtwoord")}<input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></label>
              </div>
              <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /><span>{tx("Wachtwoord onthouden voor mijn account")} <small className="muted">{tx("Versleuteld bewaard op de server. Bij het terugzetten wordt het automatisch geprobeerd.")}</small></span></label>
            </>
          )}
          <div className="row" style={{ justifyContent: "flex-start" }}>
            <button className="btn primary" disabled={busy || !pick.length} onClick={exportNow}>{busy ? tx("Bezig…") : tx("Back-up downloaden")}</button>
            <button className="btn" onClick={() => setPick(pick.length === sections.length ? [] : sections.map((s) => s.key))}>{pick.length === sections.length ? tx("Niets selecteren") : tx("Alles selecteren")}</button>
          </div>
        </>
      )}

      {tab === "load" && (
        <>
          <p className="muted" style={{ margin: 0 }}>{tx("Kies een eerder gemaakt instellingenbestand. Onderdelen die dit systeem niet kent worden overgeslagen, onderdelen die niet in het bestand staan blijven zoals ze zijn.")}</p>
          <div className={`dropzone ${over ? "over" : ""}`} role="button" tabIndex={0} onClick={() => file.current.click()} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && file.current.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); choose(e.dataTransfer.files[0]); }}>
            <span>{tx("Sleep het back-upbestand (.zip) hierheen of klik om te kiezen")}</span>
            <input ref={file} type="file" accept=".zip,.json,application/zip,application/json" hidden onChange={(e) => { choose(e.target.files[0]); e.target.value = ""; }} />
          </div>
          {pending && (
            <form className="row nw" style={{ justifyContent: "flex-start", flexWrap: "nowrap", alignItems: "end" }} onSubmit={(e) => { e.preventDefault(); open(pending, openPw); }}>
              <label style={{ flex: 1, maxWidth: 320 }}>{tx("Wachtwoord van de zip")} <small className="muted">{tx("(of het inlogwachtwoord waarmee de zip is gemaakt)")}</small>
                <input type="password" value={openPw} onChange={(e) => setOpenPw(e.target.value)} autoFocus autoComplete="off" />
              </label>
              <button className="btn primary" disabled={busy || !openPw}>{tx("Openen")}</button>
              <button type="button" className="btn" onClick={() => { setPending(null); setOpenPw(""); }}>{tx("Annuleren")}</button>
            </form>
          )}
          {info && (
            <>
              <small className="muted">{tx("Gemaakt op")} {info.exported_at ? new Date(info.exported_at).toLocaleString() : "?"}{info.secrets_included ? ` · ${tx("bevat API-sleutels")}` : ""}{info.files_included ? ` · ${tx("bevat logo's en afbeeldingen")}` : ""}</small>
              <div className="chips" style={{ margin: 0 }}>
                {PRESETS.filter(([k]) => k !== "all").map(([k, label, keys]) => <button key={k} type="button" className="chip" onClick={() => setLoad(info.known.map((x) => x.key).filter((x) => keys.includes(x)))}>{tx(label)}</button>)}
                <button type="button" className="chip" onClick={() => setLoad(info.known.map((x) => x.key))}>{tx("Alles")}</button>
              </div>
              <div className="bk-grid">{info.known.map((k) => <Check key={k.key} s={{ key: k.key, label: k.label, description: `${Math.max(1, Math.round(k.size / 1024))} KB`, sensitive: false }} list={load} setList={setLoad} />)}</div>
              {info.unknown.length > 0 && <div className="alert">{tx("Niet bekend in dit systeem (wordt overgeslagen)")}: {info.unknown.map((u) => u.label).join(", ")}</div>}
              {info.missing.length > 0 && <small className="muted">{tx("Niet in het bestand (blijft ongewijzigd)")}: {info.missing.join(", ")}</small>}
              <div className="row" style={{ justifyContent: "flex-start" }}>
                <button className="btn primary" disabled={busy || !load.length} onClick={() => setPopup(true)}>{tx("Geselecteerde instellingen laden")}</button>
              </div>
            </>
          )}
          {results && (
            <div className="upq">
              {results.map((r) => <div key={r.key} className={`upq-row ${r.ok ? "ok" : "err"}`}><span className="grow">{tx(r.label)}</span><span className="muted">{r.message}</span></div>)}
              <button className="btn sm" onClick={() => window.location.reload()}>{tx("Pagina verversen")}</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
