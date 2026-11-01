// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { api, errorText } from "../lib/api";
import { confirmDialog } from "../lib/dialog";
import { tx } from "../lib/t";
import SmallEditor from "./SmallEditor";
import Tabs from "./Tabs";

// Super admin: the terms and conditions in every language. Tabs: the text (a tab per language), the signatures. A new version has to be signed again by every admin and superadmin.
export default function TermsAdmin() {
  const [d, setD] = useState(null);
  const [texts, setTexts] = useState({});
  const [lang, setLang] = useState("nl");
  const [tab, setTab] = useState("text");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  const [dirty, setDirty] = useState(false);
  const take = (r) => { setD(r); setTexts(r.texts || {}); setDirty(false); };
  useEffect(() => { api("/system/terms/admin/").then(take).catch((e) => setMsg({ ok: false, text: errorText(e) })); }, []);
  if (!d) return msg ? <div className="alert">{msg.text}</div> : <p className="muted">{tx("Laden…")}</p>;

  const cur = texts[lang] || { title: "", body: "" };
  const set = (patch) => { setTexts((t) => ({ ...t, [lang]: { ...(t[lang] || { title: "", body: "" }), ...patch } })); setDirty(true); };
  const run = async (key, fn, ok) => { setBusy(key); setMsg(null); try { const r = await fn(); take(r); if (ok) setMsg({ ok: true, text: ok }); } catch (e) { setMsg({ ok: false, text: errorText(e) }); } setBusy(""); };
  const save = () => run("save", () => api("/system/terms/admin/", { method: "PUT", body: { texts } }), tx("Concept opgeslagen."));
  const publish = async () => {
    if (!(await confirmDialog(tx("Een nieuwe versie van de voorwaarden publiceren? Alle beheerders en superadmins moeten daarna opnieuw ondertekenen."), { title: tx("Nieuwe versie publiceren"), okLabel: tx("Publiceren") }))) return;
    run("publish", () => api("/system/terms/admin/publish/", { method: "POST", body: { texts } }), tx("De nieuwe versie is gepubliceerd."));
  };
  const translate = async (from) => run("tr", () => api("/system/terms/admin/translate/", { method: "POST", body: { from, to: lang } }), tx("Vertaald. Controleer de tekst voordat je publiceert."));
  const reset = async () => {
    if (!(await confirmDialog(tx("De standaardtekst (Nederlands en Engels) als concept terugzetten? Je huidige concept gaat verloren."), { title: tx("Standaardtekst terugzetten"), okLabel: tx("Terugzetten") }))) return;
    run("reset", () => api("/system/terms/admin/reset/", { method: "POST", body: {} }));
  };
  const others = Object.keys(texts).filter((k) => k !== lang && texts[k]?.body);

  return (
    <div className="stack" style={{ gap: ".8rem" }}>
      <p className="muted" style={{ margin: 0 }}>{tx("De algemene voorwaarden van easy2edit. Beheerders en superadmins ondertekenen ze met een code per e-mail. Bij een nieuwe versie moet iedereen opnieuw ondertekenen.")} {tx("Gepubliceerde versie")}: <strong>{d.version}</strong>{d.has_draft || dirty ? ` · ${tx("er is een concept")}` : ""}</p>
      <Tabs value={tab} onChange={setTab} tabs={[["text", tx("Tekst")], ["sign", `${tx("Handtekeningen")} (${d.signed_count})`]]} />
      {tab === "text" && (
        <>
          <Tabs value={lang} onChange={setLang} tabs={d.langs.map((l) => [l.code, l.native_name || l.name])} />
          <label className="field"><span>{tx("Titel")}</span><input value={cur.title} maxLength={200} onChange={(e) => set({ title: e.target.value })} /></label>
          <SmallEditor value={cur.body} onChange={(v) => set({ body: v })} minHeight={320} maxLength={60000} />
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: ".5rem" }}>
            <span className="row" style={{ justifyContent: "flex-start", gap: ".5rem", flexWrap: "wrap" }}>
              {others.slice(0, 2).map((k) => <button key={k} type="button" className="btn" disabled={!!busy} onClick={() => translate(k)}>{tx("Vertalen met AI vanuit")} {k.toUpperCase()}</button>)}
              <button type="button" className="btn" disabled={!!busy} onClick={reset}>{tx("Standaardtekst terugzetten")}</button>
            </span>
            <span className="row" style={{ gap: ".5rem" }}>
              <button type="button" className="btn" disabled={!!busy || !dirty} onClick={save}>{tx("Concept opslaan")}</button>
              <button type="button" className="btn primary" disabled={!!busy} onClick={publish}>{tx("Nieuwe versie publiceren")}</button>
            </span>
          </div>
        </>
      )}
      {tab === "sign" && (
        <div className="res-list">
          {d.signatures.length === 0 && <p className="muted">{tx("Nog niemand heeft deze versie ondertekend.")}</p>}
          {d.signatures.map((s, i) => (
            <div key={i} className="res-item" style={{ gridTemplateColumns: "minmax(0,1fr) 120px 180px" }}>
              <div className="res-main"><strong>{s.name}</strong><small className="muted">{s.email}</small></div>
              <span>{s.role === "superadmin" ? tx("Super admin") : tx("Admin")}</span>
              <span className="muted">{new Date(s.signed_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
      {msg && <div className={`alert ${msg.ok ? "ok" : ""}`}>{msg.text}</div>}
    </div>
  );
}
