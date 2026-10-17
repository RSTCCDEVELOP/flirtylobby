"use client";

import { tx } from "../lib/t";
import { useEffect, useState } from "react";
import { api, errorText } from "../lib/api";
import { money } from "../lib/format";
import { useSession } from "./Session";

function Campaign({ c, currency, user }) {
  const [amount, setAmount] = useState(Number(c.default));
  const [f, setF] = useState({ name: "", email: "", message: "", anonymous: false });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const pct = c.goal ? Math.min(100, (Number(c.raised) / Number(c.goal)) * 100) : 0;
  const gives = c.grants.length > 0 && amount >= Number(c.min_for_grants);

  async function give(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const r = await api("/donations/donate/", { method: "POST", body: { campaign: c.id, amount, ...f, return_base: window.location.origin } });
      if (r.checkout_path) { window.location.href = r.checkout_path; return; }
      setMsg({ ok: true, text: tx("Bedankt voor je donatie!") });
    } catch (err) { setMsg({ ok: false, text: errorText(err) }); }
    setBusy(false);
  }

  return (
    <form className="card don-card" onSubmit={give}>
      <h2>{c.name}</h2>
      <p className="muted" style={{ margin: 0 }}>{tx("Voor")} {c.recipient}{c.description ? ` · ${c.description}` : ""}</p>
      {c.goal && <><div className="don-bar"><i style={{ width: `${pct}%` }} /></div><small className="muted">{money(c.raised, currency)} {tx("van")} {money(c.goal, currency)} · {c.count} {tx("donaties")}</small></>}
      <div className="don-amount">{money(amount, currency)}</div>
      <input type="range" className="don-slider" min={Number(c.min)} max={Number(c.max)} step={Number(c.step)} value={amount} onChange={(e) => setAmount(Number(e.target.value))} aria-label={tx("Bedrag")} />
      <div className="don-range"><span>{money(c.min, currency)}</span><span>{money(c.max, currency)}</span></div>
      {c.grants.length > 0 && <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>{gives ? "🎁 " : ""}{tx("Als dank krijg je")} {c.grant_days} {tx("dagen")}: {c.grants.map((g) => tx(g.label)).join(", ")}{Number(c.min_for_grants) > 0 ? ` (${tx("vanaf")} ${money(c.min_for_grants, currency)})` : ""}{!user && ` — ${tx("log in om dit te ontvangen")}`}</p>}
      {!user && (
        <div className="grid2">
          <label>{tx("Naam")}<input value={f.name} maxLength={120} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label>{tx("E-mail")}<input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        </div>
      )}
      {c.allow_message && <label>{tx("Bericht (optioneel)")}<input value={f.message} maxLength={300} onChange={(e) => setF({ ...f, message: e.target.value })} /></label>}
      {c.allow_anonymous && <label className="check"><input type="checkbox" checked={f.anonymous} onChange={(e) => setF({ ...f, anonymous: e.target.checked })} /> {tx("Mijn naam niet tonen")}</label>}
      {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
      <button className="btn primary" disabled={busy}>{busy ? tx("Bezig…") : `${tx("Doneer")} ${money(amount, currency)}`}</button>
      {c.recent?.length > 0 && (
        <div className="don-recent">
          <strong style={{ fontSize: ".85rem" }}>{tx("Recente donaties")}</strong>
          {c.recent.map((r, i) => <div key={i}><span><strong>{r.name}</strong> {money(r.amount, currency)}</span>{r.message && <em className="muted"> “{r.message}”</em>}</div>)}
        </div>
      )}
    </form>
  );
}

// Public donation page: pick an amount on the slider (between the minimum and maximum the admin set).
export default function Donate() {
  const { user, ready } = useSession();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { if (ready) api("/donations/campaigns/").then(setData).catch((e) => setErr(errorText(e))); }, [ready]);
  if (!data) return <p className="muted">{err || tx("Laden…")}</p>;
  const thanks = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("bedankt");
  return (
    <div className="don-grid">
      {thanks && <div className="alert ok" style={{ gridColumn: "1 / -1" }}>{tx("Bedankt voor je donatie!")}</div>}
      {data.campaigns.map((c) => <Campaign key={c.id} c={c} currency={data.currency} user={user} />)}
      {!data.campaigns.length && <p className="muted">{tx("Er zijn nu geen donatie-acties.")}</p>}
    </div>
  );
}
