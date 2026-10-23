"use client";

import ProgressBar from "./ProgressBar";
import Tabs from "./Tabs";
import { useEffect, useState } from "react";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";
import { IconBolt, IconCheck, IconRefresh } from "./Icons";

const POS = [["budget", "Goedkoop", "Scherp onder de markt: veel klanten, kleinere winst."], ["market", "Marktconform", "Gelijk aan de concurrenten."], ["premium", "Premium", "Duurder dan de markt, met extra service en kwaliteit."]];

// AI calculation: a few questions (how expensive or good do you want to be), Claude compares with the market and proposes new prices; after approval they go into pricing.json (which goes to every site through git).
export default function PriceAI({ onDone }) {
  const [open, setOpen] = useState(false);
  const [a, setA] = useState({ position: "market", audience: "", margin: 25, notes: "" });
  const [res, setRes] = useState(null);
  const [pick, setPick] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [ptab, setPtab] = useState("settings");
  const [choose, setChoose] = useState(false); // ask: go on where it stopped, or start again
  const [steps, setSteps] = useState([]); // what the AI is doing: [{t, at}]
  const [now, setNow] = useState(Date.now() / 1000);
  const [last, setLast] = useState(null); // the last calculation: {exists, done, total, finished, at}
  const loadLast = () => api("/system/pricing/ai/?last=1").then(setLast).catch(() => {});
  useEffect(() => { if (open) loadLast(); }, [open]);
  const ask = async (resume = false) => {
    setBusy(true); setMsg(null); setSteps([]); setRes(null); setPtab("calc");
    try {
      const { job } = await api("/system/pricing/ai/", { method: "POST", body: { start: true, resume, answers: a } });
      for (;;) {
        await new Promise((r) => setTimeout(r, 1200));
        const st = await api(`/system/pricing/ai/?job=${job}`);
        setSteps(st.steps || []); setNow(st.now);
        const r = st.result || st.partial; // every price shows up as soon as it is ready
        if (r) { setRes(r); setPick((p) => ({ ...Object.fromEntries(Object.keys(r.values).map((k) => [k, true])), ...p })); }
        if (st.done) { if (st.error) throw new Error(st.error); setPtab("result"); break; }
      }
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false); loadLast();
  };
  useEffect(() => { if (!busy) return undefined; const t = setInterval(() => setNow((n) => n + 1), 1000); return () => clearInterval(t); }, [busy]);
  const accept = async () => {
    setBusy(true);
    try { const r = await api("/system/pricing/ai/", { method: "POST", body: { accept: Object.fromEntries(Object.entries(res.values).filter(([k]) => pick[k])) } }); setMsg({ ok: true, text: tx("{0} prijzen aangepast in pricing.json. Neem het bestand mee in git, dan krijgt elke site de nieuwe prijzen.", r.changed) }); setRes(null); onDone && onDone(); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  const close = () => { setOpen(false); setRes(null); setMsg(null); setPtab("settings"); };
  return (
    <>
      <button type="button" className="btn primary" onClick={() => setOpen(true)}><IconBolt /> {tx("AI-calculatie")}</button>
      {open && (
        <div className="overlay" onClick={close}>
          <div className="card modal" role="dialog" style={{ maxWidth: 820, maxHeight: "90vh", overflow: "auto", display: "grid", gap: "1.2rem" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: 0 }}>{tx("AI-calculatie")}</h2>
            {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
            <Tabs value={ptab} onChange={setPtab} tabs={[["settings", "Instellingen"], ["calc", "Berekenen"], ["result", "Resultaat", null, res ? Object.keys(res.values).length : 0]]} />
            {ptab === "settings" && (
              <>
                {choose && last?.exists && (
                  <div className="alert ok" style={{ display: "grid", gap: ".6rem" }}>
                    <strong>{tx("Er is al een berekening bezig geweest")}</strong>
                    <span>{tx("{0} van {1} prijzen zijn klaar ({2}). Verder gaan waar je gebleven was, of alles opnieuw?", last.done, last.total, last.at)}</span>
                    <div className="row" style={{ gap: ".6rem" }}>
                      <button type="button" className="btn primary" onClick={() => { setChoose(false); ask(true); }}>{tx("Verder gaan waar gebleven")}</button>
                      <button type="button" className="btn" onClick={() => { setChoose(false); ask(false); }}>{tx("Alles opnieuw")}</button>
                    </div>
                  </div>
                )}
                <p className="muted" style={{ margin: 0 }}>{tx("Beantwoord een paar vragen. De AI zoekt op het internet naar marktconforme prijzen van concurrenten voor hosting, e-mail, modules en plugins (dit kan een minuut duren) en stelt nieuwe prijzen voor. Pas na jouw akkoord worden ze aangepast.")}</p>
                <div className="wz-grid">
                  {POS.map(([k, l, d]) => (
                    <label key={k} className={`wz-q${a.position === k ? " on" : ""}`}>
                      <input type="radio" name="pos" checked={a.position === k} onChange={() => setA({ ...a, position: k })} style={{ marginTop: ".3rem" }} />
                      <span className="wz-text"><strong>{tx(l)}</strong><small className="muted">{tx(d)}</small></span>
                    </label>
                  ))}
                </div>
                <label style={{ display: "grid", gap: ".5rem" }}>{tx("Voor wie? (doelgroep)")}<input value={a.audience} onChange={(e) => setA({ ...a, audience: e.target.value })} placeholder={tx("bijvoorbeeld zzp'ers en kleine winkels")} /></label>
                <label style={{ display: "grid", gap: ".5rem" }}>{tx("Minimale winstmarge op hosting en inkoop (%)")}<input type="number" min="0" max="90" value={a.margin} onChange={(e) => setA({ ...a, margin: e.target.value })} /></label>
                <label style={{ display: "grid", gap: ".5rem" }}>{tx("Opmerkingen (optioneel)")}<textarea rows="3" value={a.notes} onChange={(e) => setA({ ...a, notes: e.target.value })} /></label>
                <div className="row" style={{ gap: ".6rem" }}><button type="button" className="btn" onClick={close}>{tx("Annuleren")}</button><button type="button" className="btn primary" disabled={busy} onClick={() => { if (last?.exists && !last.finished) setChoose(true); else ask(false); }}>{busy ? tx("De AI rekent…") : tx("Bereken voorstel")}</button></div>
              </>
            )}
            {ptab === "calc" && (
              <>
                {!res && !busy && steps.length === 0 && <p className="muted" style={{ margin: 0 }}>{tx("Er is nog niets berekend. Kies bij Instellingen je uitgangspunten en druk op Berekenen.")}</p>}
                {busy && <div className="row" style={{ alignItems: "center", gap: ".7rem" }}><span className="spin" style={{ display: "inline-flex", width: 28, height: 28 }}><IconRefresh /></span><strong>{steps.length ? steps[steps.length - 1].t : tx("Starten…")}</strong></div>}
                {(busy || steps.length > 0) && (
                  <div style={{ display: "grid", gap: ".35rem", border: "1px solid var(--line)", borderRadius: 12, padding: ".8rem 1rem" }}>
                    <strong>{tx("Voortgang")}</strong>
                    {steps.length === 0 && <span className="muted">{tx("Starten…")}</span>}
                    <div style={{ display: "grid", gap: ".35rem", maxHeight: 230, overflowY: "auto" }}>
                    {steps.map((st, i) => ({ st, i })).reverse().map(({ st, i }) => {
                      const isLast = i === steps.length - 1, running = busy && isLast;
                      const secs = Math.max(0, Math.round(((isLast ? now : steps[i + 1].at) - st.at)));
                      return (
                        <div key={i} style={{ display: "flex", gap: ".6rem", alignItems: "baseline", opacity: running ? 1 : 0.75 }}>
                          <span className={running ? "spin" : ""} style={{ width: "1.1rem", display: "inline-flex" }}>{running ? <IconRefresh /> : <IconCheck />}</span>
                          <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{st.t}</span>
                          <small className="muted" style={{ whiteSpace: "nowrap" }}>{secs} {tx("sec")}</small>
                        </div>
                      );
                    })}
                    </div>
                  </div>
                )}
              </>
            )}
            {ptab === "result" && (
              <>
                {!res && <p className="muted" style={{ margin: 0 }}>{tx("Nog geen voorstel. Start een berekening bij Instellingen.")}</p>}
                {res && (
              <>
                {res.summary && <p style={{ margin: 0 }}>{res.summary}</p>}
                {res.market.length > 0 && (
                  <div><strong>{tx("Markt (inschatting)")}</strong>
                    <ul className="ct-list">{res.market.map((m, i) => <li key={i}><strong>{m.name}</strong> {m.price}<small className="muted">{m.note}</small></li>)}</ul></div>
                )}
                <div className="pe-table" style={{ border: "1px solid var(--line)", borderRadius: 12 }}>
                  <div className="pe-row head"><strong>{tx("Voorstel")}</strong><span>{tx("Nu")}</span><span>{tx("Nieuw")}</span></div>
                  {Object.keys(res.values).length === 0 && <div className="pe-row"><span className="muted">{tx("De AI stelt geen wijzigingen voor: de prijzen passen bij je keuze.")}</span></div>}
                  {Object.entries(res.values).map(([k, v]) => (
                    <label key={k} className="pe-row">
                      <span className="pe-name"><input type="checkbox" checked={!!pick[k]} onChange={(e) => setPick({ ...pick, [k]: e.target.checked })} style={{ marginRight: ".6rem" }} /><strong>{res.labels?.[k] ? `${res.labels[k]} (${k.split(":")[0]})` : k}</strong><small className="muted" style={{ display: "block" }}>{res.reasons[k]}</small></span>
                      <span>{res.current[k]}</span>
                      <strong>{v}</strong>
                    </label>
                  ))}
                </div>
                <div className="row" style={{ gap: ".6rem" }}><button type="button" className="btn" onClick={() => { setRes(null); setSteps([]); setPtab("settings"); }}>{tx("Opnieuw")}</button><button type="button" className="btn primary" disabled={busy || !Object.values(pick).some(Boolean)} onClick={accept}>{busy ? tx("Bezig…") : tx("Akkoord: prijzen aanpassen")}</button></div>
                <ProgressBar running={busy} label={tx("De prijzen worden aangepast…")} />
              </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
