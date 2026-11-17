// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { IconGlobe, IconRefresh, IconSettings, IconSliders } from "./Icons";
import SuperTile from "./SuperTile";
import PlusLock from "./PlusLock";
import Tabs from "./Tabs";
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
      <SuperTile icon={IconSettings} label={tx("Standaard en globale instellingen")} title={tx("easy2edit instellingen")} lock
        text={v ? `*.${v.base_domain} · ${v.api_url.replace(/^https?:\/\//, "")}` : ""}
        footer={
          <button type="button" className="btn sm primary" onClick={() => { if (!plus) return alertDialog(tx("Dit onderdeel is alleen voor een superadmin+.")); setOpen(true); setMsg(null); setTab("server"); if (data) setForm(data.values); }}>{tx("Instellingen")}</button>
        } />
      {open && data && (
        <div className="overlay" onClick={() => setOpen(false)}>
          <div className="card modal wide" style={{ width: "min(720px, 94vw)", maxWidth: "94vw", display: "flex", flexDirection: "column", gap: ".8rem" }} onClick={(e) => e.stopPropagation()}>
            <div className="row between" style={{ alignItems: "center" }}>
              <h2 style={{ margin: 0 }}>{tx("Standaard en globale instellingen")}<PlusLock /></h2>
              <button type="button" className="btn sm" onClick={() => setOpen(false)}>{tx("Sluiten")}</button>
            </div>
            <Tabs value={tab} onChange={setTab} tabs={[["server", "Easy2edit-server", <IconGlobe key="s" />], ["settings", "Instellingen", <IconSliders key="t" />], ["ship", "Meegeven met installatie", <IconSettings key="m" />]]} />
            {tab === "server" && (
              <div className="form" style={{ display: "grid", gap: ".9rem" }}>
                {FIELDS.map(([k, label, ph, hint]) => (
                  <label key={k}>{tx(label)}
                    <input value={form[k] || ""} placeholder={ph} autoComplete="off" spellCheck={false} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                    <small className="muted">{tx(hint)}</small>
                  </label>
                ))}
                <div className="row" style={{ justifyContent: "flex-start", gap: ".5rem", flexWrap: "wrap" }}>
                  <button type="button" className="btn primary" disabled={!!busy} onClick={() => save(false)}>{busy === "save" ? tx("Bezig…") : tx("Opslaan")}</button>
                  <button type="button" className="btn" disabled={!!busy} onClick={back}>{tx("Standaardwaarden terugzetten")}</button>
                </div>
              </div>
            )}
            {tab === "settings" && (
              <div style={{ display: "grid", gap: ".9rem" }}>
                <label className="check sec-toggle">
                  <span className="switch"><input type="checkbox" checked={form.source_mode === "easy2edit"} onChange={(e) => { setForm({ ...form, source_mode: e.target.checked ? "easy2edit" : "local" }); setTest(null); }} /><span /></span>
                  <span>{tx("Bron: easy2edit-server gebruiken")}<small className="muted" style={{ display: "block" }}>{tx("Uit: de bibliotheek (plugins, thema's, talen en componenten) komt uit de map resource van deze installatie. Aan: ze komt van de easy2edit-server (het API-adres hiervoor), zodat die map niet op elke installatie hoeft te staan.")}</small></span>
                </label>
                <small className="muted">{tx("Bron nu")}: <strong>{form.source_mode === "easy2edit" ? tx("easy2edit-server ({0})", (form.api_url || "").replace(/^https?:\/\//, "")) : tx("Lokaal (de map resource van deze installatie)")}</strong></small>
                <div className="row" style={{ justifyContent: "flex-start", gap: ".5rem", flexWrap: "wrap" }}>
                  <button type="button" className="btn primary" disabled={!!busy} onClick={() => save(false)}>{busy === "save" ? tx("Bezig…") : tx("Opslaan")}</button>
                  {data.values.source_mode === "easy2edit" && <button type="button" className="btn" disabled={!!busy} onClick={testSource}><IconRefresh /> {busy === "test" ? tx("Bezig…") : tx("Verbinding testen")}</button>}
                </div>
                {test && <div className={test.ok ? "alert ok" : "alert"}>{test.text}</div>}
              </div>
            )}
            {tab === "ship" && (
              <div style={{ display: "grid", gap: ".8rem" }}>
                <p style={{ margin: 0 }}>{tx("Deze gegevens gaan standaard mee met elke installatie, samen met de standaard instellingen. Een nieuwe installatie, een reset en Standaard toepassen zetten ze terug.")}</p>
                <small className="muted">{info?.exists ? `${tx("Standaard instellingen opgeslagen op")} ${new Date(info.captured_at).toLocaleString()}` : tx("Nog niets opgeslagen")}</small>
                <div className="row" style={{ justifyContent: "flex-start", gap: ".5rem", flexWrap: "wrap" }}>
                  <button type="button" className="btn primary" disabled={!!busy} onClick={() => save(true)}>{busy === "default" ? tx("Bezig…") : tx("Opslaan en als standaard meegeven")}</button>
                </div>
              </div>
            )}
            {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
          </div>
        </div>
      )}
    </>
  );
}
