// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../../../../lib/t";
import { confirmDialog } from "../../../../lib/dialog";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import { lvl } from "../../../../lib/perms";
import Collapsible from "../../../../components/Collapsible";
import { api, errorText } from "../../../../lib/api";
import { alertDialog } from "../../../../lib/dialog";
import Paged from "../../../../components/Paged";
import ViewBar from "../../../../components/ViewBar";
import { useView } from "../../../../lib/useView";
import S3Browser from "../../../../components/S3Browser";
import { resetIntegrationsCache } from "../../../../lib/integrations";

const statusOf = (i) => (i.last_test_ok === true ? "ok" : i.last_test_ok === false ? "fail" : "none");
const STATUS_TEXT = { ok: "Verbinding OK", fail: "Test mislukt", none: "Nog niet getest" };

export default function Integrations() {
  const { user } = useAuth();
  const L = lvl(user, "integrations");
  const [items, setItems] = useState([]);
  const [providers, setProviders] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);
  const [modal, setModal] = useState(null);
  const view = useView("integrations");
  const [browse, setBrowse] = useState(null); // S3 link whose files are being browsed

  const load = useCallback(() => {
    resetIntegrationsCache();
    return api("/admin/integrations/").then(setItems).catch((e) => setError(errorText(e)));
  }, []);

  useEffect(() => {
    load();
    api("/admin/integration-providers/").then(setProviders).catch(() => {});
  }, [load]);

  const spec = (p) => providers.find((x) => x.provider === p);

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
    const { id, error: _e, models: _m, notice: _n, loadingModels: _l, ...body } = modal;
    try {
      await (id ? api(`/admin/integrations/${id}/`, { method: "PATCH", body }) : api("/admin/integrations/", { method: "POST", body }));
      setModal(null);
      load();
    } catch (err) {
      if (err.status === 404) { setModal(null); await load(); setError(tx("Deze koppeling bestaat niet meer; de lijst is ververst. Probeer het opnieuw.")); return; }
      setModal({ ...modal, error: errorText(err) });
    }
  }

  const fields = modal && spec(modal.provider)?.fields;

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
          const st = statusOf(i);
          return (
            <div className="card api-card" key={i.id}>
              <div className="api-head">
                <span className={`dot ${st}`} title={STATUS_TEXT[st]} />
                <strong>{i.name}</strong>{i.superadmin_only && <span className="badge" style={{ marginLeft: ".4rem" }}>{tx("Superadmin")}</span>}
                <label className="switch" title={i.enabled ? tx("Actief") : tx("Uit")}>
                  <input type="checkbox" checked={i.enabled} disabled={L < 2} onChange={() => toggle(i)} />
                  <span />
                </label>
              </div>
              <div className="api-body">
                <span className="muted">{i.provider_label} · <code>{i.slug}</code></span>
                {(() => {
                  const mf = spec(i.provider)?.fields.find((x) => x.type === "model");
                  if (!mf) return null;
                  const m = i.config?.model || mf.default;  // empty = the default of this link
                  const label = mf.options?.find((o) => o.value === m)?.label;
                  return <span className="api-model" title={tx("Actief model")}>{tx("Model")}: <strong>{label || m}</strong>{label && label !== m && <code> {m}</code>}{!i.config?.model && <small className="muted"> ({tx("standaard")})</small>}</span>;
                })()}
                <span className={`int-msg ${st}`}>{i.last_test_message || STATUS_TEXT[st]}</span>
              </div>
              <div className="api-actions">
                {i.provider === "s3" && L >= 3 && <button className="btn sm" onClick={() => setBrowse(i)} disabled={!i.enabled} title={i.enabled ? "" : tx("Zet de koppeling eerst aan")}>{tx("Bladeren")}</button>}
                {L >= 2 && <button className="btn sm" onClick={() => test(i)} disabled={busy === i.id}>{busy === i.id ? tx("Testen…") : tx("Test")}</button>}
                {L >= 2 && <button className="btn sm" onClick={() => setModal({ ...i })}>{tx("Wijzig")}</button>}
                {L >= 3 && <button className="btn sm danger" onClick={() => remove(i)}>{tx("Verwijder")}</button>}
              </div>
            </div>
          );
        })}
        {!items.length && <p className="muted">{tx("Nog geen koppelingen.")}</p>}
      </div>
      </Paged>
      </Collapsible>

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
          <form className="card modal form int-modal" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h2>{modal.id ? tx("Koppeling wijzigen") : tx("Nieuwe koppeling")}</h2>
            <div className="form-grid">
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
                <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={!!modal.superadmin_only} onChange={(e) => setModal({ ...modal, superadmin_only: e.target.checked })} /><span /></span>
                  <span>{tx("Superadmin-koppeling")}<small className="muted" style={{ display: "block" }}>{tx("Alleen superadmins zien en wijzigen deze koppeling, bijvoorbeeld de AI-koppeling die de reseller betaalt.")}</small></span></label>
              )}
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
