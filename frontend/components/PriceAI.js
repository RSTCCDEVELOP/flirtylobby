"use client";

import { useState } from "react";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";

const POS = [["budget", "Goedkoop", "Scherp onder de markt: veel klanten, kleinere winst."], ["market", "Marktconform", "Gelijk aan de concurrenten."], ["premium", "Premium", "Duurder dan de markt, met extra service en kwaliteit."]];

// AI calculation: a few questions (how expensive or good do you want to be), Claude compares with the market and proposes new prices; after approval they go into pricing.json (which goes to every site through git).
export default function PriceAI({ onDone }) {
  const [open, setOpen] = useState(false);
  const [a, setA] = useState({ position: "market", audience: "", margin: 25, notes: "" });
  const [res, setRes] = useState(null);
  const [pick, setPick] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const ask = async () => {
    setBusy(true); setMsg(null);
    try { const r = await api("/system/pricing/ai/", { method: "POST", body: { answers: a } }); setRes(r); setPick(Object.fromEntries(Object.keys(r.values).map((k) => [k, true]))); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  const accept = async () => {
    setBusy(true);
    try { const r = await api("/system/pricing/ai/", { method: "POST", body: { accept: Object.fromEntries(Object.entries(res.values).filter(([k]) => pick[k])) } }); setMsg({ ok: true, text: tx("{0} prijzen aangepast in pricing.json. Neem het bestand mee in git, dan krijgt elke site de nieuwe prijzen.", r.changed) }); setRes(null); onDone && onDone(); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  };
  const close = () => { setOpen(false); setRes(null); setMsg(null); };
  return (
    <>
      <button type="button" className="btn primary" onClick={() => setOpen(true)}>✨ {tx("AI-calculatie")}</button>
      {open && (
        <div className="overlay" onClick={close}>
          <div className="card modal" role="dialog" style={{ maxWidth: 820, maxHeight: "90vh", overflow: "auto", display: "grid", gap: "1.2rem" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: 0 }}>{tx("AI-calculatie")}</h2>
            {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
            {!res ? (
              <>
                <p className="muted" style={{ margin: 0 }}>{tx("Beantwoord een paar vragen. De AI vergelijkt je prijzen met wat concurrenten rekenen (een inschatting uit zijn kennis, geen live zoekactie) en stelt nieuwe prijzen voor. Pas na jouw akkoord worden ze aangepast.")}</p>
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
                <div className="row" style={{ gap: ".6rem" }}><button type="button" className="btn" onClick={close}>{tx("Annuleren")}</button><button type="button" className="btn primary" disabled={busy} onClick={ask}>{busy ? tx("De AI rekent…") : tx("Bereken voorstel")}</button></div>
              </>
            ) : (
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
                      <span className="pe-name"><input type="checkbox" checked={!!pick[k]} onChange={(e) => setPick({ ...pick, [k]: e.target.checked })} style={{ marginRight: ".6rem" }} /><strong>{k}</strong><small className="muted" style={{ display: "block" }}>{res.reasons[k]}</small></span>
                      <span>{res.current[k]}</span>
                      <strong>{v}</strong>
                    </label>
                  ))}
                </div>
                <div className="row" style={{ gap: ".6rem" }}><button type="button" className="btn" onClick={() => setRes(null)}>{tx("Opnieuw")}</button><button type="button" className="btn primary" disabled={busy || !Object.values(pick).some(Boolean)} onClick={accept}>{busy ? tx("Bezig…") : tx("Akkoord: prijzen aanpassen")}</button></div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
