"use client";

import { tx } from "../../../../lib/t";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import GrantsEditor from "../../../../components/GrantsEditor";
import Tabs from "../../../../components/Tabs";
import { api, errorText } from "../../../../lib/api";
import { confirmDialog } from "../../../../lib/dialog";
import { money } from "../../../../lib/format";
import { lvl } from "../../../../lib/perms";

const blank = { name: "", description: "", recipient: "", min_amount: "2", max_amount: "100", step: "1", default_amount: "10", goal: "", allow_message: true, allow_anonymous: true, grants: [], grant_days: 30, min_for_grants: "0", active: true, order: 0 };

export default function DonationsAdmin() {
  const { user } = useAuth();
  const L = lvl(user, "donations");
  const [tab, setTab] = useState("campaigns");
  const [camps, setCamps] = useState([]);
  const [rec, setRec] = useState(null);
  const [opts, setOpts] = useState(null);
  const [modal, setModal] = useState(null);
  const [msg, setMsg] = useState(null);
  const [filter, setFilter] = useState({ campaign: "", status: "" });

  const loadCamps = useCallback(() => api("/subscriptions/admin/campaigns/").then(setCamps).catch((e) => setMsg({ ok: false, text: errorText(e) })), []);
  const loadRec = useCallback(() => api(`/subscriptions/admin/donations/?campaign=${filter.campaign}&status=${filter.status}`).then(setRec).catch((e) => setMsg({ ok: false, text: errorText(e) })), [filter]);
  useEffect(() => { loadCamps(); api("/subscriptions/admin/options/").then(setOpts).catch((e) => setMsg({ ok: false, text: errorText(e) })); }, [loadCamps]);
  useEffect(() => { loadRec(); }, [loadRec]);

  async function save(e) {
    e.preventDefault();
    const { id, error: _e, grants_text, raised, count, slug, ...body } = modal;
    body.goal = body.goal === "" || body.goal === null ? null : body.goal;
    body.recipient_user = body.recipient_user || null;
    try {
      await (id ? api(`/subscriptions/admin/campaigns/${id}/`, { method: "PATCH", body }) : api("/subscriptions/admin/campaigns/", { method: "POST", body }));
      setModal(null); loadCamps();
    } catch (err) { setModal({ ...modal, error: errorText(err) }); }
  }
  const remove = async (c) => { if (await confirmDialog(tx("Actie \"{0}\" verwijderen?", c.name), { danger: true })) { try { await api(`/subscriptions/admin/campaigns/${c.id}/`, { method: "DELETE" }); loadCamps(); } catch (e) { setMsg({ ok: false, text: errorText(e) }); } } };
  const toggle = async (c) => { await api(`/subscriptions/admin/campaigns/${c.id}/`, { method: "PATCH", body: { active: !c.active } }); loadCamps(); };

  if (!opts) return msg ? <div className="alert">{msg.text}</div> : <p className="muted">{tx("Laden…")}</p>;  // an error is shown instead of waiting forever
  const cur = opts.currency || "EUR";
  const set = (k) => (e) => setModal({ ...modal, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{tx("Donaties")}</h1>
          <p className="muted" style={{ margin: 0 }}>{tx("Een donatie is een eenmalige gift aan de makers. Bezoekers kiezen het bedrag met een schuifbalk tussen jouw minimum en maximum.")}</p>
        </div>
        {L >= 3 && tab === "campaigns" && <button className="btn primary" onClick={() => setModal({ ...blank })}>{tx("+ Nieuwe actie")}</button>}
      </div>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}
      {rec && <div className="sub-stats"><div className="card"><span className="muted">{tx("Totaal ontvangen")}</span><strong>{money(rec.total, cur)}</strong></div><div className="card"><span className="muted">{tx("Aantal donaties")}</span><strong>{rec.count}</strong></div></div>}
      <Tabs value={tab} onChange={setTab} tabs={[["campaigns", "Acties", null, camps.length], ["received", "Ontvangen"]]} />

      {tab === "campaigns" && (
        <div className="sub-plans">
          {camps.map((c) => (
            <div className={`card sub-plan${c.active ? "" : " off"}`} key={c.id}>
              <div className="sub-plan-top"><strong>{c.name}</strong>{!c.active && <span className="badge off">{tx("Gesloten")}</span>}</div>
              <div className="sub-price">{money(c.min_amount, cur)} – {money(c.max_amount, cur)}</div>
              <div className="muted" style={{ fontSize: ".82rem" }}>{tx("Voor")} {c.recipient || tx("de makers")} · {tx("stap")} {money(c.step, cur)}</div>
              <div><strong>{money(c.raised, cur)}</strong> <span className="muted">{tx("ontvangen")} ({c.count}){c.goal ? ` · ${tx("doel")} ${money(c.goal, cur)}` : ""}</span></div>
              {c.goal && <div className="don-bar"><i style={{ width: `${Math.min(100, (Number(c.raised) / Number(c.goal)) * 100)}%` }} /></div>}
              {c.grants_text.length > 0 && <ul className="sub-grants">{c.grants_text.map((g, i) => <li key={i}>{tx(g.label)}</li>)}</ul>}
              {L >= 2 && (
                <div className="sub-actions">
                  <button className="btn sm" onClick={() => setModal({ ...c, goal: c.goal ?? "" })}>{tx("Wijzig")}</button>
                  <button className="btn sm" onClick={() => toggle(c)}>{c.active ? tx("Sluiten") : tx("Heropenen")}</button>
                  {L >= 3 && <button className="btn sm danger" onClick={() => remove(c)}>{tx("Verwijder")}</button>}
                </div>
              )}
            </div>
          ))}
          {!camps.length && <p className="muted">{tx("Nog geen acties. Maak je eerste donatie-actie.")}</p>}
        </div>
      )}

      {tab === "received" && rec && (
        <div className="card">
          <div className="sub-filter">
            <select value={filter.campaign} onChange={(e) => setFilter({ ...filter, campaign: e.target.value })}>
              <option value="">{tx("Alle acties")}</option>{camps.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
              <option value="">{tx("Alle statussen")}</option><option value="paid">{tx("Betaald")}</option><option value="pending">{tx("Wacht op betaling")}</option><option value="failed">{tx("Mislukt")}</option>
            </select>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>{tx("Datum")}</th><th>{tx("Actie")}</th><th>{tx("Van")}</th><th>{tx("Bedrag")}</th><th>{tx("Status")}</th><th>{tx("Bericht")}</th></tr></thead>
              <tbody>
                {rec.items.map((d) => (
                  <tr key={d.id}>
                    <td>{new Date(d.created_at).toLocaleDateString()}</td><td>{d.campaign}</td>
                    <td>{d.name}{d.anonymous && <small className="muted"> ({tx("anoniem getoond")})</small>}<br /><small className="muted">{d.email}</small></td>
                    <td><strong>{money(d.amount, cur)}</strong></td><td><span className={`badge ${d.status === "paid" ? "ok" : "off"}`}>{tx(d.status_label)}</span></td><td>{d.message}</td>
                  </tr>
                ))}
                {!rec.items.length && <tr><td colSpan={6} className="muted">{tx("Nog geen donaties.")}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <div className="overlay" onClick={() => setModal(null)}>
          <form className="card modal form int-modal" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h2>{modal.id ? tx("Actie wijzigen") : tx("Nieuwe donatie-actie")}</h2>
            <div className="form-grid">
              <label>{tx("Naam")}<input value={modal.name} onChange={set("name")} required maxLength={120} /></label>
              <label>{tx("Voor wie (bv. de makers)")}<input value={modal.recipient} onChange={set("recipient")} maxLength={120} placeholder={tx("de makers")} /></label>
              <label>{tx("Doelbedrag (optioneel)")}<input type="number" min="0" step="0.01" value={modal.goal} onChange={set("goal")} /></label>
              <label>{tx("Minimum bedrag")}<input type="number" min="0.01" step="0.01" value={modal.min_amount} onChange={set("min_amount")} required /></label>
              <label>{tx("Maximum bedrag")}<input type="number" min="0.01" step="0.01" value={modal.max_amount} onChange={set("max_amount")} required /></label>
              <label>{tx("Stap van de schuifbalk")}<input type="number" min="0.01" step="0.01" value={modal.step} onChange={set("step")} required /></label>
              <label>{tx("Standaardbedrag")}<input type="number" min="0.01" step="0.01" value={modal.default_amount} onChange={set("default_amount")} required /></label>
              <label>{tx("Volgorde")}<input type="number" min="0" value={modal.order} onChange={set("order")} /></label>
            </div>
            <label>{tx("Omschrijving")}<textarea rows={2} value={modal.description} onChange={set("description")} /></label>
            <div className="row-checks">
              <label className="check"><input type="checkbox" checked={modal.allow_message} onChange={set("allow_message")} /> {tx("Bericht toestaan")}</label>
              <label className="check"><input type="checkbox" checked={modal.allow_anonymous} onChange={set("allow_anonymous")} /> {tx("Anoniem tonen toestaan")}</label>
              <label className="check"><input type="checkbox" checked={modal.active} onChange={set("active")} /> {tx("Open voor donaties")}</label>
            </div>
            <strong style={{ fontSize: ".9rem" }}>{tx("Bedankje: toegang voor donateurs (optioneel)")}</strong>
            <GrantsEditor value={modal.grants} options={opts} onChange={(g) => setModal({ ...modal, grants: g })} />
            {modal.grants.length > 0 && (
              <div className="form-grid">
                <label>{tx("Dagen toegang na de donatie")}<input type="number" min="1" value={modal.grant_days} onChange={set("grant_days")} /></label>
                <label>{tx("Vanaf dit bedrag")}<input type="number" min="0" step="0.01" value={modal.min_for_grants} onChange={set("min_for_grants")} /></label>
              </div>
            )}
            {modal.error && <div className="alert">{modal.error}</div>}
            <div className="row">
              <button type="button" className="btn" onClick={() => setModal(null)}>{tx("Annuleren")}</button>
              <button className="btn primary">{tx("Opslaan")}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
