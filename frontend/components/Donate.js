"use client";

import { tx } from "../lib/t";
import { RichText } from "./SmallEditor";
import { useEffect, useState } from "react";
import { api, errorText, mediaUrl } from "../lib/api";
import { money } from "../lib/format";
import { placeStyle } from "./ImagePlace";
import { useSession } from "./Session";

export function Campaign({ c, currency, user, onClose }) {
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
      const r = await api("/donations/donate/", { method: "POST", body: { campaign: c.id, amount, ...f, return_base: window.location.origin, return_path: window.location.pathname } });
      if (r.checkout_path) { window.location.href = r.checkout_path; return; }
      setMsg({ ok: true, text: tx("Bedankt voor je donatie!") });
    } catch (err) { setMsg({ ok: false, text: errorText(err) }); }
    setBusy(false);
  }

  return (
    <form className="card don-card" onSubmit={give}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: ".6rem" }}><h2>{c.name}</h2>{onClose && <button type="button" className="btn sm" onClick={onClose}>{tx("Sluiten")}</button>}</div>
      {c.infoView && (c.infoView.image || c.infoView.title || c.infoView.text) && (
        <div className="don-info">
          {c.infoView.image && <img src={mediaUrl(c.infoView.image)} alt="" style={placeStyle(c.infoView.placement)} />}
          {c.infoView.title && <strong>{c.infoView.title}</strong>}
          {c.infoView.text && <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{c.infoView.text}</p>}
        </div>
      )}
      <div className="muted"><p style={{ margin: 0 }}>{tx("Voor")} {c.recipient}</p>{c.description && <RichText value={c.description} />}</div>
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

// the texts of an action in the visitor's language (falls back to the default text): name, description, "for whom", info popup and thank-you popup
export function localised(c) {
  let lang = "nl";
  try { lang = localStorage.getItem("lang") || "nl"; } catch {}
  const view = (p) => ({ title: p?.titles?.[lang] || p?.titles?.nl || Object.values(p?.titles || {})[0] || "", text: p?.texts?.[lang] || p?.texts?.nl || Object.values(p?.texts || {})[0] || "", image: p?.image || null, placement: p?.placement || "center:full" });
  return { ...c, name: c.names?.[lang] || c.names?.nl || c.name, description: c.descriptions?.[lang] ?? c.descriptions?.nl ?? c.description, recipient: c.recipients?.[lang] || c.recipients?.nl || c.recipient,
           infoView: view(c.info), thanksView: view(c.thanks) };
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
      {thanks && <div className="alert ok" data-nopage style={{ gridColumn: "1 / -1" }}>{tx("Bedankt voor je donatie!")}</div>}
      {data.campaigns.map((c) => <Campaign key={c.id} c={localised(c)} currency={data.currency} user={user} />)}
      {!data.campaigns.length && <p className="muted">{tx("Er zijn nu geen donatie-acties.")}</p>}
    </div>
  );
}
