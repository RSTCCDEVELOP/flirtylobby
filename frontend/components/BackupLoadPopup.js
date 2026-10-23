// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useState } from "react";
import { tx } from "../lib/t";
import { api, errorText } from "../lib/api";
import { IconCheck, IconRefresh, IconSliders, IconTrash } from "./Icons";
import Tabs from "./Tabs";

// Popup for loading a settings file. Tabs: 1. Keuze (first question: empty everything first, or overwrite per part),
// 2. Opschonen (progress bar while the parts are emptied), 3. Vullen (progress bar while the parts are installed and filled), 4. Resultaat.
// Every part is its own request, so the bars follow the real work.
const MODES = [
  ["clean", "Eerst alles opschonen", "De gekozen onderdelen worden eerst geleegd (pagina's, teksten, SEO-pagina's, adressen, homepagefoto's) en daarna gevuld met het bestand."],
  ["overwrite", "Per onderdeel overschrijven", "Niets wordt eerst verwijderd: elk gekozen onderdeel wordt overschreven door het bestand."],
  ["add", "Alleen nieuwe items toevoegen", "Wat al bestaat blijft ongewijzigd, alleen wat nog niet bestaat wordt toegevoegd. Onderdelen met alleen instellingen worden overgeslagen."],
];

function Bar({ label, done, total, active }) {
  const pct = total ? Math.round((100 * done) / total) : 0;
  return (
    <div className="progress">
      <div className="progress-top"><span>{label}</span><strong>{active ? `${done}/${total}` : done >= total && total ? tx("Klaar") : "—"}</strong></div>
      <div className="progress-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export default function BackupLoadPopup({ token, keys, labels, onClose, onDone }) {
  const [tab, setTab] = useState("choice");
  const [mode, setMode] = useState("clean");
  const [confirm, setConfirm] = useState(false);
  const [clearing, setClearing] = useState({ done: 0, total: 0 });
  const [filling, setFilling] = useState({ done: 0, total: 0, current: "" });
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const finished = tab === "result";

  const call = (key, phase) => api("/settings-backup/restore/load/", { method: "POST", body: { token, section: key, mode, phase } }); // the server has the parts as temporary files

  const start = async () => {
    setRunning(true); setError(""); setResults([]);
    const all = [];
    try {
      if (mode === "clean") {
        setTab("clear"); setClearing({ done: 0, total: keys.length });
        for (let i = 0; i < keys.length; i++) {
          const r = await call(keys[i], "clear"); all.push(...r.results.filter((x) => !x.ok));
          setClearing({ done: i + 1, total: keys.length });
        }
      }
      setTab("fill"); setFilling({ done: 0, total: keys.length, current: "" });
      const fillResults = [];
      for (let i = 0; i < keys.length; i++) {
        setFilling({ done: i, total: keys.length, current: labels[keys[i]] || keys[i] });
        const r = await call(keys[i], mode === "clean" ? "fill" : undefined); fillResults.push(...r.results);
        setFilling({ done: i + 1, total: keys.length, current: labels[keys[i]] || keys[i] });
      }
      setResults([...all, ...fillResults]);
    } catch (e) { setError(errorText(e)); }
    api("/settings-backup/restore/close/", { method: "POST", body: { token } }).catch(() => {}); // done: the temporary files are removed right away
    setRunning(false); setTab("result"); onDone?.();
  };

  const modeInfo = MODES.find((m) => m[0] === mode);
  const steps = [["choice", "Keuze", <IconSliders key="c" />], ["clear", "Opschonen", <IconTrash key="o" />], ["fill", "Vullen", <IconRefresh key="v" />], ["result", "Resultaat", <IconCheck key="r" />]];
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-live="polite" style={{ zIndex: 3500 }} onClick={() => !running && onClose()}>
      <div className="card modal form" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: 0 }}>{tx("Restore")}</h2>
        <Tabs value={tab} onChange={() => {}} tabs={steps.filter(([k]) => k !== "clear" || mode === "clean")} />

        {tab === "choice" && (
          <>
            <p style={{ margin: 0 }}><strong>{tx("Hoe wil je laden?")}</strong> <span className="muted">{tx("{0} onderdelen gekozen.", keys.length)}</span></p>
            {MODES.map(([k, label, hint]) => (
              <label key={k} className="check">
                <input type="radio" name="backup-mode" checked={mode === k} onChange={() => { setMode(k); setConfirm(false); }} />
                <span><strong>{tx(label)}</strong><br /><small className="muted">{tx(hint)}</small></span>
              </label>
            ))}
            {mode === "clean" && (
              <label className="check"><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /><span>{tx("Ik begrijp dat het leegmaken niet ongedaan kan worden gemaakt.")}</span></label>
            )}
            <div className="row">
              <button type="button" className="btn" onClick={onClose}>{tx("Annuleren")}</button>
              <button type="button" className={`btn ${mode === "clean" ? "danger" : "primary"}`} disabled={mode === "clean" && !confirm} onClick={start}>{tx(modeInfo[1])}</button>
            </div>
          </>
        )}

        {(tab === "clear" || tab === "fill") && (
          <>
            {mode === "clean" && <Bar label={tx("Verwijderen")} done={clearing.done} total={clearing.total} active={tab === "clear" || clearing.done > 0} />}
            <Bar label={tx("Opnieuw installeren en vullen")} done={filling.done} total={filling.total} active={tab === "fill"} />
            <p className="muted" style={{ margin: 0 }}>{tab === "clear" ? tx("Onderdelen worden geleegd…") : filling.current ? `${tx("Bezig met")}: ${tx(filling.current)}` : tx("Bezig…")}</p>
          </>
        )}

        {tab === "result" && (
          <>
            {error && <div className="alert">{error}</div>}
            {!error && <div className={results.every((x) => x.ok) ? "alert ok" : "alert"}>{results.every((x) => x.ok) ? tx("Klaar. Ververs de pagina om alles te zien.") : tx("Klaar, maar niet alles lukte.")}</div>}
            <div className="upq" style={{ maxHeight: 280, overflow: "auto" }}>
              {results.map((r, i) => <div key={`${r.key}${i}`} className={`upq-row ${r.ok ? "ok" : "err"}`}><span className="grow">{tx(r.label)}</span><span className="muted">{r.message}</span></div>)}
            </div>
            <div className="row">
              <button type="button" className="btn" onClick={onClose}>{tx("Sluiten")}</button>
              <button type="button" className="btn primary" onClick={() => window.location.reload()}>{tx("Pagina verversen")}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
