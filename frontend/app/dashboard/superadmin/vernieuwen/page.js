"use client";

import { useEffect, useState } from "react";
import { api, errorText } from "../../../../lib/api";
import { tx } from "../../../../lib/t";

// How often the pages ask the server for news. Two settings of the site: the general refresh rate, and the call signals (/api/chat/signals/).
export default function RefreshSettings() {
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api("/system/").then((d) => setForm({ refresh_seconds: Number(d.settings.refresh_seconds) || 0, signal_seconds: Number(d.settings.signal_seconds) || 0 })).catch((e) => setMsg({ ok: false, text: errorText(e) })); }, []);
  if (!form) return msg ? <div className="alert">{msg.text}</div> : null;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      const d = await api("/system/", { method: "PUT", body: { refresh_seconds: Number(form.refresh_seconds) || 0, signal_seconds: Number(form.signal_seconds) || 0 } });
      setForm({ refresh_seconds: Number(d.settings.refresh_seconds) || 0, signal_seconds: Number(d.settings.signal_seconds) || 0 });
      setMsg({ ok: true, text: tx("Opgeslagen. De pagina's gebruiken de nieuwe waarden bij de volgende keer laden.") });
    } catch (err) { setMsg({ ok: false, text: errorText(err) }); }
    setBusy(false);
  };
  return (
    <>
      <h1>{tx("Vernieuwen")}</h1>
      <p className="muted">{tx("Hoe vaak de pagina's bij de server vragen of er nieuws is. Korter is actueler, maar belast de server meer.")}</p>
      {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
      <form className="card stack" style={{ maxWidth: 560, gap: "1rem" }} onSubmit={save}>
        <label>{tx("Vernieuwsnelheid (seconden)")}<input type="number" min="0" max="600" value={form.refresh_seconds} onChange={set("refresh_seconds")} /></label>
        <small className="muted">{tx("Berichten, meldingen, verzoeken en de lijsten van chat en directe verbinding. 0 = elk onderdeel op zijn eigen tempo; anders minimaal 2 seconden. Meldingen zelf komen via een WebSocket binnen.")}</small>
        <label>{tx("Oproepsignalen (seconden)")}<input type="number" min="0" max="30" value={form.signal_seconds} onChange={set("signal_seconds")} /></label>
        <small className="muted">{tx("Hoe vaak de browser vraagt of iemand belt of chat start (/api/chat/signals/). 0 = elke 1,5 seconde. Een hogere waarde (1 tot 30) geeft minder verzoeken, maar een oproep komt later binnen.")}</small>
        <div><button className="btn primary" disabled={busy}>{busy ? tx("Bezig…") : tx("Opslaan")}</button></div>
      </form>
    </>
  );
}
