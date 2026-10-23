"use client";

import { useEffect, useState } from "react";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";
import CodeInput from "./CodeInput";
import Tabs from "./Tabs";
import { useAuth } from "./AuthContext";
import { IconArchive, IconKey, IconMail, IconShield } from "./Icons";

// Super admin: set the standard superadmin (name, e-mail, password). It overwrites the standard superadmin; the own password is the check, and a mail goes to the addresses involved.
export default function StandardAdmin() {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("data");
  const [cur, setCur] = useState(null);
  const [f, setF] = useState({ name: "", email: "", password: "", password2: "", confirm_password: "" });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [sentTo, setSentTo] = useState(""); // the (masked) address the code went to
  const [code, setCode] = useState("");
  const [fileMsg, setFileMsg] = useState(null);
  const [fpw, setFpw] = useState(""); // the password of the standard account (opens / locks the file)
  const [own, setOwn] = useState(""); // the own password of whoever loads a file here
  const [wait, setWait] = useState(0); // seconds before the mail can be sent again
  const [resent, setResent] = useState(false);
  const [sandboxCode, setSandboxCode] = useState(false); // the sandbox is on: the code was filled in for you
  useEffect(() => { if (wait <= 0) return undefined; const t = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(t); }, [wait]);
  useEffect(() => {
    if (!open) return;
    api("/system/standard-admin/").then((c) => { setCur(c); setF((x) => ({ ...x, name: c.name || "", email: c.email || "" })); }).catch((e) => setMsg(errorText(e)));
  }, [open]);
  const close = () => { setOpen(false); setTab("data"); setMsg(null); setDone(null); setSentTo(""); setCode(""); setFileMsg(null); setFpw(""); setOwn(""); setF((x) => ({ ...x, password: "", password2: "", confirm_password: "" })); };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function sendCode() { // step 1: check everything and mail a code to the address of the old standard superadmin
    setBusy(true); setMsg(null);
    try { const r = await api("/system/standard-admin/", { method: "POST", body: f }); setSentTo(r.sent_to); setTab("code"); setWait(30); setCode(r.sandbox_code || ""); setSandboxCode(!!r.sandbox_code); }
    catch (e) { setMsg(errorText(e)); setTab(/controle/i.test(errorText(e)) ? "confirm" : "data"); }
    setBusy(false);
  }
  const download = (file, email) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(file, null, 1)], { type: "application/json" }));
    a.download = `easy2edit-config-${(email || "superadmin").replace(/[^a-z0-9@.-]/gi, "_")}.json`; a.click(); URL.revokeObjectURL(a.href);
  };
  async function saveFile(password, email) { // the encrypted config file of the standard superadmin
    setBusy(true); setFileMsg(null);
    try { const r = await api("/system/standard-admin/file/", { method: "POST", body: { action: "export", password } }); download(r.file, email); setFileMsg({ ok: true, text: tx("Het bestand is opgeslagen. Het is versleuteld met het wachtwoord van dit account.") }); }
    catch (e) { setFileMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  }
  async function loadFile(e) { // load such a file here (the password of that account opens it)
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    setBusy(true); setFileMsg(null);
    try {
      const doc = JSON.parse(await file.text());
      const r = await api("/system/standard-admin/file/", { method: "POST", body: { action: "import", file: doc, password: fpw, confirm_password: own } });
      setDone(r);
    } catch (er) { setFileMsg({ ok: false, text: er instanceof SyntaxError ? tx("Dit is geen geldig configuratiebestand.") : errorText(er) }); }
    setBusy(false);
  }
  async function resend() { // a new code, to the same address (the old code stops working)
    setBusy(true); setMsg(null); setResent(false);
    try { const r = await api("/system/standard-admin/", { method: "POST", body: f }); setSentTo(r.sent_to); setCode(r.sandbox_code || ""); setSandboxCode(!!r.sandbox_code); setWait(30); setResent(true); }
    catch (e) { setMsg(errorText(e)); }
    setBusy(false);
  }
  async function save() { // step 2: the code from that mail
    setBusy(true); setMsg(null);
    try { setDone(await api("/system/standard-admin/", { method: "POST", body: { code } })); }
    catch (e) { setMsg(errorText(e)); }
    setBusy(false);
  }
  const lab = { display: "grid", gap: ".3rem", fontSize: ".85rem", fontWeight: 600 };
  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}><IconShield /> {tx("Standaard superadmin instellen…")}</button>
      {open && (
        <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) close(); }}>
          <div className="card modal" role="dialog" aria-modal="true" style={{ maxWidth: 720, width: "100%", display: "grid", gap: "1rem" }}>
            <h3 style={{ margin: 0 }}>{tx("Standaard superadmin")}</h3>
            {done ? (
              <>
                <div className="alert ok">{tx("De standaard superadmin is ingesteld: {0} ({1}).", done.name, done.email)}</div>
                <p className="muted" style={{ margin: 0 }}>{tx("Er is een bericht gestuurd naar: {0}.", (done.mailed || []).join(", ") || "–")} {tx("Het wachtwoord staat niet in de mail.")}</p>
                <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: ".9rem 1rem", display: "grid", gap: ".5rem" }}>
                  <strong>{tx("Log opnieuw in met de nieuwe gegevens")}</strong>
                  <span className="muted">{tx("Log nu uit en log opnieuw in met {0} en het nieuwe wachtwoord, zodat je zeker weet dat de nieuwe gegevens werken.", done.email)}</span>
                </div>
                {fileMsg && <div className={fileMsg.ok ? "alert ok" : "alert"}>{fileMsg.text}</div>}
                <div className="row" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
                  {f.password && <button type="button" className="btn" disabled={busy} onClick={() => saveFile(f.password, done.email)}><IconArchive /> {tx("Config (JSON) downloaden")}</button>}
                  <button type="button" className="btn" onClick={close}>{tx("Later")}</button>
                  <button type="button" className="btn primary" onClick={() => { close(); logout(); }}>{tx("Nu uitloggen")}</button>
                </div>
              </>
            ) : (
              <>
                <Tabs className="tabs-one-row" value={tab} onChange={setTab} tabs={[["data", "Gegevens", <IconKey key="k" />], ["confirm", "Bevestigen", <IconShield key="s" />], ...(sentTo ? [["code", "Code", <IconMail key="m" />]] : []), ["file", "Bestand", <IconArchive key="a" />]]} />
                {msg && <div className="alert">{msg}</div>}
                {tab === "data" && (
                  <div style={{ display: "grid", gap: ".8rem" }}>
                    <p className="muted" style={{ margin: 0 }}>{tx("Deze gegevens vervangen de standaard superadmin van deze website. Een systeemreset maakt deze gebruiker weer aan.")}{cur?.email ? ` ${tx("Nu: {0}.", cur.email)}` : ""}</p>
                    <label style={lab}><span>{tx("Naam")}</span><input value={f.name} onChange={set("name")} autoComplete="off" /></label>
                    <label style={lab}><span>{tx("E-mailadres")}</span><input type="email" value={f.email} onChange={set("email")} autoComplete="off" /></label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: ".8rem" }}>
                      <label style={lab}><span>{tx("Nieuw wachtwoord")}</span><input type="password" value={f.password} onChange={set("password")} autoComplete="new-password" /></label>
                      <label style={lab}><span>{tx("Herhaal wachtwoord")}</span><input type="password" value={f.password2} onChange={set("password2")} autoComplete="new-password" /></label>
                    </div>
                  </div>
                )}
                {tab === "confirm" && (
                  <div style={{ display: "grid", gap: ".8rem" }}>
                    <p className="muted" style={{ margin: 0 }}>{tx("Om dit te mogen doen vul je je eigen wachtwoord in ({0}). Daarna krijgt het huidige e-mailadres van de standaard superadmin een code, die je op het volgende tabblad invult.", cur?.you || "")}</p>
                    <label style={lab}><span>{tx("Jouw wachtwoord (controle)")}</span><input type="password" value={f.confirm_password} onChange={set("confirm_password")} autoComplete="current-password" /></label>
                  </div>
                )}
                {tab === "code" && (
                  <div style={{ display: "grid", gap: ".8rem" }}>
                    <p className="muted" style={{ margin: 0 }}>{tx("Er is een code gemaild naar het huidige adres van de standaard superadmin ({0}). Vul de code in om de wijziging door te voeren. De code is 15 minuten geldig.", sentTo)}</p>
                    <div style={{ display: "grid", gap: ".3rem", justifyItems: "center" }}><strong style={{ fontSize: ".9rem" }}>{tx("Code uit de mail")}</strong><CodeInput value={code} onChange={setCode} autoFocus onComplete={() => {}} /></div>
                    {sandboxCode && <div className="alert ok">{tx("Sandbox staat aan: de mail is niet echt verstuurd en de code is al voor je ingevuld.")}</div>}
                    {resent && !sandboxCode && <div className="alert ok">{tx("Er is een nieuwe code gemaild. De vorige code werkt niet meer.")}</div>}
                    <div style={{ textAlign: "center" }}><button type="button" className="btn sm" disabled={busy || wait > 0} onClick={resend}><IconMail /> {wait > 0 ? tx("Opnieuw mailen over {0} sec", wait) : tx("Mail opnieuw sturen")}</button></div>
                  </div>
                )}
                {tab === "file" && (
                  <div style={{ display: "grid", gap: "1rem" }}>
                    {fileMsg && <div className={fileMsg.ok ? "alert ok" : "alert"}>{fileMsg.text}</div>}
                    <p className="muted" style={{ margin: 0 }}>{tx("Sla de gegevens van de standaard superadmin op in een versleuteld configuratiebestand (.json) en laad dat bestand op een andere website. Het wachtwoord van de standaard superadmin is de sleutel van het bestand; het wachtwoord zelf staat er niet in.")}</p>
                    <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: ".9rem 1rem", display: "grid", gap: ".6rem" }}>
                      <strong>{tx("Laden")}</strong>
                      <label style={lab}><span>{tx("Wachtwoord van de standaard superadmin in het bestand")}</span><input type="password" value={fpw} onChange={(e) => setFpw(e.target.value)} autoComplete="off" /></label>
                      <label style={lab}><span>{tx("Jouw wachtwoord (controle)")}</span><input type="password" value={own} onChange={(e) => setOwn(e.target.value)} autoComplete="current-password" /></label>
                      <div><label className={`btn sm primary${busy || !fpw || !own ? " disabled" : ""}`} style={{ cursor: busy || !fpw || !own ? "not-allowed" : "pointer", opacity: busy || !fpw || !own ? 0.5 : 1 }}>{tx("Bestand kiezen en laden")}<input type="file" accept="application/json,.json" hidden disabled={busy || !fpw || !own} onChange={loadFile} /></label></div>
                    </div>
                    <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: ".9rem 1rem", display: "grid", gap: ".6rem" }}>
                      <strong>{tx("Opslaan")}</strong>
                      <label style={lab}><span>{tx("Wachtwoord van de standaard superadmin")}</span><input type="password" value={fpw} onChange={(e) => setFpw(e.target.value)} autoComplete="off" /></label>
                      <div><button type="button" className="btn sm" disabled={busy || !fpw || !cur?.email} onClick={() => saveFile(fpw, cur?.email)}>{tx("Configuratie opslaan")}</button></div>
                    </div>
                  </div>
                )}
                <div className="row" style={{ justifyContent: "flex-end" }}>
                  <button type="button" className="btn" disabled={busy} onClick={close}>{tx("Annuleren")}</button>
                  {tab === "data" && <button type="button" className="btn primary" onClick={() => setTab("confirm")}>{tx("Verder")}</button>}
                  {tab === "confirm" && <button type="button" className="btn primary" disabled={busy || !f.confirm_password} onClick={sendCode}>{busy ? tx("Bezig…") : tx("Code mailen")}</button>}
                  {tab === "code" && <button type="button" className="btn primary" disabled={busy || code.length !== 6} onClick={save}>{busy ? tx("Bezig…") : tx("Instellen")}</button>}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
