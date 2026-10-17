"use client";

import { tx } from "../../../../lib/t";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import GrantsEditor from "../../../../components/GrantsEditor";
import MediaPicker from "../../../../components/MediaPicker";
import { useModule } from "../../../../components/Modules";
import SysButton, { BUTTON_ICONS } from "../../../../components/SysButton";
import Tabs from "../../../../components/Tabs";
import ViewBar from "../../../../components/ViewBar";
import { api, errorText, mediaUrl } from "../../../../lib/api";
import { useView } from "../../../../lib/useView";
import { alertDialog, confirmDialog } from "../../../../lib/dialog";
import { money } from "../../../../lib/format";
import { lvl } from "../../../../lib/perms";

const BTN = { as_button: false, labels: {}, icon: "heart", variant: "primary", size: "md", radius: "default", color: "" };
const blank = { names: {}, descriptions: {}, recipients: {}, button: BTN, system_object: false, actions: [], info: { titles: {}, texts: {}, media: null }, thanks: { titles: {}, texts: {}, media: null }, min_amount: "2", max_amount: "100", step: "1", default_amount: "10", goal: "", allow_message: true, allow_anonymous: true, grants: [], grant_days: 30, min_for_grants: "0", active: true, order: 0 };

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
  const [sec, setSec] = useState("settings"); // tab of the form: settings | info | thanks
  const [picker, setPicker] = useState(null); // "info" | "thanks" while the media picker is open
  const [aiText, setAiText] = useState("");
  const [gates, setGates] = useState(null);
  useEffect(() => { api("/subscriptions/admin/settings/").then(setGates).catch(() => {}); }, []);
  const sysOn = useModule("sysobjects");
  const view = useView("donation-campaigns");
  useEffect(() => { api("/languages/").then((d) => { setLangs(d); setLang(d.default || d.languages[0]?.code || "nl"); }).catch(() => {}); }, []);

  // open the form: texts per language (older actions only have one name: that becomes the default-language text)
  const openForm = (c) => {
    const d = langs.default || "nl";
    setLang(d);
    setModal(c ? { ...c, goal: c.goal ?? "", names: c.names?.[d] || Object.keys(c.names || {}).length ? c.names : { [d]: c.name }, descriptions: Object.keys(c.descriptions || {}).length ? c.descriptions : { [d]: c.description || "" },
                   recipients: Object.keys(c.recipients || {}).length ? c.recipients : { [d]: c.recipient || "" }, button: { ...BTN, ...(c.button || {}) }, actions: c.actions || [], info: { titles: {}, texts: {}, media: null, ...(c.info || {}) }, thanks: { titles: {}, texts: {}, media: null, ...(c.thanks || {}) } } : { ...blank, button: { ...BTN } });
    setSec("settings");
  };
  const setText = (field, value) => setModal((m) => ({ ...m, [field]: { ...m[field], [lang]: value } }));
  const setBtn = (patch) => setModal((m) => ({ ...m, button: { ...m.button, ...patch } }));

  const setPop = (k, field, value) => setModal((m) => ({ ...m, [k]: { ...m[k], [field]: typeof value === "object" && value !== null ? { ...m[k][field], ...value } : value } }));
  async function generateText(k) {
    setAiText(k);
    try {
      const r = await api("/subscriptions/admin/campaigns/ai-text/", { method: "POST", body: { section: k, context: { names: modal.names, descriptions: modal.descriptions }, prompt: (modal[k].texts?.[lang] || "").slice(0, 600) } });
      setModal((m) => ({ ...m, [k]: { ...m[k], titles: { ...m[k].titles, ...r.titles }, texts: { ...m[k].texts, ...r.texts } }, error: "" }));
      if (r.simulated) setMsg({ ok: true, text: tx("Sandbox: dit is een gesimuleerd AI-antwoord. Zonder sandbox gebruikt het Claude.") });
    } catch (e) { setModal((m) => ({ ...m, error: errorText(e) })); }
    setAiText("");
  }

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
    for (const k of ["info", "thanks"]) { const { image_url: _i, ...rest } = body[k]; body[k] = rest; }
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
      <Tabs value={tab} onChange={setTab} tabs={[["campaigns", "Donatie-acties", null, camps.length], ["received", "Ontvangen"], ["access", "Toegang"]]} />

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

      {tab === "access" && gates && (
        <div className="card form">
          <h3 style={{ margin: 0 }}>{tx("Wat vraagt toegang?")}</h3>
          <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>{tx("Standaard is alles gratis. Zet een onderdeel aan om het alleen open te stellen voor wie een abonnement of een actie van een donatie heeft. De acties die je bij een donatie-actie instelt (tabblad Acties) geven die toegang.")} <a href="/dashboard/admin/actions">{tx("Alle onderdelen en voorwaarden beheer je bij Actions.")}</a></p>
          {[["site", "De hele website"], ["chat", "Chat"], ["chat_media", "Foto's en video's in de chat"], ["video_chat", "Videochat"], ["likes", "Likes per dag"]].map(([k, l]) => (
            <label className="check sec-toggle" key={k}>
              <input type="checkbox" checked={!!gates.gates[k]} disabled={L < 3} onChange={async (e) => { try { setGates(await api("/subscriptions/admin/settings/", { method: "PUT", body: { gates: { [k]: e.target.checked } } })); } catch (er) { setMsg({ ok: false, text: errorText(er) }); } }} />
              <span><strong>{tx(l)}</strong></span>
            </label>
          ))}
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
            <Tabs value={sec} onChange={setSec} tabs={[["settings", "Instellingen"], ["info", "Popup info"], ["thanks", "Bedankt popup"], ["actions", "Acties", null, modal.actions?.length || null]]} />
            {sec !== "actions" && <Tabs className="lang-tabs" value={lang} onChange={setLang} tabs={langs.languages.map((l) => [l.code, l.native_name || l.code, null, modal.names[l.code] ? "✓" : null])} />}
            {sec === "settings" && (
              <>
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
              </>
            )}
            {sec === "actions" && (
              <div className="pop-edit">
                <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>{tx("Wat de donateur nu mag gebruiken omdat hij gedoneerd heeft. Kies per actie vanaf welk bedrag, wanneer het geldt en hoe vaak. Alleen voor donateurs met een account. Deze instellingen gelden voor alle talen.")}</p>
                {modal.actions.map((a, i) => {
                  const sp = opts.grant_types.find((x) => x.type === a.type);
                  const upd = (patch) => setModal((m) => ({ ...m, actions: m.actions.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
                  return (
                    <div className="card action-row" key={i}>
                      <div className="grant-row">
                        <select value={a.type} onChange={(e) => upd({ type: e.target.value, ref: "", value: 0 })}>{opts.grant_types.map((g) => <option key={g.type} value={g.type}>{tx(g.label)}</option>)}</select>
                        {sp?.ref === "page" && <select value={a.ref || ""} onChange={(e) => upd({ ref: e.target.value })}><option value="">{tx("Kies een pagina…")}</option>{opts.pages.map((p) => <option key={p.key} value={p.key}>{p.title}</option>)}</select>}
                        {sp?.ref === "product" && <select value={a.ref || ""} onChange={(e) => upd({ ref: e.target.value })}><option value="">{tx("Kies een product…")}</option>{opts.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
                        {sp?.ref === "text" && <input value={a.ref || ""} maxLength={80} placeholder={tx("bv. cursus-1")} onChange={(e) => upd({ ref: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })} />}
                        {sp?.value && <input type="number" min={0} value={a.value ?? 0} placeholder={tx("0 = onbeperkt")} title={tx("0 = onbeperkt")} onChange={(e) => upd({ value: e.target.value })} />}
                        {!sp?.ref && !sp?.value && <span className="muted grant-help">{tx(sp?.help || "")}</span>}
                        <button type="button" className="btn sm danger" onClick={() => setModal((m) => ({ ...m, actions: m.actions.filter((_, j) => j !== i) }))}>{tx("Weg")}</button>
                      </div>
                      <div className="form-grid">
                        <label>{tx("Geldt vanaf (datum en tijd)")}<input type="datetime-local" value={a.from || ""} onChange={(e) => upd({ from: e.target.value })} /></label>
                        <label>{tx("Deadline (datum en tijd)")}<input type="datetime-local" value={a.until || ""} onChange={(e) => upd({ until: e.target.value })} /></label>
                        <label>{tx("Hoe vaak te gebruiken (0 = zo lang de actie geldt)")}<input type="number" min={0} value={a.uses ?? 0} onChange={(e) => upd({ uses: e.target.value })} /></label>
                        <label>{tx("Vanaf bedrag")}<input type="number" min={0} step="0.01" value={a.min_amount ?? 0} onChange={(e) => upd({ min_amount: e.target.value })} /></label>
                      </div>
                      <label className="check sec-toggle"><input type="checkbox" checked={!!a.session_only} onChange={(e) => upd({ session_only: e.target.checked })} /><span><strong>{tx("Alleen deze sessie")}</strong><br /><small className="muted">{tx("Geldt alleen zolang de donateur ingelogd blijft; na uitloggen is de actie voorbij.")}</small></span></label>
                    </div>
                  );
                })}
                {!modal.actions.length && <p className="muted" style={{ margin: 0 }}>{tx("Nog geen acties voor donateurs.")}</p>}
                <div><button type="button" className="btn sm" onClick={() => setModal((m) => ({ ...m, actions: [...m.actions, { type: "chat", ref: "", value: 0, from: "", until: "", uses: 0, session_only: false, min_amount: "0" }] }))}>{tx("+ Actie toevoegen")}</button></div>
              </div>
            )}
            {["info", "thanks"].includes(sec) && (
              <div className="pop-edit">
                <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>{sec === "info" ? tx("Dit venster verschijnt als iemand op de knop klikt, boven de schuifbalk: leg uit waarvoor de donatie is.") : tx("Dit venster verschijnt nadat iemand heeft gedoneerd.")}</p>
                <label>{tx("Titel")}<input value={modal[sec].titles?.[lang] || ""} onChange={(e) => setPop(sec, "titles", { [lang]: e.target.value })} maxLength={120} /></label>
                <label>{tx("Tekst")}<textarea rows={5} value={modal[sec].texts?.[lang] || ""} onChange={(e) => setPop(sec, "texts", { [lang]: e.target.value })} maxLength={1500} /></label>
                <div className="ai-row">
                  <button type="button" className="btn primary" onClick={() => generateText(sec)} disabled={!!aiText}>{aiText === sec ? tx("Bezig met genereren…") : `✨ ${tx("Genereer met AI")}`}</button>
                  <span className="muted" style={{ fontSize: ".82rem" }}>{tx("Claude schrijft titel en tekst in alle talen, op basis van de naam en omschrijving van de actie. Typ een wens in het tekstveld om bij te sturen.")}</span>
                </div>
                <div className="pop-image">
                  <strong style={{ fontSize: ".9rem" }}>{tx("Afbeelding")}</strong>
                  {modal[sec].image_url && <img src={mediaUrl(modal[sec].image_url)} alt="" />}
                  <div className="sub-actions">
                    <button type="button" className="btn sm" onClick={() => setPicker(sec)}>{modal[sec].media ? tx("Andere afbeelding") : tx("Kies uit de mediabibliotheek")}</button>
                    {modal[sec].media && <button type="button" className="btn sm danger" onClick={() => setModal((m) => ({ ...m, [sec]: { ...m[sec], media: null, image_url: null } }))}>{tx("Verwijderen")}</button>}
                  </div>
                </div>
                <div className="sys-demo pop-preview">
                  <small className="muted">{tx("Voorbeeld")} · {langs.languages.find((l) => l.code === lang)?.native_name || lang}</small>
                  <div className="card pop-card">
                    {modal[sec].image_url && <img src={mediaUrl(modal[sec].image_url)} alt="" />}
                    <h3 style={{ margin: 0 }}>{modal[sec].titles?.[lang] || (sec === "info" ? tx("Titel van het venster") : tx("Bedankt!"))}</h3>
                    <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{modal[sec].texts?.[lang] || tx("De tekst komt hier.")}</p>
                    {sec === "info" && <div className="don-amount" style={{ fontSize: "1.4rem" }}>€ {Number(modal.default_amount || 0).toFixed(2)}</div>}
                  </div>
                </div>
              </div>
            )}
            {modal.error && <div className="alert">{modal.error}</div>}
            <div className="row">
              <button type="button" className="btn" onClick={() => setModal(null)}>{tx("Annuleren")}</button>
              <button className="btn primary">{tx("Opslaan")}</button>
            </div>
            {picker && <MediaPicker onPick={(it) => { setModal((m) => ({ ...m, [picker]: { ...m[picker], media: it.id, image_url: it.url } })); setPicker(null); }} onClose={() => setPicker(null)} />}
          </form>
        </div>
      )}
    </>
  );
}
