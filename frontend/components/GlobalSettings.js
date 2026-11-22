// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import PhoneInput from "./PhoneInput";
import Tabs from "./Tabs";
import { IconBriefcase, IconCheck, IconLock, IconUsers, IconGlobe, IconMail, IconSettings, IconShield, IconSliders, IconX } from "./Icons";
import KitScope from "../lib/ui-kit/KitScope";
import SuperTile from "./SuperTile";
import PlusLock from "./PlusLock";
import { useAuth } from "./AuthContext";
import { api, errorText } from "../lib/api";
import { alertDialog, confirmDialog } from "../lib/dialog";
import { showSourceNotice } from "../lib/sourceNotice";
import { tx } from "../lib/t";
import Loading from "./Loading";

const FIELDS = [
  ["base_domain", "Basisdomein", "easy2edit.com", "De websites van easy2edit zijn naam.basisdomein, bijvoorbeeld siten.easy2edit.com."],
  ["api_url", "API van easy2edit", "https://api.easy2edit.com", "Het adres van de API van de standaard easy2edit-server."],
  ["site_url", "Website van easy2edit", "https://easy2edit.com", "De website van easy2edit zelf (informatie en de vermelding onderaan een pagina)."],
];

const PHASES = [["grace_1", "Fase 1: volledige toegang", "Alles werkt nog; er staat een melding in de site en bij het inloggen."], ["grace_2", "Fase 2: geen pagina-editor", "Pagina's kunnen niet meer worden gewijzigd."], ["grace_3", "Fase 3: geen beheer, alleen de licentie bijwerken", "Beheerders kunnen alleen nog de licentie bijwerken."], ["grace_4", "Fase 4: website offline", "Daarna blijft de website offline tot de licentie is bijgewerkt."]];
const NOTIFY = [["notify_rstcc", "RST CC", "De eigenaar van easy2edit."], ["notify_reseller", "Reseller", "Leeg: het e-mailadres van de reseller op de licentie zelf."], ["notify_invoicing", "Invoicing", "De administratie die de facturen maakt."], ["notify_support", "Support", "Het supportteam."]];
const TABS = [["server", "Easy2edit-server", IconGlobe], ["settings", "Instellingen", IconSliders], ["licence", "Licentieregels", IconShield], ["mails", "Licentie-e-mails", IconMail], ["reseller", "Standaard reseller", IconBriefcase], ["twofa", "Twee-staps verificatie", IconLock], ["websites", "Websites", IconUsers]];

const rsField = (k, label, form, setForm, wide) => (
  <div key={k} className="e2e-field" style={wide ? { gridColumn: "1 / -1" } : undefined}>
    <label className="e2e-label" htmlFor={`gs-${k}`}>{tx(label)}</label>
    {k === "reseller_phone" || k === "reseller_mobile"
      ? <PhoneInput id={`gs-${k}`} value={form[k] || ""} onChange={(v) => setForm((f) => ({ ...f, [k]: v }))} />
      : <input id={`gs-${k}`} className="e2e-input" type={k === "reseller_email" ? "email" : "text"} spellCheck={false} value={form[k] || ""} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />}
  </div>
);
// a part of a tab with a heading and a short explanation: the fields of a tab are grouped, not one long list
const Sec = ({ title, hint, children }) => (
  <section className="gs-sec">
    <header><h3>{tx(title)}</h3>{hint && <p className="e2e-hint">{tx(hint)}</p>}</header>
    {children}
  </section>
);
// per tab: "do not overwrite" = carried with new installations, but an update (or the easy2edit server) leaves it alone on this installation unless it is forced
const LocalOnly = ({ tab, form, setForm }) => (
  <label className="e2e-switch gs-sw gs-local">
    <input type="checkbox" checked={form[`keep_${tab}`] === "1"} onChange={(e) => setForm((f) => ({ ...f, [`keep_${tab}`]: e.target.checked ? "1" : "0" }))} />
    <span><strong>{tx("Niet overschrijven bij een update")}</strong><br /><span className="e2e-hint">{tx("Aangevinkt: deze instellingen gaan wel mee met nieuwe installaties, maar worden bij een update en vanaf de easy2edit-server niet overschreven op deze installatie (tenzij de server het forceert). Niet aangevinkt (standaard): ze worden bij elke update bijgewerkt.")}</span></span>
  </label>
);
// a switch with its explanation
const Sw = ({ checked, onChange, title, hint }) => (
  <label className="e2e-switch gs-sw">
    <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
    <span><strong>{tx(title)}</strong>{hint && <><br /><span className="e2e-hint">{tx(hint)}</span></>}</span>
  </label>
);
// a number field with its unit
const Num = ({ id, label, unit, hint, ...rest }) => (
  <div className="e2e-field">
    <label className="e2e-label" htmlFor={id}>{tx(label)}</label>
    <div className="gs-unit"><input id={id} className="e2e-input" type="number" {...rest} />{unit && <span className="e2e-hint">{tx(unit)}</span>}</div>
    {hint && <span className="e2e-hint">{tx(hint)}</span>}
  </div>
);

const TAB_NAME = { server: "Easy2edit-server", settings: "Instellingen", licence: "Licentieregels", mails: "Licentie-e-mails", reseller: "Standaard reseller", twofa: "Twee-staps verificatie" };

// The websites, loaded from the easy2edit server: per website which tabs of the standard settings it does not want overwritten, and when they were last put on it. From here they can be updated or forced.
function WebsitesTab({ setMsg }) {
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState("");
  const [pick, setPick] = useState({});  // the tabs that are put on the websites (all when none is ticked)
  const [sel, setSel] = useState({});  // the websites that are ticked (all when none is ticked)
  const [res, setRes] = useState([]);
  const load = () => api("/system/sites-defaults/").then(setD).catch((e) => setMsg({ ok: false, text: errorText(e) }));
  useEffect(() => { load(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps
  const tabs = Object.keys(pick).filter((k) => pick[k]);
  const ready = (d?.sites || []).filter((x) => x.status === "active" && x.has_callback);
  const chosen = ready.filter((x) => sel[x.id]);
  const target = chosen.length ? chosen.map((x) => x.id) : "all";
  const count = chosen.length || ready.length;
  const run = async (ids, force) => {
    const text = force ? tx("Forceren: de instellingen worden ook overschreven op de tabs die een website niet wil overschrijven. Doorgaan?") : "";
    if (force && !(await confirmDialog(text, { okLabel: tx("Forceren"), cancelLabel: tx("Annuleren") }))) return;
    setBusy(`${ids}-${force}`); setMsg(null);
    try { const r = await api("/system/sites-defaults/", { method: "POST", body: { site_ids: ids, tabs, force } }); setD(r); setRes(r.results || []); setMsg({ ok: true, text: tx("{0} websites bijgewerkt.", String((r.results || []).filter((x) => x.ok).length)) }); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy("");
  };
  if (!d) return <p className="e2e-hint">{<Loading compact />}</p>;
  if (!d.server) return <div className="e2e-alert" role="status" data-easy2edit-tag="ui-alerts"><span className="e2e-alert__icon">i</span><div>{tx("Dit overzicht staat alleen op de easy2edit-server. Zet bij Super admin+ → Site manager de installatie als server aan om de websites hier te beheren.")}</div></div>;
  const stateOf = (s, t) => (s.keep.includes(t) ? "keep" : "update");
  return (
    <div className="e2e-stack" style={{ gap: "1.4rem" }}>
      <p style={{ margin: 0 }}>{tx("De websites van de easy2edit-server. Per website zie je welke tabs van de standaard instellingen niet worden overschreven. Bijwerken zet de standaard instellingen op de website, behalve op de tabs die de website niet wil overschrijven. Forceren overschrijft ook die.")}</p>
      <Sec title="Wat wordt bijgewerkt" hint="Vink tabs aan om alleen die bij te werken. Niets aangevinkt: alle tabs.">
        <div className="gs-switches">
          <label className="e2e-switch gs-sw">
            <input type="checkbox" ref={(el) => { if (el) el.indeterminate = tabs.length > 0 && tabs.length < Object.keys(TAB_NAME).length; }} checked={tabs.length === Object.keys(TAB_NAME).length} onChange={(e) => setPick(Object.fromEntries(Object.keys(TAB_NAME).map((t) => [t, e.target.checked])))} />
            <span><strong>{tx("Alles selecteren")}</strong><br /><span className="e2e-hint">{tabs.length === 0 ? tx("Niets aangevinkt: alle tabs worden bijgewerkt.") : `${tabs.length} ${tx("van")} ${Object.keys(TAB_NAME).length}`}</span></span>
          </label>
          {Object.keys(TAB_NAME).map((t) => <Sw key={t} checked={!!pick[t]} onChange={(v) => setPick((p) => ({ ...p, [t]: v }))} title={TAB_NAME[t]} />)}
        </div>
        <div className="e2e-row" style={{ gap: ".8rem 1.2rem", flexWrap: "wrap", alignItems: "center" }}>
        <label className="e2e-switch gs-sw" style={{ flex: "0 1 auto" }}>
          <input type="checkbox" ref={(el) => { if (el) el.indeterminate = chosen.length > 0 && chosen.length < ready.length; }} checked={ready.length > 0 && chosen.length === ready.length} disabled={!ready.length} onChange={(e) => setSel(Object.fromEntries(ready.map((x) => [x.id, e.target.checked])))} />
          <span><strong>{tx("Alle websites selecteren")}</strong><br /><span className="e2e-hint">{chosen.length ? `${chosen.length} ${tx("van")} ${ready.length} ${tx("geselecteerd")}` : tx("Niets geselecteerd: alle websites worden bijgewerkt.")}</span></span>
        </label>
          <button type="button" className="e2e-btn" disabled={!!busy || !count} onClick={() => run(target, false)}>{busy === `${target}-false` ? tx("Bezig…") : `${tx("Bijwerken")} (${count})`}</button>
          <button type="button" className="e2e-btn e2e-btn--outline" disabled={!!busy || !count} onClick={() => run(target, true)}>{busy === `${target}-true` ? tx("Bezig…") : `${tx("Forceren")} (${count})`}</button>
        </div>
      </Sec>
      <Sec title="Websites" hint={d.captured_at ? `${tx("Standaard instellingen opgeslagen op")} ${new Date(d.captured_at).toLocaleString()}` : "Er zijn nog geen standaard instellingen opgeslagen."}>
        {!d.sites.length ? <p className="e2e-hint">{tx("Er zijn nog geen websites aangemeld.")}</p> : (
          <>
            <div className="gs-sitelist">
              {d.sites.map((s) => {
                const r = res.find((x) => x.id === s.id);
                const can = s.status === "active" && s.has_callback;
                const err = r?.errors?.[0] || s.error;
                return (
                  <div key={s.id} className="gs-site">
                    <div className="gs-site-head">
                      <label className="e2e-switch gs-sw" style={{ flex: "1 1 auto", minWidth: 0 }}>
                        <input type="checkbox" checked={!!sel[s.id]} disabled={!can} onChange={(e) => setSel((x) => ({ ...x, [s.id]: e.target.checked }))} />
                        <span style={{ minWidth: 0 }}><strong>{s.name}</strong><br /><span className="e2e-hint">{(s.url || "").replace(/^https?:\/\//, "")}{s.build ? ` · build ${s.build}` : ""}{s.status !== "active" ? ` · ${tx(s.status === "pending" ? "wacht op goedkeuring" : "geblokkeerd")}` : !s.has_callback ? ` · ${tx("nog geen koppelsleutel")}` : ""}</span></span>
                      </label>
                      <span className="gs-site-btns">
                        <button type="button" className="e2e-btn e2e-btn--sm" disabled={!!busy || !can} onClick={() => run([s.id], false)}>{tx("Bijwerken")}</button>
                        <button type="button" className="e2e-btn e2e-btn--sm e2e-btn--outline" disabled={!!busy || !can} onClick={() => run([s.id], true)}>{tx("Forceren")}</button>
                      </span>
                    </div>
                    <div className="gs-chips">
                      {Object.keys(TAB_NAME).map((t) => <span key={t} className={`gs-chip ${stateOf(s, t)}`} title={stateOf(s, t) === "keep" ? tx("niet overschrijven") : tx("bijwerken")}>{tx(TAB_NAME[t])}{stateOf(s, t) === "keep" ? ` · ${tx("niet overschrijven")}` : ""}</span>)}
                    </div>
                    <div className="e2e-hint">{s.pushed_at ? `${tx("Laatst bijgewerkt")}: ${new Date(s.pushed_at).toLocaleString()}${s.forced ? ` · ${tx("geforceerd")}` : ""}` : tx("Nog niet bijgewerkt vanaf de server.")}{s.kept?.length ? ` · ${tx("Niet overschreven")}: ${s.kept.map((t) => tx(TAB_NAME[t])).join(", ")}` : ""}</div>
                    {err && <div className="e2e-error">{err}</div>}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Sec>
    </div>
  );
}

// Super admin: the data of the default easy2edit server. They go with every installation (together with the default settings).
export default function GlobalSettings() {
  const { user } = useAuth();
  const plus = !!user?.is_superadmin_plus;
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("server");
  const [rsTab, setRsTab] = useState("company");  // the parts of the standard reseller and of the two-step tab: one at a time, so nothing has to be scrolled
  const [tfTab, setTfTab] = useState("verify");
  const [data, setData] = useState(null);  // {values, defaults}
  const [form, setForm] = useState({});
  const [info, setInfo] = useState(null);  // the saved default settings
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  const [test, setTest] = useState(null);  // the result of "Verbinding testen"
  const [sec, setSec] = useState(null);  // the security settings that go with every installation: {twofa, basic, avail}
  const load = () => Promise.all([api("/system/global-settings/"), api("/system/site-defaults/").catch(() => ({ exists: false }))]).then(([g, i]) => { setData(g); setForm(g.values); setInfo(i); }).catch((e) => setMsg({ ok: false, text: errorText(e) }));
  useEffect(() => { if (plus) load(); }, [plus]);  // eslint-disable-line react-hooks/exhaustive-deps
  const loadSec = () => api("/security/settings/").then((r) => setSec({ twofa: { ...r.settings.twofa }, basic: { login_max_attempts: r.settings.basic.login_max_attempts, lockout_minutes: r.settings.basic.lockout_minutes }, avail: r.twofa_availability || {} })).catch((e) => setMsg({ ok: false, text: errorText(e) }));
  useEffect(() => { if (open && tab === "twofa" && !sec) loadSec(); }, [open, tab]);  // eslint-disable-line react-hooks/exhaustive-deps
  const setTf = (k, v) => setSec((x) => ({ ...x, twofa: { ...x.twofa, [k]: v } }));
  const setBasic = (k, v) => setSec((x) => ({ ...x, basic: { ...x.basic, [k]: v } }));
  const save = async (asDefault) => {
    setBusy(asDefault ? "default" : "save"); setMsg(null);
    try {
      if (tab === "twofa" && sec) {  // the two-step verification and the blocking: saved in the security settings, which are part of the default settings
        const { texts, ...tf } = sec.twofa;
        await api("/security/settings/", { method: "PUT", body: { twofa: tf, basic: sec.basic } });
      }
      const g = await api("/system/global-settings/", { method: "PUT", body: form });
      setData(g); setForm(g.values);
      if (g.values.source_mode === "easy2edit") await checkSource(true);  // saving with the easy2edit server as the source: check at once and say so in a pop-up when it cannot give the library
      if (asDefault) { const i = await api("/system/site-defaults/", { method: "POST", body: { action: "capture" } }); setInfo(i); }
      setMsg({ ok: true, text: asDefault ? tx("Opgeslagen en als standaard meegegeven met elke installatie.") : tx("Opgeslagen.") });
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy("");
  };
  const checkSource = async (quiet = false) => {
    try {
      const r = await api("/system/global-settings/", { method: "POST", body: { action: "test_source" } });
      if (r.ok) { if (!quiet) setTest({ ok: true, text: tx("{0} onderdelen gevonden bij de easy2edit-server.", r.message) }); return true; }
      setTest(null);
      await showSourceNotice(r.source);  // the pop-up: what has to be switched on
    } catch (e) { setTest({ ok: false, text: errorText(e) }); }
    return false;
  };
  const testSource = async () => { setBusy("test"); setTest(null); await checkSource(); setBusy(""); };
  const back = async () => {
    if (!(await confirmDialog(tx("De standaardwaarden terugzetten? Je ingevulde gegevens van de easy2edit-server worden vervangen."), { okLabel: tx("Terugzetten"), cancelLabel: tx("Annuleren") }))) return;
    setForm({ ...data.defaults }); setMsg(null);
  };
  const v = data?.values;
  // the data of the easy2edit server: shown to every superadmin with a lock; only a superadmin+ opens it
  return (
    <>
      <SuperTile helpKey="global-settings" icon={IconSettings} label={tx("Standaard en globale instellingen")} title={tx("easy2edit beheer")} lock
        text={v ? `*.${v.base_domain} · ${v.api_url.replace(/^https?:\/\//, "")}` : ""}
        footer={
          <button type="button" className="btn sm primary" onClick={() => { if (!plus) return alertDialog(tx("Dit onderdeel is alleen voor een superadmin+.")); setOpen(true); setMsg(null); setTab("server"); if (data) setForm(data.values); }}>{tx("Instellingen")}</button>
        } />
      {open && data && (
        <div className="overlay" onClick={() => setOpen(false)}>
          <div className="card modal wide" role="dialog" aria-label={tx("Standaard en globale instellingen")} style={{ width: "min(1080px, 96vw)", maxWidth: "96vw", maxHeight: "92vh", padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
            <KitScope tag="ui-form-fields" className="sw-col">
              <div className="sw-wrap">
                <div style={{ padding: "1.3rem 1.6rem 0", borderBottom: "1px solid var(--e2e-line, var(--line, rgba(0,0,0,.12)))", display: "grid", gap: "1rem", flex: "0 0 auto" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
                    <div style={{ display: "flex", gap: ".9rem", alignItems: "center", minWidth: 0 }}>
                      <span aria-hidden="true" style={{ display: "inline-flex", width: 44, height: 44, borderRadius: "var(--e2e-radius, 10px)", alignItems: "center", justifyContent: "center", background: "var(--e2e-primary-soft, rgba(0,0,0,.06))", color: "var(--e2e-primary)", flex: "0 0 auto" }}><span style={{ display: "inline-flex", width: 24, height: 24 }}><IconSettings /></span></span>
                      <div style={{ minWidth: 0 }}>
                        <h2 style={{ margin: 0 }}>{tx("Standaard en globale instellingen")}<PlusLock /></h2>
                        <span className="e2e-hint">{tx("De gegevens van de standaard easy2edit-server. Ze gaan mee met elke installatie.")}</span>
                      </div>
                    </div>
                    <button type="button" className="e2e-btn e2e-btn--ghost e2e-btn--sm" aria-label={tx("Sluiten")} title={tx("Sluiten")} onClick={() => setOpen(false)} style={{ flex: "0 0 auto", padding: ".4rem" }}><span style={{ display: "inline-flex", width: 18, height: 18 }}><IconX /></span></button>
                  </div>
                  <div className="e2e-tabs gs-tabs" data-easy2edit-tag="ui-tabs"><div className="e2e-tabs__list" role="tablist">
                    {TABS.map(([k, label, Icon]) => <button key={k} type="button" role="tab" className="e2e-tabs__tab" aria-selected={tab === k} onClick={() => setTab(k)}><span style={{ display: "inline-flex", width: 16, height: 16, marginRight: ".4rem" }}><Icon /></span>{tx(label)}</button>)}
                  </div></div>
                </div>
                <div className="sw-body" style={{ padding: "1.3rem 1.6rem" }}>
                  {tab === "server" && (
                    <div className="e2e-grid" style={{ "--e2e-min": "300px" }}>
                      {FIELDS.map(([k, label, ph, hint], i) => (
                        <div key={k} className="e2e-field" style={i === 0 ? undefined : undefined}>
                          <label className="e2e-label" htmlFor={`gs-${k}`}>{tx(label)}</label>
                          <input id={`gs-${k}`} className="e2e-input" value={form[k] || ""} placeholder={ph} autoComplete="off" spellCheck={false} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                          <span className="e2e-hint">{tx(hint)}</span>
                        </div>
                      ))}
                      <LocalOnly tab="server" form={form} setForm={setForm} />
                    </div>
                  )}
                  {tab === "settings" && (
                    <div className="e2e-stack" style={{ gap: "1rem" }}>
                      <p style={{ margin: 0 }}>{tx("Deze gegevens gaan standaard mee met elke nieuwe installatie en worden bij elke update bijgewerkt, samen met de standaard instellingen. Een nieuwe installatie, een reset en Standaard toepassen zetten ze terug. Per tab kun je kiezen dat iets alleen lokaal blijft.")}</p>
                      <div className="e2e-alert" role="status" data-easy2edit-tag="ui-alerts"><span className="e2e-alert__icon">i</span><div>{info?.exists ? `${tx("Standaard instellingen opgeslagen op")} ${new Date(info.captured_at).toLocaleString()}` : tx("Nog niets opgeslagen")}</div></div>
                      <div className="gs-two">
                        <Sec title="Bron van de bibliotheek">
                        <label className="e2e-switch" style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", gap: ".75rem" }}>
                        <input type="checkbox" checked={form.source_mode === "easy2edit"} onChange={(e) => { setForm({ ...form, source_mode: e.target.checked ? "easy2edit" : "local" }); setTest(null); }} />
                        <span><strong>{tx("Bron: easy2edit-server gebruiken")}</strong><br /><span className="e2e-hint">{tx("Uit: de bibliotheek (plugins, thema's, talen en componenten) komt uit de map resource van deze installatie. Aan: ze komt van de easy2edit-server (het API-adres hiervoor), zodat die map niet in elke installatie hoeft te staan.")}</span></span>
                      </label>
                      <div className="e2e-alert" role="status" data-easy2edit-tag="ui-alerts"><span className="e2e-alert__icon">i</span><div>{tx("Bron nu")}: <strong>{form.source_mode === "easy2edit" ? tx("easy2edit-server ({0})", (form.api_url || "").replace(/^https?:\/\//, "")) : tx("Lokaal (de map resource van deze installatie)")}</strong></div></div>
                      {test && <div className="e2e-alert" role="status" data-easy2edit-tag="ui-alerts"><span className="e2e-alert__icon">{test.ok ? <IconCheck width={14} height={14} /> : "!"}</span><div>{test.text}</div></div>}
                        </Sec>
                        <Sec title="Energie-label op de website" hint="De groene energie-info van deze website.">
                        <Sw checked={form.energy_badge === "1"} onChange={(v) => setForm((f) => ({ ...f, energy_badge: v ? "1" : "0" }))} title="Energie-label tonen op de website" hint="Een groene boom naast “© easy2edit” onderaan elke pagina. Een klik toont de inzichten en de groene status. Uit: bezoekers zien niets." />
                        {form.energy_badge === "1" && (
                          <div className="gs-checklist">
                            <small className="e2e-hint">{tx("De groene status staat er altijd. Kies wat daarnaast te zien is.")}</small>
                            {[["rating", "Label (A+ t/m F)"], ["co2", "CO2 per paginabezoek"], ["size", "Gemiddeld paginagewicht"], ["energy", "Stroom per paginabezoek"], ["views", "Aantal paginabezoeken"], ["live", "Grafiek stroomgebruik (24 uur)"], ["compare", "Vergelijking met een gemiddelde webpagina"]].map(([k, l]) => {
                              const on = (form.energy_badge_show || "").split(",").includes(k);
                              return <label key={k} className="gs-check"><input type="checkbox" checked={on} onChange={(e) => setForm((f) => { const cur = (f.energy_badge_show || "").split(",").filter(Boolean); const next = e.target.checked ? [...cur, k] : cur.filter((x) => x !== k); return { ...f, energy_badge_show: next.join(",") }; })} /><span>{tx(l)}</span></label>;
                            })}
                          </div>
                        )}
                        </Sec>
                      </div>
                      <LocalOnly tab="settings" form={form} setForm={setForm} />
                    </div>
                  )}
                  {tab === "licence" && (
                    <div className="e2e-stack" style={{ gap: "1rem" }}>
                      <p style={{ margin: 0 }}>{tx("Wat er gebeurt als de licentie niet meer geldig is. Elke fase duurt zoveel dagen, geteld vanaf de einddatum van de licentie.")}</p>
                      {/* three rows with the same four columns (names, then the day fields, then the explanations): so the fields are on one line, whatever the length of a name */}
                      <div className="gs-phases" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", columnGap: "1.4rem", rowGap: ".55rem", alignItems: "start" }}>
                        {PHASES.map(([k, label], i) => (
                          <label key={`l${k}`} className="e2e-label" htmlFor={`gs-${k}`} style={{ display: "flex", alignItems: "flex-start", gap: ".5rem", margin: 0 }}>
                            <span style={{ display: "inline-flex", flex: "0 0 22px", width: 22, height: 22, borderRadius: "50%", background: "var(--e2e-primary)", color: "var(--e2e-on-primary, #fff)", alignItems: "center", justifyContent: "center", fontSize: ".75rem" }}>{i + 1}</span>
                            <span>{tx(label)}</span>
                          </label>
                        ))}
                        {PHASES.map(([k]) => (
                          <div key={`i${k}`} style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
                            <input id={`gs-${k}`} className="e2e-input" type="number" min="0" max="365" inputMode="numeric" value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} style={{ width: 96 }} />
                            <span className="e2e-hint">{tx("dagen")}</span>
                          </div>
                        ))}
                        {PHASES.map(([k, , hint]) => <span key={`h${k}`} className="e2e-hint">{tx(hint)}</span>)}
                      </div>
                      <div className="e2e-alert" role="status" data-easy2edit-tag="ui-alerts"><span className="e2e-alert__icon">i</span><div><strong>{tx("Samen")}:</strong> {tx("{0} dagen tot de website offline gaat.", (Number(form.grace_1) || 0) + (Number(form.grace_2) || 0) + (Number(form.grace_3) || 0))}</div></div>
                      <label className="e2e-switch" style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", gap: ".75rem" }}>
                        <input type="checkbox" checked={form.grace_reminder !== "0"} onChange={(e) => setForm({ ...form, grace_reminder: e.target.checked ? "1" : "0" })} />
                        <span><strong>{tx("Dagelijks een herinnering mailen")}</strong><br /><span className="e2e-hint">{tx("Elke dag een e-mail aan de beheerder zolang de licentie niet is bijgewerkt.")}</span></span>
                      </label>
                      <LocalOnly tab="licence" form={form} setForm={setForm} />
                    </div>
                  )}
                  {tab === "mails" && (
                    <div className="e2e-stack" style={{ gap: "1rem" }}>
                      <p style={{ margin: 0 }}>{tx("Wie krijgt een e-mail als een licentie verandert (aangemaakt, verlengd, gewijzigd, nieuw nummer, verwijderd, abonnement gestart of gestopt). Meerdere adressen scheid je met een komma.")}</p>
                      <div className="e2e-grid" style={{ "--e2e-min": "300px" }}>
                        {NOTIFY.map(([k, label, hint]) => (
                          <div key={k} className="e2e-field">
                            <label className="e2e-label" htmlFor={`gs-${k}`}>{label}</label>
                            <input id={`gs-${k}`} className="e2e-input" type="text" inputMode="email" autoComplete="off" spellCheck={false} placeholder="naam@bedrijf.nl, naam2@bedrijf.nl" value={form[k] || ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                            <span className="e2e-hint">{tx(hint)}</span>
                          </div>
                        ))}
                      </div>
                      <LocalOnly tab="mails" form={form} setForm={setForm} />
                    </div>
                  )}
                  {tab === "reseller" && (
                    <div className="e2e-stack" style={{ gap: "1.6rem" }}>
                      <Tabs tabs={[["company", "Bedrijf"], ["contact", "Contactpersoon"], ["address", "Adres"]]} value={rsTab} onChange={setRsTab} />
                      <p className="e2e-hint" style={{ margin: 0 }}>{tx("De standaard reseller: wie easy2edit verkoopt. De gegevens gaan mee met elke nieuwe installatie en worden in de licentie genoteerd. Bij de easy2edit-server wordt de reseller de reseller van een nieuwe website; daar worden ook de logins van de reseller gecontroleerd en aangemaakt.")}</p>
                      {rsTab === "company" && <Sec title="Bedrijf">
                        <div className="e2e-grid" style={{ "--e2e-min": "260px" }}>{rsField("reseller_company", "Bedrijf", form, setForm)}{rsField("reseller_website", "Website", form, setForm)}</div>
                      </Sec>}
                      {rsTab === "contact" && <Sec title="Contactpersoon" hint="Telefoonnummers altijd met landnummer.">
                        <div className="e2e-grid" style={{ "--e2e-min": "260px" }}>{rsField("reseller_contact", "Naam", form, setForm)}{rsField("reseller_email", "E-mail", form, setForm)}{rsField("reseller_phone", "Telefoon", form, setForm)}{rsField("reseller_mobile", "Mobiel", form, setForm)}</div>
                      </Sec>}
                      {rsTab === "address" && <Sec title="Adres">
                        <div className="gs-addr">
                          {rsField("reseller_street", "Straat", form, setForm)}{rsField("reseller_house_number", "Huisnummer", form, setForm)}{rsField("reseller_postal_code", "Postcode", form, setForm)}{rsField("reseller_city", "Plaats", form, setForm)}{rsField("reseller_country", "Land", form, setForm)}
                        </div>
                      </Sec>}
                      <LocalOnly tab="reseller" form={form} setForm={setForm} />
                    </div>
                  )}
                  {tab === "websites" && <WebsitesTab setMsg={setMsg} />}
                  {tab === "twofa" && (
                    <div className="e2e-stack" style={{ gap: "1.6rem" }}>
                      {!sec ? <p className="e2e-hint">{<Loading compact />}</p> : (
                        <>
                          <Tabs tabs={[["verify", "Verificatie"], ["methods", "Hoe de code komt"], ["block", "Blokkeren"]]} value={tfTab} onChange={setTfTab} />
                          {tfTab === "verify" && <Sec title="Twee-staps verificatie" hint="De standaard voor elke nieuwe installatie en elke update.">
                            <Sw checked={sec.twofa.enabled} onChange={(v) => setTf("enabled", v)} title="Twee-staps verificatie ingeschakeld" hint="Inloggen met een code per e-mail of een authenticator-app." />
                            <Sw checked={sec.twofa.required_for === "admins" || sec.twofa.required_for === "all"} onChange={(v) => setTf("required_for", v ? "admins" : "none")} title="Verplicht voor admins en superadmins" hint="Standaard aan. Wie het nog niet aan heeft, krijgt bij elke login het scherm om het te activeren en kan pas verder als het aan staat." />
                            <Sw checked={sec.twofa.required_for === "all"} onChange={(v) => setTf("required_for", v ? "all" : "admins")} title="Ook verplicht voor alle andere gebruikers" hint="Ook bij het aanmelden. Admins en superadmins blijven dan verplicht." />
                            <div className="e2e-grid" style={{ "--e2e-min": "260px" }}>
                              <Num id="gs-tf-code" label="Code geldig" unit="minuten" min="1" max="60" value={sec.twofa.code_minutes} onChange={(e) => setTf("code_minutes", e.target.value)} />
                              <div className="e2e-field"><label className="e2e-label" htmlFor="gs-tf-iss">{tx("Naam in de authenticator-app")}</label><input id="gs-tf-iss" className="e2e-input" maxLength={60} placeholder="easy2edit" value={sec.twofa.app_issuer || ""} onChange={(e) => setTf("app_issuer", e.target.value)} /></div>
                            </div>
                          </Sec>}
                          {tfTab === "methods" && <Sec title="Hoe de code komt" hint="Wat een gebruiker mag kiezen. Sms staat er alleen als een sms-koppeling is getest en tegoed heeft.">
                            <div className="gs-switches">
                              <Sw checked={sec.twofa.allow_app} onChange={(v) => setTf("allow_app", v)} title="Authenticator-app" hint="Werkt ook zonder internet." />
                              <Sw checked={sec.twofa.allow_email} onChange={(v) => setTf("allow_email", v)} title="Code per e-mail" />
                              {sec.avail.sms && <Sw checked={sec.twofa.allow_sms} onChange={(v) => setTf("allow_sms", v)} title="Code per sms" />}
                            </div>
                          </Sec>}
                          {tfTab === "block" && <Sec title="Account blokkeren" hint="Na te veel fouten wordt een account tijdelijk geblokkeerd. De beheerder krijgt dan altijd een e-mail.">
                            <div className="e2e-grid" style={{ "--e2e-min": "260px" }}>
                              <Num id="gs-lg-max" label="Foute wachtwoorden" unit="keer" hint="Daarna wordt het account geblokkeerd." min="1" max="20" value={sec.basic.login_max_attempts} onChange={(e) => setBasic("login_max_attempts", e.target.value)} />
                              <Num id="gs-tf-max" label="Foute codes" unit="keer" hint="Daarna is de code ongeldig." min="1" max="10" value={sec.twofa.max_attempts} onChange={(e) => setTf("max_attempts", e.target.value)} />
                              <Num id="gs-lg-min" label="Blokkeertijd" unit="minuten" hint="Hoe lang het account dicht blijft." min="1" max="1440" value={sec.basic.lockout_minutes} onChange={(e) => setBasic("lockout_minutes", e.target.value)} />
                            </div>
                          </Sec>}
                        </>
                      )}
                      <LocalOnly tab="twofa" form={form} setForm={setForm} />
                    </div>
                  )}
                </div>
                <div className="e2e-row sw-foot" style={{ justifyContent: "space-between", gap: ".7rem", flexWrap: "wrap", alignItems: "center" }} data-easy2edit-tag="ui-button-variants">
                  <span className={msg ? (msg.ok ? "e2e-hint" : "e2e-error") : "e2e-hint"} role="status" style={{ flex: "1 1 220px", minWidth: 0 }}>{msg?.text || ""}</span>
                  <div className="e2e-row" style={{ gap: ".6rem", flexWrap: "wrap" }}>
                    {tab === "server" && <button type="button" className="e2e-btn e2e-btn--ghost" disabled={!!busy} onClick={back}>{tx("Standaardwaarden terugzetten")}</button>}
                    {tab === "settings" && data.values.source_mode === "easy2edit" && <button type="button" className="e2e-btn e2e-btn--outline" disabled={!!busy} onClick={testSource}>{busy === "test" ? tx("Bezig…") : tx("Verbinding testen")}</button>}
                    {tab !== "websites" && <button type="button" className="e2e-btn" disabled={!!busy} onClick={() => save(true)}>{busy === "default" ? tx("Bezig…") : tx("Opslaan en als standaard meegeven")}</button>}
                  </div>
                </div>
              </div>
            </KitScope>
          </div>
        </div>
      )}
    </>
  );
}
