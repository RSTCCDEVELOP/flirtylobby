"use client";

import { tx } from "../../../../lib/t";
import { confirmDialog } from "../../../../lib/dialog";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import Collapsible, { CollapseAll } from "../../../../components/Collapsible";
import EmailLayoutAdmin from "../../../../components/EmailLayoutAdmin";
import { api, errorText } from "../../../../lib/api";
import { lvl } from "../../../../lib/perms";

const PURPOSES = [["all", "Alles"], ["security", "Beveiliging (inlogcodes)"], ["notifications", "Meldingen"], ["contact", "Contact en support"], ["marketing", "Marketing"]];
const purposeLabel = Object.fromEntries(PURPOSES);

const SECTIONS = [
  { kind: "email_from", title: "Afzender-e-mailadressen", hint: "Adressen waarmee het systeem e-mail mag versturen. Het adres moet bij je e-mailkoppeling (Postmark of SMTP) zijn toegestaan.", valuePlaceholder: "no-reply@jouwdomein.nl", add: "+ Afzender" },
  { kind: "email_reply", title: "Antwoord-e-mailadressen", hint: "Waar antwoorden op systeemmail naartoe gaan (Reply-To).", valuePlaceholder: "support@jouwdomein.nl", add: "+ Antwoordadres" },
  { kind: "mobile", title: "Mobiele nummers", hint: "Nummers die het systeem mag gebruiken voor contact, met landcode.", valuePlaceholder: "+31612345678", add: "+ Nummer" },
];

export default function Communication() {
  const { user } = useAuth();
  const L = lvl(user, "communication");
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState(null);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => api("/communication/").then(setItems).catch((e) => setMsg({ ok: false, text: errorText(e) })), []);
  useEffect(() => { load(); }, [load]);

  async function act(id, fn, okText) {
    setBusy(id);
    setMsg(null);
    try { const r = await fn(); if (okText || r?.detail) setMsg({ ok: true, text: r?.detail || okText }); await load(); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(null);
  }

  const toggle = (a) => act(a.id, () => api(`/communication/${a.id}/`, { method: "PATCH", body: { enabled: !a.enabled } }));
  const makeDefault = (a) => act(a.id, () => api(`/communication/${a.id}/make_default/`, { method: "POST" }));
  const test = (a) => act(a.id, () => api(`/communication/${a.id}/test/`, { method: "POST" }));
  const remove = async (a) => (await confirmDialog(tx("{0} verwijderen?", a.value), { danger: true })) && act(a.id, () => api(`/communication/${a.id}/`, { method: "DELETE" }));

  async function save(e) {
    e.preventDefault();
    const { id, error: _e, ...body } = modal;
    try {
      await (id ? api(`/communication/${id}/`, { method: "PATCH", body }) : api("/communication/", { method: "POST", body }));
      setModal(null);
      load();
    } catch (err) {
      setModal({ ...modal, error: errorText(err) });
    }
  }
  const set = (k) => (e) => setModal({ ...modal, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{tx("Communicatie")}</h1>
          <p className="muted" style={{ margin: 0 }}>{tx("De e-mailadressen en nummers die het systeem mag gebruiken. Per soort is één adres de standaard; met een doel kun je een adres voor bepaalde berichten reserveren (bijvoorbeeld inlogcodes).")}</p>
        </div>
        <CollapseAll />
      </div>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}

      <Collapsible id="comm-email-layout" title={tx("E-mailopmaak")}>
        <EmailLayoutAdmin canEdit={L >= 2} onMessage={setMsg} />
      </Collapsible>

      {SECTIONS.map((s) => {
        const list = items.filter((a) => a.kind === s.kind);
        return (
          <Collapsible key={s.kind} id={`comm-${s.kind}`} title={`${s.title} (${list.length})`}>
            <p className="muted" style={{ marginTop: 0 }}>{s.hint}</p>
            <div className="int-list">
              {list.map((a) => (
                <div className="card int-item" key={a.id}>
                  <div className="int-main">
                    <strong>{a.label} {a.is_default && <span className="badge ok" style={{ marginLeft: ".4rem" }}>{tx("Standaard")}</span>}</strong>
                    <span><code>{a.value}</code></span>
                    <span className="muted" style={{ fontSize: ".85rem" }}>{tx("Doel:")} {purposeLabel[a.purpose]}</span>
                  </div>
                  <div className="int-actions">
                    {L >= 2 && s.kind === "email_from" && <button className="btn sm" disabled={busy === a.id} onClick={() => test(a)}>{tx("Test")}</button>}
                    {L >= 2 && !a.is_default && <button className="btn sm" disabled={busy === a.id} onClick={() => makeDefault(a)}>{tx("Maak standaard")}</button>}
                    {L >= 2 && <button className="btn sm" onClick={() => setModal({ ...a })}>{tx("Wijzig")}</button>}
                    {L >= 3 && <button className="btn sm danger" onClick={() => remove(a)}>{tx("Verwijder")}</button>}
                    <label className="switch" title={a.enabled ? tx("Actief") : tx("Uit")}>
                      <input type="checkbox" checked={a.enabled} disabled={L < 2 || a.is_default} onChange={() => toggle(a)} />
                      <span />
                    </label>
                  </div>
                </div>
              ))}
              {!list.length && <p className="muted">{tx("Nog niets toegevoegd.")}</p>}
            </div>
            {L >= 3 && <button className="btn primary" style={{ marginTop: "1rem" }} onClick={() => setModal({ kind: s.kind, label: "", value: "", purpose: "all", enabled: true, is_default: false })}>{s.add}</button>}
          </Collapsible>
        );
      })}

      {modal && (
        <div className="overlay" onClick={() => setModal(null)}>
          <form className="card modal form" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h2>{modal.id ? tx("Wijzigen") : SECTIONS.find((s) => s.kind === modal.kind).add.replace("+ ", "Nieuw: ")}</h2>
            <div className="grid2">
              <label>{tx("Naam")}<input value={modal.label} onChange={set("label")} required maxLength={100} placeholder={tx("bv. Systeem")} /></label>
              <label>{modal.kind === "mobile" ? tx("Mobiel nummer") : tx("E-mailadres")}
                <input value={modal.value} onChange={set("value")} required placeholder={SECTIONS.find((s) => s.kind === modal.kind).valuePlaceholder} />
              </label>
              <label>{tx("Doel")}
                <select value={modal.purpose} onChange={set("purpose")}>{PURPOSES.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select>
              </label>
              <label className="check" style={{ alignSelf: "end" }}><input type="checkbox" checked={modal.is_default} onChange={set("is_default")} /> {tx("Standaard voor deze soort")}</label>
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
