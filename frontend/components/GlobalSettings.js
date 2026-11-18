// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { IconCheck, IconGlobe, IconMail, IconSettings, IconShield, IconSliders, IconX } from "./Icons";
import KitScope from "../lib/ui-kit/KitScope";
import SuperTile from "./SuperTile";
import PlusLock from "./PlusLock";
import { useAuth } from "./AuthContext";
import { api, errorText } from "../lib/api";
import { alertDialog, confirmDialog } from "../lib/dialog";
import { showSourceNotice } from "../lib/sourceNotice";
import { tx } from "../lib/t";

const FIELDS = [
  ["base_domain", "Basisdomein", "easy2edit.com", "De websites van easy2edit zijn naam.basisdomein, bijvoorbeeld siten.easy2edit.com."],
  ["api_url", "API van easy2edit", "https://api.easy2edit.com", "Het adres van de API van de standaard easy2edit-server."],
  ["site_url", "Website van easy2edit", "https://easy2edit.com", "De website van easy2edit zelf (informatie en de vermelding onderaan een pagina)."],
];

const PHASES = [["grace_1", "Fase 1: volledige toegang", "Alles werkt nog; er staat een melding in de site en bij het inloggen."], ["grace_2", "Fase 2: geen pagina-editor", "Pagina's kunnen niet meer worden gewijzigd."], ["grace_3", "Fase 3: geen beheer, alleen de licentie bijwerken", "Beheerders kunnen alleen nog de licentie bijwerken."], ["grace_4", "Fase 4: website offline", "Daarna blijft de website offline tot de licentie is bijgewerkt."]];
const NOTIFY = [["notify_rstcc", "RST CC", "De eigenaar van easy2edit."], ["notify_reseller", "Reseller", "Leeg: het e-mailadres van de reseller op de licentie zelf."], ["notify_invoicing", "Invoicing", "De administratie die de facturen maakt."], ["notify_support", "Support", "Het supportteam."]];
const TABS = [["server", "Easy2edit-server", IconGlobe], ["settings", "Instellingen", IconSliders], ["licence", "Licentieregels", IconShield], ["mails", "Licentie-e-mails", IconMail], ["ship", "Meegeven met installatie", IconSettings]];

// Super admin: the data of the default easy2edit server. They go with every installation (together with the default settings).
export default function GlobalSettings() {
  const { user } = useAuth();
  const plus = !!user?.is_superadmin_plus;
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("server");
  const [data, setData] = useState(null);  // {values, defaults}
  const [form, setForm] = useState({});
  const [info, setInfo] = useState(null);  // the saved default settings
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  const [test, setTest] = useState(null);  // the result of "Verbinding testen"
  const load = () => Promise.all([api("/system/global-settings/"), api("/system/site-defaults/").catch(() => ({ exists: false }))]).then(([g, i]) => { setData(g); setForm(g.values); setInfo(i); }).catch((e) => setMsg({ ok: false, text: errorText(e) }));
  useEffect(() => { if (plus) load(); }, [plus]);  // eslint-disable-line react-hooks/exhaustive-deps
  const save = async (asDefault) => {
    setBusy(asDefault ? "default" : "save"); setMsg(null);
    try {
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
      <SuperTile helpKey="global-settings" icon={IconSettings} label={tx("Standaard en globale instellingen")} title={tx("easy2edit instellingen")} lock
        text={v ? `*.${v.base_domain} · ${v.api_url.replace(/^https?:\/\//, "")}` : ""}
        footer={
          <button type="button" className="btn sm primary" onClick={() => { if (!plus) return alertDialog(tx("Dit onderdeel is alleen voor een superadmin+.")); setOpen(true); setMsg(null); setTab("server"); if (data) setForm(data.values); }}>{tx("Instellingen")}</button>
        } />
      {open && data && (
        <div className="overlay" onClick={() => setOpen(false)}>
          <div className="card modal wide" role="dialog" aria-label={tx("Standaard en globale instellingen")} style={{ width: "min(900px, 96vw)", maxWidth: "96vw", maxHeight: "92vh", padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
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
                    </div>
                  )}
                  {tab === "settings" && (
                    <div className="e2e-stack" style={{ gap: "1rem" }}>
                      <label className="e2e-switch" style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", gap: ".75rem" }}>
                        <input type="checkbox" checked={form.source_mode === "easy2edit"} onChange={(e) => { setForm({ ...form, source_mode: e.target.checked ? "easy2edit" : "local" }); setTest(null); }} />
                        <span><strong>{tx("Bron: easy2edit-server gebruiken")}</strong><br /><span className="e2e-hint">{tx("Uit: de bibliotheek (plugins, thema's, talen en componenten) komt uit de map resource van deze installatie. Aan: ze komt van de easy2edit-server (het API-adres hiervoor), zodat die map niet in elke installatie hoeft te staan.")}</span></span>
                      </label>
                      <div className="e2e-alert" role="status" data-easy2edit-tag="ui-alerts"><span className="e2e-alert__icon">i</span><div>{tx("Bron nu")}: <strong>{form.source_mode === "easy2edit" ? tx("easy2edit-server ({0})", (form.api_url || "").replace(/^https?:\/\//, "")) : tx("Lokaal (de map resource van deze installatie)")}</strong></div></div>
                      {test && <div className="e2e-alert" role="status" data-easy2edit-tag="ui-alerts"><span className="e2e-alert__icon">{test.ok ? <IconCheck width={14} height={14} /> : "!"}</span><div>{test.text}</div></div>}
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
                    </div>
                  )}
                  {tab === "ship" && (
                    <div className="e2e-stack" style={{ gap: "1rem" }}>
                      <p style={{ margin: 0 }}>{tx("Deze gegevens gaan standaard mee met elke installatie, samen met de standaard instellingen. Een nieuwe installatie, een reset en Standaard toepassen zetten ze terug.")}</p>
                      <div className="e2e-alert" role="status" data-easy2edit-tag="ui-alerts"><span className="e2e-alert__icon">i</span><div>{info?.exists ? `${tx("Standaard instellingen opgeslagen op")} ${new Date(info.captured_at).toLocaleString()}` : tx("Nog niets opgeslagen")}</div></div>
                    </div>
                  )}
                </div>
                <div className="e2e-row sw-foot" style={{ justifyContent: "space-between", gap: ".7rem", flexWrap: "wrap", alignItems: "center" }} data-easy2edit-tag="ui-button-variants">
                  <span className={msg ? (msg.ok ? "e2e-hint" : "e2e-error") : "e2e-hint"} role="status" style={{ flex: "1 1 220px", minWidth: 0 }}>{msg?.text || ""}</span>
                  <div className="e2e-row" style={{ gap: ".6rem", flexWrap: "wrap" }}>
                    {tab === "server" && <button type="button" className="e2e-btn e2e-btn--ghost" disabled={!!busy} onClick={back}>{tx("Standaardwaarden terugzetten")}</button>}
                    {tab === "settings" && data.values.source_mode === "easy2edit" && <button type="button" className="e2e-btn e2e-btn--outline" disabled={!!busy} onClick={testSource}>{busy === "test" ? tx("Bezig…") : tx("Verbinding testen")}</button>}
                    {tab === "ship"
                      ? <button type="button" className="e2e-btn" disabled={!!busy} onClick={() => save(true)}>{busy === "default" ? tx("Bezig…") : tx("Opslaan en als standaard meegeven")}</button>
                      : <button type="button" className="e2e-btn" disabled={!!busy} onClick={() => save(false)}>{busy === "save" ? tx("Bezig…") : tx("Opslaan")}</button>}
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
