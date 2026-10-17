"use client";

import { tx } from "../../../../lib/t";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import GrantsEditor from "../../../../components/GrantsEditor";
import { useModule } from "../../../../components/Modules";
import Tabs from "../../../../components/Tabs";
import ViewBar from "../../../../components/ViewBar";
import { api, errorText } from "../../../../lib/api";
import { useView } from "../../../../lib/useView";
import { confirmDialog, promptDialog } from "../../../../lib/dialog";
import { money } from "../../../../lib/format";
import { lvl } from "../../../../lib/perms";

const STATUS_BADGE = { pending: "off", trial: "ok", active: "ok", past_due: "off", canceled: "off", expired: "off" };
const GATES = [
  ["site", "De hele website", "Zonder abonnement kom je alleen op de inlog- en abonnementspagina's."],
  ["chat", "Chat", "Alleen leden met een abonnement kunnen berichten sturen in de chat."],
  ["chat_media", "Foto's en video's in de chat", "Delen van foto's en video's vraagt een abonnement."],
  ["video_chat", "Videochat", "Videobellen via de chat en de directe verbinding vraagt een abonnement."],
  ["likes", "Likes per dag", "Zonder abonnement geldt het aantal likes hieronder; een abonnement met 'Likes per dag' geeft meer of onbeperkt."],
];
const blank = { system_object: false, button: {}, name: "", description: "", price: "0", vat_rate: "21", interval: "month", duration_days: 0, trial_days: 0, grants: [], highlight: false, active: true, order: 0 };

export default function SubscriptionsAdmin() {
  const { user } = useAuth();
  const L = lvl(user, "subscriptions");
  const [tab, setTab] = useState("plans");
  const [plans, setPlans] = useState([]);
  const [members, setMembers] = useState([]);
  const [opts, setOpts] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [stats, setStats] = useState(null);
  const [modal, setModal] = useState(null);
  const [filter, setFilter] = useState({ status: "", q: "" });
  const [msg, setMsg] = useState(null);
  const sysOn = useModule("sysobjects");
  const view = useView("subscription-plans");

  const loadPlans = useCallback(() => api("/subscriptions/admin/plans/").then(setPlans).catch((e) => setMsg({ ok: false, text: errorText(e) })), []);
  const loadMembers = useCallback(() => api(`/subscriptions/admin/members/?status=${filter.status}&q=${encodeURIComponent(filter.q)}`).then(setMembers).catch((e) => setMsg({ ok: false, text: errorText(e) })), [filter]);
  const loadStats = () => api("/subscriptions/admin/stats/").then(setStats).catch(() => {});
  useEffect(() => { loadPlans(); loadStats(); api("/subscriptions/admin/options/").then(setOpts); api("/subscriptions/admin/settings/").then(setCfg); }, [loadPlans]);
  useEffect(() => { if (tab === "members") loadMembers(); }, [tab, loadMembers]);

  async function savePlan(e) {
    e.preventDefault();
    const { id, error: _e, grants_text, subscribers, recurring, slug, ...body } = modal;
    try {
      await (id ? api(`/subscriptions/admin/plans/${id}/`, { method: "PATCH", body }) : api("/subscriptions/admin/plans/", { method: "POST", body }));
      setModal(null); loadPlans(); loadStats();
    } catch (err) { setModal({ ...modal, error: errorText(err) }); }
  }
  const removePlan = async (p) => { if (await confirmDialog(tx("Abonnement \"{0}\" verwijderen?", p.name), { danger: true })) { try { await api(`/subscriptions/admin/plans/${p.id}/`, { method: "DELETE" }); loadPlans(); } catch (e) { setMsg({ ok: false, text: errorText(e) }); } } };
  const togglePlan = async (p) => { await api(`/subscriptions/admin/plans/${p.id}/`, { method: "PATCH", body: { active: !p.active } }); loadPlans(); };

  const act = async (s, what) => {
    try {
      if (what === "cancel" && !(await confirmDialog(tx("Dit abonnement per direct beëindigen?"), { danger: true }))) return;
      if (what === "extend") {
        const d = await promptDialog(tx("Hoeveel dagen extra toegang?"), "30");
        if (!d) return;
        await api(`/subscriptions/admin/members/${s.id}/extend/`, { method: "POST", body: { days: d } });
      } else await api(`/subscriptions/admin/members/${s.id}/cancel/`, { method: "POST", body: { now: true } });
      loadMembers(); loadStats();
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  };
  const give = async () => {
    const email = await promptDialog(tx("E-mailadres van het lid"), "");
    if (!email) return;
    try {
      const planName = await promptDialog(tx("Welk abonnement? (naam: {0})", plans.map((p) => p.name).join(", ")), plans[0]?.name || "");
      const plan = plans.find((p) => p.name.toLowerCase() === (planName || "").toLowerCase());
      if (!plan) return setMsg({ ok: false, text: tx("Dit abonnement bestaat niet.") });
      const days = await promptDialog(tx("Aantal dagen (0 = onbeperkt)"), "30");
      await api("/subscriptions/admin/give/", { method: "POST", body: { email, plan: plan.id, days } });
      setMsg({ ok: true, text: tx("Abonnement gegeven.") }); loadMembers(); loadStats();
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  };

  const saveCfg = async (patch) => {
    try { setCfg(await api("/subscriptions/admin/settings/", { method: "PUT", body: patch })); setMsg({ ok: true, text: tx("Opgeslagen.") }); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  };

  if (!opts || !cfg) return msg ? <div className="alert">{msg.text}</div> : <p className="muted">{tx("Laden…")}</p>;
  const cur = opts.currency || "EUR";
  const iv = (v) => opts.intervals.find((i) => i.value === v)?.label || v;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{tx("Abonnementen")}</h1>
          <p className="muted" style={{ margin: 0 }}>{tx("Maak abonnementen die toegang geven tot de site, pagina's, content, chat, video, likes of een dienst. Elke periode wordt een order gemaakt; herhaalde abonnementen krijgen vanzelf een nieuwe order.")}</p>
        </div>
        {L >= 3 && tab === "plans" && <button className="btn primary" onClick={() => setModal({ ...blank })}>{tx("+ Nieuw abonnement")}</button>}
        {L >= 3 && tab === "members" && <button className="btn primary" onClick={give}>{tx("+ Abonnement geven")}</button>}
      </div>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}
      {stats && (
        <div className="sub-stats">
          <div className="card"><span className="muted">{tx("Actieve abonnees")}</span><strong>{stats.active}</strong></div>
          <div className="card"><span className="muted">{tx("Omzet per maand (terugkerend)")}</span><strong>{money(stats.mrr, cur)}</strong></div>
          <div className="card"><span className="muted">{tx("Wachten op betaling")}</span><strong>{stats.pending + stats.past_due}</strong></div>
          <div className="card"><span className="muted">{tx("Abonnementen te koop")}</span><strong>{stats.plans}</strong></div>
        </div>
      )}
      <Tabs value={tab} onChange={setTab} tabs={[["plans", "Abonnementen", null, plans.length], ["members", "Abonnees"], ["settings", "Instellingen"]]} />

      {tab === "plans" && (
        <>
        <ViewBar view={view} count={`${plans.length}`} placeholder={tx("Zoek een abonnement…")} />
        <div className={`sub-plans${view.cls}`}>
          {plans.filter((p) => view.match(p.name, p.description, p.grants_text.map((g) => g.label).join(" "))).map((p) => (
            <div className={`card sub-plan${p.active ? "" : " off"}`} key={p.id}>
              <div className="sub-plan-top"><strong>{p.name}</strong>{p.highlight && <span className="badge ok">{tx("Populair")}</span>}{!p.active && <span className="badge off">{tx("Niet te koop")}</span>}</div>
              <div className="sub-price">{money(p.price, cur)} <small>{p.recurring ? `/ ${iv(p.interval).replace("Per ", "").toLowerCase()}` : tx("eenmalig")}</small></div>
              <div className="muted" style={{ fontSize: ".82rem" }}>
                {p.recurring ? tx("Elke periode een nieuwe order (herhaald)") : p.duration_days ? tx("Eenmalige order, {0} dagen toegang", p.duration_days) : tx("Eenmalige order, onbeperkt toegang")}
                {p.trial_days > 0 && ` · ${p.trial_days} ${tx("dagen proef")}`}
              </div>
              <ul className="sub-grants">{p.grants_text.map((g, i) => <li key={i}>{tx(g.label)}</li>)}{!p.grants_text.length && <li className="muted">{tx("Geen toegang gekoppeld")}</li>}</ul>
              <div className="muted" style={{ fontSize: ".8rem" }}>{p.subscribers} {tx("abonnees")}</div>
              {L >= 2 && (
                <div className="sub-actions">
                  <button className="btn sm" onClick={() => setModal({ ...p })}>{tx("Wijzig")}</button>
                  <button className="btn sm" onClick={() => togglePlan(p)}>{p.active ? tx("Uit de verkoop") : tx("Weer te koop")}</button>
                  {L >= 3 && <button className="btn sm danger" onClick={() => removePlan(p)}>{tx("Verwijder")}</button>}
                </div>
              )}
            </div>
          ))}
          {!plans.length && <p className="muted">{tx("Nog geen abonnementen. Maak je eerste abonnement.")}</p>}
        </div>
        </>
      )}

      {tab === "members" && (
        <div className="card">
          <div className="sub-filter">
            <input placeholder={tx("Zoek op naam of e-mail")} value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
            <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
              <option value="">{tx("Alle statussen")}</option>
              {["pending", "trial", "active", "past_due", "canceled", "expired"].map((s) => <option key={s} value={s}>{tx({ pending: "Wacht op betaling", trial: "Proefperiode", active: "Actief", past_due: "Betaling achterstallig", canceled: "Opgezegd (loopt af)", expired: "Verlopen" }[s])}</option>)}
            </select>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>{tx("Lid")}</th><th>{tx("Abonnement")}</th><th>{tx("Status")}</th><th>{tx("Loopt tot")}</th><th>{tx("Orders")}</th><th /></tr></thead>
              <tbody>
                {members.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.user.name}</strong><br /><small className="muted">{s.user.email}</small></td>
                    <td>{s.plan_name}<br /><small className="muted">{s.manual ? tx("handmatig") : `${money(s.price, cur)} · ${iv(s.interval)}`}</small></td>
                    <td><span className={`badge ${STATUS_BADGE[s.status]}`}>{tx(s.status_label)}</span>{s.cancel_at_period_end && <><br /><small className="muted">{tx("stopt na deze periode")}</small></>}{s.open_order && <><br /><small className="muted">{tx("open order")} {s.open_order.number}</small></>}</td>
                    <td>{s.period_end ? new Date(s.period_end).toLocaleDateString() : tx("onbeperkt")}</td>
                    <td>{s.periods}</td>
                    <td className="sub-actions">{L >= 2 && s.status !== "expired" && <><button className="btn sm" onClick={() => act(s, "extend")}>{tx("Verleng")}</button><button className="btn sm danger" onClick={() => act(s, "cancel")}>{tx("Beëindig")}</button></>}</td>
                  </tr>
                ))}
                {!members.length && <tr><td colSpan={6} className="muted">{tx("Geen abonnees gevonden.")}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "settings" && (
        <div className="card form">
          <h3 style={{ margin: 0 }}>{tx("Wat vraagt een abonnement?")}</h3>
          <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>{tx("Standaard is alles gratis. Zet een onderdeel hier aan om het alleen open te stellen voor leden met een abonnement dat die toegang geeft. Pagina's, content en diensten koppel je bij het abonnement zelf.")}</p>
          {GATES.map(([k, label, help]) => (
            <label className="check sec-toggle" key={k}>
              <input type="checkbox" checked={!!cfg.gates[k]} disabled={L < 3} onChange={(e) => saveCfg({ gates: { [k]: e.target.checked } })} />
              <span><strong>{tx(label)}</strong><br /><small className="muted">{tx(help)}</small></span>
            </label>
          ))}
          <div className="grid2">
            <label>{tx("Gratis likes per dag (zonder abonnement)")}<input type="number" min={0} value={cfg.free_likes_per_day} disabled={L < 3} onChange={(e) => setCfg({ ...cfg, free_likes_per_day: e.target.value })} onBlur={(e) => saveCfg({ free_likes_per_day: e.target.value })} /></label>
            <label>{tx("Dagen respijt na een gemiste betaling")}<input type="number" min={0} max={90} value={cfg.grace_days} disabled={L < 3} onChange={(e) => setCfg({ ...cfg, grace_days: e.target.value })} onBlur={(e) => saveCfg({ grace_days: e.target.value })} /></label>
          </div>
          <label className="check sec-toggle">
            <input type="checkbox" checked={!!cfg.invoice_activate} disabled={L < 3} onChange={(e) => saveCfg({ invoice_activate: e.target.checked })} />
            <span><strong>{tx("Op factuur direct activeren")}</strong><br /><small className="muted">{tx("Zonder online betaling start een abonnement meteen; de order blijft open tot je hem op betaald zet.")}</small></span>
          </label>
          <label>{tx("Tekst als de site een abonnement vraagt")}<input value={cfg.site_message} disabled={L < 3} maxLength={500} onChange={(e) => setCfg({ ...cfg, site_message: e.target.value })} onBlur={(e) => saveCfg({ site_message: e.target.value })} /></label>
          <label>{tx("Inleiding op de abonnementenpagina")}<textarea rows={3} value={cfg.intro} disabled={L < 3} maxLength={500} onChange={(e) => setCfg({ ...cfg, intro: e.target.value })} onBlur={(e) => saveCfg({ intro: e.target.value })} /></label>
        </div>
      )}

      {modal && (
        <div className="overlay" onClick={() => setModal(null)}>
          <form className="card modal form int-modal" onClick={(e) => e.stopPropagation()} onSubmit={savePlan}>
            <h2>{modal.id ? tx("Abonnement wijzigen") : tx("Nieuw abonnement")}</h2>
            <div className="form-grid">
              <label>{tx("Naam")}<input value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} required maxLength={120} /></label>
              <label>{tx("Prijs per periode (incl. btw)")}<input type="number" step="0.01" min="0" value={modal.price} onChange={(e) => setModal({ ...modal, price: e.target.value })} required /></label>
              <label>{tx("Btw-percentage")}<input type="number" step="0.5" min="0" max="50" value={modal.vat_rate} onChange={(e) => setModal({ ...modal, vat_rate: e.target.value })} /></label>
              <label>{tx("Herhaling")}
                <select value={modal.interval} onChange={(e) => setModal({ ...modal, interval: e.target.value })}>{opts.intervals.map((i) => <option key={i.value} value={i.value}>{tx(i.label)}</option>)}</select>
              </label>
              {modal.interval === "once"
                ? <label>{tx("Dagen toegang (0 = onbeperkt)")}<input type="number" min="0" value={modal.duration_days} onChange={(e) => setModal({ ...modal, duration_days: e.target.value })} /></label>
                : <label>{tx("Dagen gratis proef")}<input type="number" min="0" value={modal.trial_days} onChange={(e) => setModal({ ...modal, trial_days: e.target.value })} /></label>}
              <label>{tx("Volgorde")}<input type="number" min="0" value={modal.order} onChange={(e) => setModal({ ...modal, order: e.target.value })} /></label>
            </div>
            <label>{tx("Omschrijving")}<textarea rows={2} value={modal.description} onChange={(e) => setModal({ ...modal, description: e.target.value })} /></label>
            <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>{modal.interval === "once" ? tx("Eenmalig: er wordt één order gemaakt.") : tx("Herhaald: bij elke nieuwe periode wordt automatisch een nieuwe order gemaakt tot het lid opzegt.")}</p>
            <strong style={{ fontSize: ".9rem" }}>{tx("Wat geeft dit abonnement?")}</strong>
            <GrantsEditor value={modal.grants} options={opts} onChange={(g) => setModal({ ...modal, grants: g })} />
            <div className="row-checks">
              <label className="check"><input type="checkbox" checked={modal.active} onChange={(e) => setModal({ ...modal, active: e.target.checked })} /> {tx("Te koop")}</label>
              <label className="check"><input type="checkbox" checked={modal.highlight} onChange={(e) => setModal({ ...modal, highlight: e.target.checked })} /> {tx("Markeren als populair")}</label>
              {sysOn && <label className="check"><input type="checkbox" checked={!!modal.system_object} onChange={(e) => setModal({ ...modal, system_object: e.target.checked })} /> {tx("Systeemobject (op een pagina te zetten)")}</label>}
            </div>
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
