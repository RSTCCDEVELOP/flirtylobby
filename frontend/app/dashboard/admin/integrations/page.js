// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../../../../lib/t";
import { confirmDialog } from "../../../../lib/dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import { lvl } from "../../../../lib/perms";
import Collapsible from "../../../../components/Collapsible";
import { IconKey, IconLock, IconSettings } from "../../../../components/Icons";
import Tabs from "../../../../components/Tabs";
import CodeInput from "../../../../components/CodeInput";
import { api, errorText } from "../../../../lib/api";
import { alertDialog } from "../../../../lib/dialog";
import Paged from "../../../../components/Paged";
import ViewBar from "../../../../components/ViewBar";
import { useView } from "../../../../lib/useView";
import S3Browser from "../../../../components/S3Browser";
import { resetIntegrationsCache } from "../../../../lib/integrations";

const statusOf = (i) => (i.last_test_ok === true ? "ok" : i.last_test_ok === false ? "fail" : "none");
const STATUS_TEXT = { ok: "Verbinding OK", fail: "Test mislukt", none: "Nog niet getest", wait: "Testen…" };

export default function Integrations() {
  const { user, setUser } = useAuth();
  const L = lvl(user, "integrations");
  const [items, setItems] = useState([]);
  const [providers, setProviders] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);
  const [modal, setModal] = useState(null);
  const view = useView("integrations");
  const [browse, setBrowse] = useState(null); // S3 link whose files are being browsed
  const [pw, setPw] = useState(null); // opening a locked link: {i, password, error, busy}
  const [smsT, setSmsT] = useState(null); // the sms screens: {i, step: "phone" | "code" | "done", phone, token, code, sandbox_code, error, busy}

  const load = useCallback(() => {
    resetIntegrationsCache();
    return api("/admin/integrations/").then(setItems).catch((e) => setError(errorText(e)));
  }, []);

  useEffect(() => {
    load();
    api("/admin/integration-providers/").then(setProviders).catch(() => {});
  }, [load]);

  const spec = (p) => providers.find((x) => x.provider === p);

  // links that are always on are tested when the page loads (once per link): the result shows at once (green when the API answers)
  const [checking, setChecking] = useState([]);
  const checked = useRef(new Set());
  useEffect(() => {
    if (L < 2) return;
    const todo = items.filter((i) => i.always_on && i.enabled && (!i.locked || i.unlocked) && !checked.current.has(i.id));
    if (!todo.length) return;
    todo.forEach((i) => checked.current.add(i.id));
    setChecking((c) => [...c, ...todo.map((i) => i.id)]);
    (async () => {
      for (const i of todo) {
        try {
          const r = await api(`/admin/integrations/${i.id}/test/`, { method: "POST" });
          setItems((list) => list.map((x) => (x.id === i.id ? r : x)));
        } catch { /* the card keeps its old status */ }
        setChecking((c) => c.filter((id) => id !== i.id));
      }
    })();
  }, [items, L]);

  async function act(id, fn) {
    setBusy(id);
    setError("");
    try { await fn(); await load(); }
    catch (e) {
      // the link was changed or removed elsewhere (another tab, an import): show the current list instead of a dead button
      if (e.status === 404) { await load(); setError(tx("Deze koppeling bestaat niet meer; de lijst is ververst. Probeer het opnieuw.")); } else setError(errorText(e));
    }
    setBusy(null);
  }

  // export / import of all links (with keys), locked with a password, to move them to the live site
  const [xfer, setXfer] = useState(null); // { mode: "export" | "import", password, bundle, name, error }
  async function runXfer(e) {
    e.preventDefault();
    try {
      if (xfer.mode === "export") {
        const b = await api("/admin/integrations/export/", { method: "POST", body: { password: xfer.password } });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([JSON.stringify(b, null, 2)], { type: "application/json" }));
        a.download = "easy2edit-api-koppelingen.json";
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        setXfer(null);
        await alertDialog(tx("Het bestand is gedownload en met je wachtwoord beveiligd. Bewaar het veilig en verwijder het na het importeren."));
      } else {
        const r = await api("/admin/integrations/import/", { method: "POST", body: { bundle: xfer.bundle, password: xfer.password } });
        setXfer(null); await load();
        await alertDialog(r.detail);
      }
    } catch (err) { setXfer((x) => ({ ...x, error: errorText(err) })); }
  }
  async function pickFile(f) {
    if (!f) return;
    try { const bundle = JSON.parse(await f.text()); setXfer((x) => ({ ...x, bundle, name: f.name, error: "" })); }
    catch { setXfer((x) => ({ ...x, bundle: null, name: "", error: tx("Dit bestand kan niet gelezen worden.") })); }
  }

  // the models this key may use, straight from the provider (the list under the field; any model ID can still be typed)
  async function fetchModels() {
    setModal((m) => ({ ...m, loadingModels: true, error: "" }));
    try {
      const r = await api("/admin/integrations/models/", { method: "POST", body: { provider: modal.provider, id: modal.id, api_key: modal.config.api_key || "" } });
      setModal((m) => ({ ...m, models: r.models, loadingModels: false, notice: `${r.models.length} ${tx("modellen gevonden. Kies er een in het veld Model.")}` }));
    } catch (e) { setModal((m) => ({ ...m, loadingModels: false, error: errorText(e) })); }
  }

  // random 32-byte key (base64) for the file encryption: copied to the clipboard so it can be stored safely right away
  const genKey = async (k) => {
    const b = crypto.getRandomValues(new Uint8Array(32));
    const key = btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_");
    setModal((m) => ({ ...m, config: { ...m.config, [k]: key } }));
    let copied = false;
    try { await navigator.clipboard.writeText(key); copied = true; }
    catch {
      try { const t = document.createElement("textarea"); t.value = key; t.style.position = "fixed"; t.style.opacity = "0"; document.body.appendChild(t); t.select(); copied = document.execCommand("copy"); t.remove(); } catch {}
    }
    await alertDialog(`${copied ? tx("De nieuwe sleutel is naar je klembord gekopieerd.") : tx("Kopiëren naar het klembord lukte niet: kopieer de sleutel hieronder zelf.")}\n\n${key}\n\n${tx("Plak hem nu in je wachtwoordmanager of een veilig bestand: zonder deze sleutel zijn versleutelde bestanden niet meer te openen na een nieuwe installatie. Druk daarna op Opslaan. Bestaande versleutelde bestanden blijven leesbaar.")}`);
  };

  // remove the stored master key (the files are wrapped again with the key from the environment, or the default, so they stay readable)
  const dropKey = async (k) => {
    if (!(await confirmDialog(tx("De hoofdsleutel verwijderen? Versleutelde bestanden blijven leesbaar: ze worden opnieuw ingepakt met de sleutel uit de omgeving, of met de standaardsleutel. Het verwijderen gebeurt bij Opslaan."), { danger: true }))) return;
    setModal((m) => ({ ...m, config: { ...m.config, [k]: "__remove__" } }));
  };

  // the SMS screens: 1. a test code is sent to a phone, 2. the code that arrived is entered (the same steps as a verification)
  const smsSend = async (e) => {
    e?.preventDefault();
    setSmsT((t) => ({ ...t, busy: true, error: "" }));
    try {
      const r = await api(`/admin/integrations/${smsT.i.id}/sms-test/`, { method: "POST", body: { phone: smsT.phone } });
      if (r.phone_saved) setUser((u) => ({ ...u, phone: r.phone_saved }));  // the number is now in the profile
      setSmsT((t) => ({ ...t, busy: false, step: "code", token: r.token, sandbox_code: r.sandbox_code || "", code: "" }));
    } catch (err) {
      if (err?.data?.phone_saved) setUser((u) => ({ ...u, phone: err.data.phone_saved }));  // (also when the sending failed: the number was typed and is kept)
      setSmsT((t) => ({ ...t, busy: false, error: errorText(err) }));
    }
  };
  const smsCheck = async (e) => {
    e?.preventDefault();
    setSmsT((t) => ({ ...t, busy: true, error: "" }));
    try {
      await api(`/admin/integrations/${smsT.i.id}/sms-verify/`, { method: "POST", body: { token: smsT.token, code: smsT.code } });
      setSmsT((t) => ({ ...t, busy: false, step: "done" }));
      load();
    } catch (err) { setSmsT((t) => ({ ...t, busy: false, error: errorText(err) })); }
  };
  // a link that has to be opened with a password first: until then it is a closed card
  const openLink = async (e) => {
    e?.preventDefault();
    setPw((p) => ({ ...p, busy: true, error: "" }));
    try {
      const r = await api(`/admin/integrations/${pw.i.id}/unlock/`, { method: "POST", body: { password: pw.password } });
      setItems((list) => list.map((x) => (x.id === r.id ? r : x)));
      setPw(null);
    } catch (err) { setPw((p) => ({ ...p, busy: false, error: errorText(err) })); }
  };
  const closeLink = async (i) => { try { const r = await api(`/admin/integrations/${i.id}/lock/`, { method: "POST" }); setItems((list) => list.map((x) => (x.id === r.id ? r : x))); } catch (err) { setError(errorText(err)); } };
  const toggle = (i) => act(i.id, () => api(`/admin/integrations/${i.id}/`, { method: "PATCH", body: { enabled: !i.enabled } }));
  const test = (i) => act(i.id, () => api(`/admin/integrations/${i.id}/test/`, { method: "POST" }));
  const remove = async (i) => (await confirmDialog(tx("Koppeling \"{0}\" verwijderen? Functies die ervan afhangen stoppen.", i.name), { danger: true })) && act(i.id, () => api(`/admin/integrations/${i.id}/`, { method: "DELETE" }));

  function openNew() {
    pick(providers[0].provider, { name: "", slug: "", config: {} });
  }
  // choose a system: fill in defaults and suggest a name/slug (unless already typed)
  function pick(provider, base) {
    const p = spec(provider);
    const taken = items.some((i) => i.slug === provider);
    setModal({
      ...base,
      provider,
      name: base.name && base.name !== spec(base.provider)?.label ? base.name : p.label,
      slug: base.slug && base.slug !== base.provider ? base.slug : taken ? "" : provider,
      config: defaults(p),
    });
  }
  const defaults = (p) => Object.fromEntries(p.fields.map((f) => [f.key, f.default]));

  async function save(e) {
    e.preventDefault();
    const { id, error: _e, models: _m, notice: _n, loadingModels: _l, tab: _t, ...body } = modal;
    try {
      const saved = await (id ? api(`/admin/integrations/${id}/`, { method: "PATCH", body }) : api("/admin/integrations/", { method: "POST", body }));
      setModal(null);
      await load();
      // a saved link is always tested again at once (new key, new settings): the card shows the new result
      if (saved?.id) {
        checked.current.add(saved.id);
        setChecking((c) => [...c, saved.id]);  // the card shows "Testen…" while it runs
        try { await act(saved.id, () => api(`/admin/integrations/${saved.id}/test/`, { method: "POST" })); } finally { setChecking((c) => c.filter((x) => x !== saved.id)); }
      }
    } catch (err) {
      if (err.status === 404) { setModal(null); await load(); setError(tx("Deze koppeling bestaat niet meer; de lijst is ververst. Probeer het opnieuw.")); return; }
      setModal({ ...modal, error: errorText(err) });
    }
  }

  const fields = modal && spec(modal.provider)?.fields;
  const tabbed = (fields || []).length > 3;  // a link with many fields (for example S3) gets tabs: general and settings
  const itab = modal?.tab === "fields" ? "fields" : "general";

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{tx("API keys")}</h1>
          <p className="muted" style={{ margin: 0 }}>{tx("Koppel externe systemen. Staat een koppeling uit, dan is de bijbehorende functie in de portal niet actief.")}</p>
        </div>
        <div className="head-actions">
          {L >= 3 && <button className="btn" onClick={() => setXfer({ mode: "export", password: "" })}>{tx("Exporteren")}</button>}
          {L >= 3 && <button className="btn" onClick={() => setXfer({ mode: "import", password: "", bundle: null })}>{tx("Importeren")}</button>}
          {L >= 3 && <button className="btn primary" onClick={openNew} disabled={!providers.length}>{tx("+ Nieuwe koppeling")}</button>}
        </div>
      </div>
      {error && <div className="alert">{error}</div>}

      <Collapsible id="integrations-list" title={tx("Koppelingen")}>
      <ViewBar view={view} count={`${items.length}`} placeholder={tx("Zoek een koppeling…")} />
      <Paged id="integrations" query={view.q}>
      <div className={`api-grid${view.cls}`}>
        {items.filter((i) => view.match(i.name, i.slug, i.provider_label, i.last_test_message)).map((i) => {
          const st = checking.includes(i.id) ? "wait" : statusOf(i);
          return (
            <div className="card api-card" key={i.id}>
              <div className="api-head">
                <span className={`dot ${st}`} title={STATUS_TEXT[st]} />
                <div className="api-title">
                  <strong title={i.name}>{i.name}</strong>
                  <span className="api-chips">
                    {i.superadmin_only && <span className="api-chip" title={tx("Alleen superadmins zien en wijzigen deze koppeling")}>{tx("Superadmin")}</span>}
                    {i.in_installation && <span className="api-chip" title={tx("Systeemkoppeling: gaat mee met elke installatie")}><span className="api-chip-ico" aria-hidden="true"><IconLock /></span>{tx("Standaard")}</span>}
                    {i.always_on && <span className="api-chip" title={tx("Altijd aan: nodig voor de installatie")}>{tx("Altijd aan")}</span>}
                    {i.locked && <span className="api-chip" title={tx("Eerst met een wachtwoord openen")}><span className="api-chip-ico" aria-hidden="true"><IconKey /></span>{i.unlocked ? tx("Geopend") : tx("Vergrendeld")}</span>}
                  </span>
                </div>
                <label className="switch" title={i.always_on ? tx("Altijd aan: nodig voor de installatie") : i.enabled ? tx("Actief") : tx("Uit")}>
                  <input type="checkbox" checked={i.enabled} disabled={L < 2 || !!i.always_on || (i.locked && !i.unlocked)} onChange={() => toggle(i)} />
                  <span />
                </label>
              </div>
              <div className="api-body">
                {i.locked && !i.unlocked ? (<>
                  <span className="muted">{i.provider_label}</span>
                  <span className="int-msg none">{tx("Deze koppeling is vergrendeld. Open hem met het wachtwoord om hem te zien.")}</span>
                </>) : (<>
                <span className="muted">{i.provider_label} · <code>{i.slug}</code></span>
                {(() => {
                  const mf = spec(i.provider)?.fields.find((x) => x.type === "model");
                  if (!mf) return null;
                  const m = i.config?.model || mf.default;  // empty = the default of this link
                  const label = mf.options?.find((o) => o.value === m)?.label;
                  return <span className="api-model" title={tx("Actief model")}>{tx("Model")}: <strong>{label || m}</strong>{label && label !== m && <code> {m}</code>}{!i.config?.model && <small className="muted"> ({tx("standaard")})</small>}</span>;
                })()}
                {(i.provider === "spryng" || i.provider === "seven") && <span className="api-model" title={tx("Waarvoor deze koppeling gebruikt mag worden")}>{tx("Gebruik")}: <strong>{i.config?.usage === "messages" ? tx("verificatie en berichten") : tx("alleen verificatiecodes")}</strong></span>}
                <span className={`int-msg ${st}`}>{st === "wait" ? tx(STATUS_TEXT.wait) : i.last_test_message || tx(STATUS_TEXT[st])}</span>
                </>)}
              </div>
              <div className="api-actions">
                {i.locked && !i.unlocked ? (
                  L >= 2 && <button className="btn sm primary" onClick={() => setPw({ i, password: "", error: "", busy: false })}>{tx("Openen")}</button>
                ) : (<>
                  {i.provider === "s3" && L >= 3 && <button className="btn sm" onClick={() => setBrowse(i)} disabled={!i.enabled} title={i.enabled ? "" : tx("Zet de koppeling eerst aan")}>{tx("Bladeren")}</button>}
                  {L >= 2 && (i.provider === "spryng" || i.provider === "seven" || i.provider === "bird") && <button className="btn sm" onClick={() => setSmsT({ i, step: "phone", phone: user?.phone || "", own: !!user?.phone, token: "", code: "", sandbox_code: "", error: "", busy: false })}>{tx("Sms-test")}</button>}
                  {L >= 2 && <button className="btn sm" onClick={() => test(i)} disabled={busy === i.id}>{busy === i.id ? tx("Testen…") : tx("Test")}</button>}
                  {L >= 2 && <button className="btn sm" onClick={() => setModal({ ...i })}>{tx("Wijzig")}</button>}
                  {L >= 3 && !i.enabled && (!(i.always_on || i.in_installation) || user?.is_superadmin_plus) && <button className="btn sm danger" onClick={() => remove(i)}>{tx("Verwijder")}</button>}
                  {i.locked && L >= 2 && <button className="btn sm" onClick={() => closeLink(i)}>{tx("Vergrendelen")}</button>}
                </>)}
              </div>
            </div>
          );
        })}
        {!items.length && <p className="muted">{tx("Nog geen koppelingen.")}</p>}
      </div>
      </Paged>
      </Collapsible>

      {pw && (
        <div className="overlay" onClick={() => setPw(null)}>
          <form className="card modal form" onClick={(e) => e.stopPropagation()} onSubmit={openLink}>
            <h2>{tx("Koppeling openen")}: {pw.i.name}</h2>
            <p className="muted" style={{ margin: 0, fontSize: ".9rem" }}>{tx("Deze koppeling is vergrendeld. Vul het wachtwoord in om hem 30 minuten te openen.")}</p>
            <label>{tx("Wachtwoord")}<input type="password" autoComplete="off" autoFocus required value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} /></label>
            {pw.error && <div className="alert">{pw.error}</div>}
            <div className="row">
              <button type="button" className="btn" onClick={() => setPw(null)}>{tx("Annuleren")}</button>
              <button className="btn primary" disabled={pw.busy || !pw.password}>{pw.busy ? tx("Openen…") : tx("Openen")}</button>
            </div>
          </form>
        </div>
      )}

      {smsT && (
        <div className="overlay" onClick={() => setSmsT(null)}>
          <form className="card modal form" onClick={(e) => e.stopPropagation()} onSubmit={smsT.step === "phone" ? smsSend : smsCheck}>
            <h2>{tx("Sms-test")}: {smsT.i.name}</h2>
            {smsT.step === "phone" && (<>
              <p className="muted" style={{ margin: 0, fontSize: ".9rem" }}>{tx("Er wordt een testcode per sms gestuurd. Vul die daarna in om te controleren dat de koppeling werkt.")}</p>
              <label>{tx("Mobiel nummer")}<input type="tel" inputMode="tel" autoComplete="tel" placeholder="+31612345678" required autoFocus={!smsT.own} value={smsT.phone} onChange={(e) => setSmsT({ ...smsT, phone: e.target.value, own: false })} /></label>
              <span className="muted" style={{ fontSize: ".85rem" }}>{smsT.own ? tx("Dit is het nummer van je eigen profiel. Pas het aan om een ander nummer te testen.") : user?.phone ? tx("Je kunt ook het nummer van je profiel gebruiken: {0}", user.phone) : tx("Je hebt geen mobiel nummer in je profiel: vul hier het nummer in waarmee je wilt testen.")}</span>
            </>)}
            {smsT.step === "code" && (<>
              <p className="muted" style={{ margin: 0, fontSize: ".9rem" }}>{tx("De code is verstuurd naar {0}. Vul hem hieronder in (geldig 10 minuten).", smsT.phone)}</p>
              {smsT.sandbox_code && <div className="alert">{tx("Sandbox: er is niets verstuurd. De code is")} <strong>{smsT.sandbox_code}</strong></div>}
              <div className="code-field"><span>{tx("Code")}</span><CodeInput value={smsT.code} onChange={(c) => setSmsT({ ...smsT, code: c })} autoFocus invalid={!!smsT.error} /></div>
              <button type="button" className="btn sm" onClick={smsSend} disabled={smsT.busy}>{tx("Code opnieuw versturen")}</button>
            </>)}
            {smsT.step === "done" && <div className="alert ok">{tx("De sms is aangekomen en de code klopt: de koppeling werkt.")}</div>}
            {smsT.error && <div className="alert">{smsT.error}</div>}
            <div className="row">
              <button type="button" className="btn" onClick={() => setSmsT(null)}>{smsT.step === "done" ? tx("Sluiten") : tx("Annuleren")}</button>
              {smsT.step === "phone" && <button className="btn primary" disabled={smsT.busy}>{smsT.busy ? tx("Versturen…") : tx("Stuur testcode")}</button>}
              {smsT.step === "code" && <button className="btn primary" disabled={smsT.busy || String(smsT.code).replace(/\D/g, "").length < 6}>{smsT.busy ? tx("Controleren…") : tx("Controleer code")}</button>}
            </div>
          </form>
        </div>
      )}

      {browse && <S3Browser integration={browse} onClose={() => setBrowse(null)} />}

      {xfer && (
        <div className="overlay" onClick={() => setXfer(null)}>
          <form className="card modal form" onClick={(e) => e.stopPropagation()} onSubmit={runXfer}>
            <h2>{xfer.mode === "export" ? tx("API-koppelingen exporteren") : tx("API-koppelingen importeren")}</h2>
            <p className="muted" style={{ margin: 0, fontSize: ".9rem" }}>
              {xfer.mode === "export"
                ? tx("Alle koppelingen inclusief hun sleutels gaan in één bestand, beveiligd met een wachtwoord dat je nu kiest. Zonder dat wachtwoord is het bestand onleesbaar.")
                : tx("Kies het exportbestand en vul het wachtwoord in. Nieuwe koppelingen worden aangemaakt, bestaande met dezelfde sleutelnaam worden bijgewerkt.")}
            </p>
            {xfer.mode === "import" && (
              <label>{tx("Exportbestand")}<input type="file" accept="application/json,.json" onChange={(e) => pickFile(e.target.files?.[0])} required /></label>
            )}
            <label>{tx("Wachtwoord")}<input type="password" autoComplete="new-password" minLength={8} required value={xfer.password} onChange={(e) => setXfer({ ...xfer, password: e.target.value })} /></label>
            {xfer.error && <div className="alert">{xfer.error}</div>}
            <div className="row">
              <button type="button" className="btn" onClick={() => setXfer(null)}>{tx("Annuleren")}</button>
              <button className="btn primary" disabled={xfer.mode === "import" && !xfer.bundle}>{xfer.mode === "export" ? tx("Exporteren") : tx("Importeren")}</button>
            </div>
          </form>
        </div>
      )}

      {modal && fields && (
        <div className="overlay" onClick={() => setModal(null)}>
          <form className="card modal form int-modal" onClick={(e) => e.stopPropagation()} onSubmit={save} onInvalidCapture={(e) => { const t = e.target.closest?.("[data-tab]")?.dataset.tab; if (tabbed && t && t !== itab) setModal((m) => ({ ...m, tab: t })); }}>
            <h2>{modal.id ? tx("Koppeling wijzigen") : tx("Nieuwe koppeling")}</h2>
            {tabbed && <Tabs value={itab} onChange={(k) => setModal({ ...modal, tab: k })} tabs={[["general", "Algemeen", <IconSettings key="g" />], ["fields", "Instellingen", <IconKey key="k" />]]} />}
            <div className="form-grid" data-tab="general" style={tabbed && itab !== "general" ? { display: "none" } : undefined}>
              <label>{tx("Systeem")}
                <select value={modal.provider} disabled={!!modal.id}
                  onChange={(e) => pick(e.target.value, modal)}>
                  {providers.map((p) => <option key={p.provider} value={p.provider}>{p.label}</option>)}
                </select>
              </label>
              <label>{tx("Naam")}<input value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} required /></label>
              <label>{tx("Sleutelnaam (slug)")}
                <input value={modal.slug} onChange={(e) => setModal({ ...modal, slug: e.target.value.toLowerCase() })} pattern="[a-z0-9\-]+" required disabled={!!modal.id} placeholder={tx("bv. anthropic")} />
              </label>
              {user?.is_staff && (
                <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem 1.5rem", alignItems: "start" }}>
                <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={!!modal.superadmin_only} onChange={(e) => setModal({ ...modal, superadmin_only: e.target.checked })} /><span /></span>
                  <span>{tx("Superadmin-koppeling")}<small className="muted" style={{ display: "block" }}>{tx("Alleen superadmins zien en wijzigen deze koppeling, bijvoorbeeld de AI-koppeling die de reseller betaalt.")}</small></span></label>
                  <label className="check sec-toggle" style={{ alignItems: "flex-start" }}><span className="switch"><input type="checkbox" checked={!!modal.in_installation} onChange={(e) => setModal({ ...modal, in_installation: e.target.checked })} /><span /></span>
                  <span>{tx("In elke installatie meenemen")}<small className="muted" style={{ display: "block" }}>{tx("Deze koppeling gaat met haar sleutel mee met elke nieuwe installatie, staat aan en is meteen beschikbaar zonder instellen. Gebruik dit alleen voor een sleutel die elke installatie mag delen.")}</small></span></label>
                  {user?.is_superadmin_plus && <label className="check sec-toggle" style={{ alignItems: "flex-start" }}><span className="switch"><input type="checkbox" checked={!!modal.locked} onChange={(e) => setModal({ ...modal, locked: e.target.checked })} /><span /></span>
                  <span>{tx("Eerst met wachtwoord openen")}<small className="muted" style={{ display: "block" }}>{tx("De koppeling is een gesloten kaart tot iemand hem met het wachtwoord opent (30 minuten). Dan pas zijn instellingen, test en wijzigen zichtbaar.")}</small>
                    {modal.locked && <input type="password" autoComplete="new-password" minLength={8} placeholder={modal.id && !modal.lock_password ? tx("Nieuw wachtwoord (leeg = ongewijzigd)") : tx("Kies een wachtwoord (minstens 8 tekens)")} value={modal.lock_password || ""} onChange={(e) => setModal({ ...modal, lock_password: e.target.value })} style={{ marginTop: ".4rem" }} />}</span></label>}
                  {user?.is_superadmin_plus && <label className="check sec-toggle" style={{ alignItems: "flex-start" }}><span className="switch"><input type="checkbox" checked={!!modal.always_on} onChange={(e) => setModal({ ...modal, always_on: e.target.checked })} /><span /></span>
                  <span>{tx("Altijd aan bij opstarten")}<small className="muted" style={{ display: "block" }}>{tx("Nodig om de installatie af te maken: de koppeling wordt bij elke start vanzelf aangezet en kan niet uit. Er is geen wachtwoord nodig om hem te activeren (de sleutel komt uit de omgeving van de server of van de easy2edit-server). Alleen een superadmin+ kan dit instellen.")}</small></span></label>}
                </div>
              )}
            </div>
            <div className="form-grid" data-tab="fields" style={tabbed && itab !== "fields" ? { display: "none" } : undefined}>
              {fields.map((f) => (
                <label key={f.key}>{f.label}
                  {f.type === "select" ? (
                    <select value={modal.config[f.key] ?? ""} onChange={(e) => setModal({ ...modal, config: { ...modal.config, [f.key]: e.target.value } })}>
                      {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : f.type === "model" ? (
                    <div className="key-row">
                      <input list={`models-${modal.provider}`} value={modal.config[f.key] ?? ""} placeholder={f.default} autoComplete="off"
                        onChange={(e) => setModal({ ...modal, config: { ...modal.config, [f.key]: e.target.value } })} />
                      <datalist id={`models-${modal.provider}`}>
                        {[...(modal.models || []), ...f.options.filter((o) => !(modal.models || []).some((m) => m.value === o.value))].map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </datalist>
                      <button type="button" className="btn sm" disabled={modal.loadingModels} onClick={fetchModels}>{modal.loadingModels ? tx("Ophalen…") : tx("Modellen ophalen")}</button>
                    </div>
                  ) : (
                    <div className={f.key === "encryption_key" ? "key-row" : "fld"}>
                    <input
                      type={f.secret ? "password" : "text"}
                      disabled={modal.config[f.key] === "__remove__"}
                      autoComplete="off"
                      value={modal.config[f.key] === "__remove__" ? "" : (modal.config[f.key] ?? "")}
                      required={f.required && !(f.secret && modal.id)}
                      placeholder={modal.config[f.key] === "__remove__" ? tx("Wordt verwijderd bij Opslaan") : f.secret && modal.id ? tx("Leeg laten = ongewijzigd") : ""}
                      onChange={(e) => setModal({ ...modal, config: { ...modal.config, [f.key]: e.target.value } })}
                    />
                    {f.key === "encryption_key" && (
                      <>
                        <button type="button" className="btn sm" onClick={() => genKey(f.key)}>{tx("Genereer een sleutel")}</button>
                        {modal.id && (modal.config[f.key] || "").startsWith("•") && <button type="button" className="btn sm danger" onClick={() => dropKey(f.key)}>{tx("Verwijderen")}</button>}
                      </>
                    )}
                    </div>
                  )}
                </label>
              ))}
            </div>
            <p className="muted" style={{ margin: 0, fontSize: ".8rem" }}>{tx("Sleutels worden versleuteld opgeslagen en nooit meer getoond. Na het opslaan druk je op Test.")}</p>
            {modal.notice && <div className="alert ok">{modal.notice}</div>}
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
