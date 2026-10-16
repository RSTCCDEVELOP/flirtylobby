"use client";

import { tx } from "../lib/t";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorText } from "../lib/api";
import { confirmDialog } from "../lib/dialog";
import { IconFolder, IconSliders } from "./Icons";
import Tabs from "./Tabs";

// Super admin: export all settings to one file (complete backup) and load such a file again.
// The list of parts comes from the server, so new applications show up here by themselves and removed ones disappear.
// Ready-made selections: a theme package (look), theme + screens, or the settings without the look. Parts that do not exist are ignored.
const PRESETS = [
  ["all", "Alles", null, "Complete back-up van het hele systeem."],
  ["theme", "Thema & huisstijl", ["branding", "theme"], "Kleuren, lettertypen, popups, tabbladen en logo's."],
  ["screens", "Thema + schermen", ["branding", "media_files", "theme", "community", "pages", "content", "seo", "dashboard"], "Het thema plus pagina's, menu, teksten, SEO, profielthema en dashboard: om een nieuwe site in dezelfde stijl te starten."],
  ["settings", "Instellingen zonder thema", ["security", "modules", "languages", "communication", "integrations", "sandbox"], "Beveiliging, modules, talen, communicatie, koppelingen en sandbox."],
];

export default function SettingsBackup() {
  const [tab, setTab] = useState("export");
  const [sections, setSections] = useState([]);
  const [pick, setPick] = useState([]);
  const [secrets, setSecrets] = useState(false);
  const [files, setFiles] = useState(true); // logos and pictures inside the file
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [bundle, setBundle] = useState(null); // file chosen for loading
  const [info, setInfo] = useState(null); // inspect result
  const [load, setLoad] = useState([]); // parts to load
  const [results, setResults] = useState(null);
  const [over, setOver] = useState(false);
  const file = useRef(null);

  useEffect(() => { api("/settings-backup/sections/").then((d) => { setSections(d.sections); setPick(d.sections.map((s) => s.key)); }).catch((e) => setMsg({ ok: false, text: errorText(e) })); }, []);

  const exportNow = async () => {
    setBusy(true); setMsg(null);
    try {
      const b = await api("/settings-backup/export/", { method: "POST", body: { sections: pick, include_secrets: secrets, include_files: files } });
      const blob = new Blob([JSON.stringify(b, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      const d = new Date(), p = (n) => String(n).padStart(2, "0");
      a.href = URL.createObjectURL(blob);
      a.download = `flirtylobby-instellingen-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      const failed = Object.keys(b.errors || {});
      setMsg({ ok: !failed.length, text: failed.length ? tx("Back-up gemaakt, maar niet alles lukte: {0}", failed.join(", ")) : tx("Back-up gedownload ({0} onderdelen).", Object.keys(b.sections).length) });
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };

  const choose = useCallback(async (f) => {
    setMsg(null); setResults(null); setInfo(null); setBundle(null);
    if (!f) return;
    try {
      const parsed = JSON.parse(await f.text());
      const i = await api("/settings-backup/inspect/", { method: "POST", body: { bundle: parsed } });
      setBundle(parsed); setInfo(i); setLoad(i.known.map((k) => k.key));
    } catch (e) { setMsg({ ok: false, text: e instanceof SyntaxError ? tx("Dit bestand is geen geldig instellingenbestand.") : errorText(e) }); }
  }, []);

  const loadNow = async () => {
    if (!(await confirmDialog(tx("{0} onderdelen laden? De huidige instellingen van die onderdelen worden vervangen.", load.length), { danger: true, title: tx("Instellingen laden"), okLabel: tx("Laden") }))) return;
    setBusy(true); setMsg(null);
    try {
      const r = await api("/settings-backup/load/", { method: "POST", body: { bundle, sections: load } });
      setResults(r.results);
      setMsg({ ok: r.results.every((x) => x.ok), text: tx("Klaar. Ververs de pagina om alles te zien.") });
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };

  const toggle = (list, setList, k) => setList(list.includes(k) ? list.filter((x) => x !== k) : [...list, k]);
  const Check = ({ s, list, setList }) => (
    <label key={s.key} className="check bk-item"><input type="checkbox" checked={list.includes(s.key)} onChange={() => toggle(list, setList, s.key)} />
      <span><strong>{tx(s.label)}</strong>{s.sensitive && <span className="badge" style={{ marginLeft: ".4rem" }}>{tx("gevoelig")}</span>}<br /><small className="muted">{tx(s.description)}</small></span></label>
  );

  return (
    <div className="form">
      <Tabs value={tab} onChange={setTab} tabs={[["export", "Exporteren", <IconFolder key="e" />], ["load", "Laden", <IconSliders key="l" />]]} />
      {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}

      {tab === "export" && (
        <>
          <p className="muted" style={{ margin: 0 }}>{tx("Een complete back-up van alle instellingen in één bestand: vormgeving, beveiliging, modules, talen, pagina's, community, SEO en meer. Gebruikers, bestellingen en bestanden zitten er niet in.")}</p>
          <div className="chips" style={{ margin: 0 }}>
            {PRESETS.map(([k, label, keys, hint]) => <button key={k} type="button" className="chip" title={tx(hint)} onClick={() => setPick(keys ? sections.map((s) => s.key).filter((x) => keys.includes(x)) : sections.map((s) => s.key))}>{tx(label)}</button>)}
          </div>
          <div className="bk-grid">{sections.map((s) => <Check key={s.key} s={s} list={pick} setList={setPick} />)}</div>
          <label className="check sec-toggle">
            <span className="switch"><input type="checkbox" checked={files} onChange={(e) => setFiles(e.target.checked)} /><span /></span>
            <span>{tx("Logo's en afbeeldingen meenemen")} <small className="muted">{tx("De bestanden zelf gaan in de back-up, zodat een nieuwe site er meteen hetzelfde uitziet. Het bestand wordt dan groter.")}</small></span>
          </label>
          <label className="check sec-toggle">
            <span className="switch"><input type="checkbox" checked={secrets} onChange={(e) => setSecrets(e.target.checked)} /><span /></span>
            <span>{tx("API-sleutels meenemen")} <small className="muted">{tx("Alleen aanzetten voor een eigen, veilig bewaarde back-up: iedereen met het bestand kan de sleutels lezen.")}</small></span>
          </label>
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
            <span>{tx("Sleep het instellingenbestand (.json) hierheen of klik om te kiezen")}</span>
            <input ref={file} type="file" accept=".json,application/json" hidden onChange={(e) => { choose(e.target.files[0]); e.target.value = ""; }} />
          </div>
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
                <button className="btn primary" disabled={busy || !load.length} onClick={loadNow}>{busy ? tx("Bezig…") : tx("Geselecteerde instellingen laden")}</button>
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
