"use client";

import { tx } from "../../../../lib/t";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import GrantsEditor from "../../../../components/GrantsEditor";
import { useModule } from "../../../../components/Modules";
import SysButton, { BUTTON_ICONS } from "../../../../components/SysButton";
import Tabs from "../../../../components/Tabs";
import ViewBar from "../../../../components/ViewBar";
import { api, errorText } from "../../../../lib/api";
import { useView } from "../../../../lib/useView";
import { alertDialog, confirmDialog } from "../../../../lib/dialog";
import { money } from "../../../../lib/format";
import { lvl } from "../../../../lib/perms";

const BTN = { as_button: false, labels: {}, icon: "heart", variant: "primary", size: "md", radius: "default", color: "" };
const blank = { names: {}, descriptions: {}, recipients: {}, button: BTN, system_object: false, min_amount: "2", max_amount: "100", step: "1", default_amount: "10", goal: "", allow_message: true, allow_anonymous: true, grants: [], grant_days: 30, min_for_grants: "0", active: true, order: 0 };

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
  const [langs, setLangs] = useState({ default: "nl", languages: [{ code: "nl", native_name: "Nederlands" }] });
  const [lang, setLang] = useState("nl");
  const [ai, setAi] = useState(false);
  const sysOn = useModule("sysobjects");
  const view = useView("donation-campaigns");
  useEffect(() => { api("/languages/").then((d) => { setLangs(d); setLang(d.default || d.languages[0]?.code || "nl"); }).catch(() => {}); }, []);

  // open the form: texts per language (older actions only have one name: that becomes the default-language text)
  const openForm = (c) => {
    const d = langs.default || "nl";
    setLang(d);
    setModal(c ? { ...c, goal: c.goal ?? "", names: c.names?.[d] || Object.keys(c.names || {}).length ? c.names : { [d]: c.name }, descriptions: Object.keys(c.descriptions || {}).length ? c.descriptions : { [d]: c.description || "" },
                   recipients: Object.keys(c.recipients || {}).length ? c.recipients : { [d]: c.recipient || "" }, button: { ...BTN, ...(c.button || {}) } } : { ...blank, button: { ...BTN } });
  };
  const setText = (field, value) => setModal((m) => ({ ...m, [field]: { ...m[field], [lang]: value } }));
  const setBtn = (patch) => setModal((m) => ({ ...m, button: { ...m.button, ...patch } }));

  // "Genereer met AI": the description is the prompt; Claude fills every field in every language
  async function generate() {
    const prompt = (modal.descriptions[lang] || Object.values(modal.descriptions).find(Boolean) || "").trim();
    if (prompt.length < 5) return alertDialog(tx("Beschrijf eerst in het veld Omschrijving waar de donatie-actie over gaat. Dat is de prompt voor de AI."));
    setAi(true);
    try {
      const r = await api("/subscriptions/admin/campaigns/ai/", { method: "POST", body: { prompt, current: { names: modal.names, min_amount: modal.min_amount, max_amount: modal.max_amount } } });
      setModal((m) => ({ ...m, names: { ...m.names, ...r.names }, descriptions: { ...m.descriptions, ...r.descriptions }, recipients: { ...m.recipients, ...r.recipients },
        min_amount: String(r.min_amount), max_amount: String(r.max_amount), step: String(r.step), default_amount: String(r.default_amount), goal: r.goal ?? "",
        allow_message: r.allow_message, allow_anonymous: r.allow_anonymous, button: { ...m.button, labels: { ...m.button.labels, ...r.button.labels }, icon: r.button.icon, as_button: true }, error: "" }));
      if (r.simulated) setMsg({ ok: true, text: tx("Sandbox: dit is een gesimuleerd AI-antwoord. Zonder sandbox gebruikt het Claude.") });
    } catch (e) { setModal((m) => ({ ...m, error: errorText(e) })); }
    setAi(false);
  }

  const loadCamps = useCallback(() => api("/subscriptions/admin/campaigns/").then(setCamps).catch((e) => setMsg({ ok: false, text: errorText(e) })), []);
  const loadRec = useCallback(() => api(`/subscriptions/admin/donations/?campaign=${filter.campaign}&status=${filter.status}`).then(setRec).catch((e) => setMsg({ ok: false, text: errorText(e) })), [filter]);
  useEffect(() => { loadCamps(); api("/subscriptions/admin/options/").then(setOpts).catch((e) => setMsg({ ok: false, text: errorText(e) })); }, [loadCamps]);
  useEffect(() => { loadRec(); }, [loadRec]);

  async function save(e) {
    e.preventDefault();
    const { id, error: _e, grants_text, raised, count, slug, name, description, recipient, ...body } = modal;
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
        {L >= 3 && tab === "campaigns" && <button className="btn primary" onClick={() => openForm(null)}>{tx("+ Nieuwe actie")}</button>}
      </div>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}
      {rec && <div className="sub-stats"><div className="card"><span className="muted">{tx("Totaal ontvangen")}</span><strong>{money(rec.total, cur)}</strong></div><div className="card"><span className="muted">{tx("Aantal donaties")}</span><strong>{rec.count}</strong></div></div>}
      <Tabs value={tab} onChange={setTab} tabs={[["campaigns", "Acties", null, camps.length], ["received", "Ontvangen"]]} />

      {tab === "campaigns" && (
        <>
        <ViewBar view={view} count={`${camps.length}`} placeholder={tx("Zoek een actie…")} />
        <div className={`sub-plans${view.cls}`}>
          {camps.filter((c) => view.match(c.name, c.description, Object.values(c.names || {}).join(" "), c.recipient)).map((c) => (
            <div className={`card sub-plan${c.active ? "" : " off"}`} key={c.id}>
              <div className="sub-plan-top"><strong>{c.name}</strong>{!c.active && <span className="badge off">{tx("Gesloten")}</span>}</div>
              <div className="sub-price">{money(c.min_amount, cur)} – {money(c.max_amount, cur)}</div>
              <div className="muted" style={{ fontSize: ".82rem" }}>{tx("Voor")} {c.recipient || tx("de makers")} · {tx("stap")} {money(c.step, cur)}</div>
              <div><strong>{money(c.raised, cur)}</strong> <span className="muted">{tx("ontvangen")} ({c.count}){c.goal ? ` · ${tx("doel")} ${money(c.goal, cur)}` : ""}</span></div>
              {c.goal && <div className="don-bar"><i style={{ width: `${Math.min(100, (Number(c.raised) / Number(c.goal)) * 100)}%` }} /></div>}
              {c.grants_text.length > 0 && <ul className="sub-grants">{c.grants_text.map((g, i) => <li key={i}>{tx(g.label)}</li>)}</ul>}
              {L >= 2 && (
                <div className="sub-actions">
                  <button className="btn sm" onClick={() => openForm(c)}>{tx("Wijzig")}</button>
                  <button className="btn sm" onClick={() => toggle(c)}>{c.active ? tx("Sluiten") : tx("Heropenen")}</button>
                  {L >= 3 && <button className="btn sm danger" onClick={() => remove(c)}>{tx("Verwijder")}</button>}
                </div>
              )}
            </div>
          ))}
          {!camps.length && <p className="muted">{tx("Nog geen acties. Maak je eerste donatie-actie.")}</p>}
        </div>
        </>
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
            <Tabs className="lang-tabs" value={lang} onChange={setLang} tabs={langs.languages.map((l) => [l.code, l.native_name || l.code, null, modal.names[l.code] ? "✓" : null])} />
            <div className="form-grid">
              <label>{tx("Naam")}<input value={modal.names[lang] || ""} onChange={(e) => setText("names", e.target.value)} maxLength={120} /></label>
              <label>{tx("Voor wie (bv. de makers)")}<input value={modal.recipients[lang] || ""} onChange={(e) => setText("recipients", e.target.value)} maxLength={120} placeholder={tx("de makers")} /></label>
              <label>{tx("Knoptekst")}<input value={modal.button.labels?.[lang] || ""} onChange={(e) => setBtn({ labels: { ...modal.button.labels, [lang]: e.target.value } })} maxLength={40} placeholder={tx("Doneer")} /></label>
            </div>
            <label>{tx("Omschrijving")}
              <textarea rows={3} value={modal.descriptions[lang] || ""} onChange={(e) => setText("descriptions", e.target.value)} placeholder={tx("Beschrijf de actie: waar is het voor en wat wil je bereiken? Dit is ook de prompt voor de AI.")} />
            </label>
            <div className="ai-row">
              <button type="button" className="btn primary" onClick={generate} disabled={ai}>{ai ? tx("Bezig met genereren…") : `✨ ${tx("Genereer met AI")}`}</button>
              <span className="muted" style={{ fontSize: ".82rem" }}>{tx("De omschrijving is de prompt. Claude vult alle velden in alle talen in; jij past daarna aan.")}</span>
            </div>
            <div className="form-grid">
              <label>{tx("Doelbedrag (optioneel)")}<input type="number" min="0" step="0.01" value={modal.goal} onChange={set("goal")} /></label>
              <label>{tx("Minimum bedrag")}<input type="number" min="0.01" step="0.01" value={modal.min_amount} onChange={set("min_amount")} required /></label>
              <label>{tx("Maximum bedrag")}<input type="number" min="0.01" step="0.01" value={modal.max_amount} onChange={set("max_amount")} required /></label>
              <label>{tx("Stap van de schuifbalk")}<input type="number" min="0.01" step="0.01" value={modal.step} onChange={set("step")} required /></label>
              <label>{tx("Standaardbedrag")}<input type="number" min="0.01" step="0.01" value={modal.default_amount} onChange={set("default_amount")} required /></label>
              <label>{tx("Volgorde")}<input type="number" min="0" value={modal.order} onChange={set("order")} /></label>
            </div>
            <label className="check"><input type="checkbox" checked={!!modal.button.as_button} onChange={(e) => setBtn({ as_button: e.target.checked })} /> {tx("Als knop tonen")}</label>
            {modal.button.as_button && (
              <>
                <div className="form-grid">
                  <label>{tx("Pictogram")}
                    <select value={modal.button.icon} onChange={(e) => setBtn({ icon: e.target.value })}>
                      <option value="none">{tx("Geen pictogram")}</option>
                      {Object.keys(BUTTON_ICONS).map((k) => <option key={k} value={k}>{tx({ heart: "Hart", gift: "Cadeau", coffee: "Koffie", star: "Ster", rocket: "Raket", smile: "Smiley", card: "Kaart" }[k])}</option>)}
                    </select>
                  </label>
                  <label>{tx("Stijl")}
                    <select value={modal.button.variant} onChange={(e) => setBtn({ variant: e.target.value })}>
                      {[["primary", "Gevuld"], ["outline", "Omlijnd"], ["soft", "Zacht"], ["gradient", "Kleurverloop"]].map(([k, l]) => <option key={k} value={k}>{tx(l)}</option>)}
                    </select>
                  </label>
                  <label>{tx("Grootte")}
                    <select value={modal.button.size} onChange={(e) => setBtn({ size: e.target.value })}>{[["sm", "Klein"], ["md", "Normaal"], ["lg", "Groot"]].map(([k, l]) => <option key={k} value={k}>{tx(l)}</option>)}</select>
                  </label>
                  <label>{tx("Hoeken")}
                    <select value={modal.button.radius} onChange={(e) => setBtn({ radius: e.target.value })}>{[["default", "Standaard"], ["pill", "Rond"], ["square", "Vierkant"]].map(([k, l]) => <option key={k} value={k}>{tx(l)}</option>)}</select>
                  </label>
                  <label>{tx("Kleur (leeg = huisstijl)")}
                    <span className="color-pick"><input type="color" value={modal.button.color || "#1b97d3"} onChange={(e) => setBtn({ color: e.target.value })} />{modal.button.color && <button type="button" className="btn sm" onClick={() => setBtn({ color: "" })}>{tx("Huisstijl")}</button>}</span>
                  </label>
                </div>
                <div className="sys-demo">
                  <small className="muted">{tx("Voorbeeld")} · {langs.languages.find((l) => l.code === lang)?.native_name || lang}</small>
                  <SysButton button={modal.button} label={modal.button.labels?.[lang] || modal.button.labels?.[langs.default] || tx("Doneer")} onClick={() => {}} />
                </div>
              </>
            )}
            {sysOn
              ? <label className="check sec-toggle"><input type="checkbox" checked={!!modal.system_object} onChange={set("system_object")} /><span><strong>{tx("Systeemobject")}</strong><br /><small className="muted">{tx("Kan in bewerkmodus op een pagina worden gezet (Admin → Systeemobjecten).")}</small></span></label>
              : <p className="muted" style={{ margin: 0, fontSize: ".82rem" }}>{tx("Wil je deze actie op een pagina kunnen zetten? Zet dan de module Systeemobjecten aan bij Super admin → Modules.")}</p>}
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
