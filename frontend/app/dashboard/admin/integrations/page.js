"use client";

import { tx } from "../../../../lib/t";
import { confirmDialog } from "../../../../lib/dialog";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import { lvl } from "../../../../lib/perms";
import Collapsible from "../../../../components/Collapsible";
import { api, errorText } from "../../../../lib/api";
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
    try { await fn(); await load(); } catch (e) { setError(errorText(e)); }
    setBusy(null);
  }

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
    const { id, error: _e, ...body } = modal;
    try {
      await (id ? api(`/admin/integrations/${id}/`, { method: "PATCH", body }) : api("/admin/integrations/", { method: "POST", body }));
      setModal(null);
      load();
    } catch (err) {
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
        {L >= 3 && <button className="btn primary" onClick={openNew} disabled={!providers.length}>{tx("+ Nieuwe koppeling")}</button>}
      </div>
      {error && <div className="alert">{error}</div>}

      <Collapsible id="integrations-list" title={tx("Koppelingen")}>
      <div className="int-list">
        {items.map((i) => {
          const st = statusOf(i);
          return (
            <div className="card int-item" key={i.id}>
              <span className={`dot ${st}`} title={STATUS_TEXT[st]} />
              <div className="int-main">
                <strong>{i.name}</strong>
                <span className="muted">{i.provider_label} · <code>{i.slug}</code></span>
                <span className={`int-msg ${st}`}>{i.last_test_message || STATUS_TEXT[st]}</span>
              </div>
              <div className="int-actions">
                {L >= 2 && <button className="btn sm" onClick={() => test(i)} disabled={busy === i.id}>{busy === i.id ? tx("Testen…") : tx("Test")}</button>}
                {L >= 2 && <button className="btn sm" onClick={() => setModal({ ...i })}>{tx("Wijzig")}</button>}
                {L >= 3 && <button className="btn sm danger" onClick={() => remove(i)}>{tx("Verwijder")}</button>}
                <label className="switch" title={i.enabled ? tx("Actief") : tx("Uit")}>
                  <input type="checkbox" checked={i.enabled} disabled={L < 2} onChange={() => toggle(i)} />
                  <span />
                </label>
              </div>
            </div>
          );
        })}
        {!items.length && <p className="muted">{tx("Nog geen koppelingen.")}</p>}
      </div>
      </Collapsible>

      {modal && fields && (
        <div className="overlay" onClick={() => setModal(null)}>
          <form className="card modal form" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h2>{modal.id ? tx("Koppeling wijzigen") : tx("Nieuwe koppeling")}</h2>
            <div className="grid2">
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
            </div>
            <div className="grid2">
              {fields.map((f) => (
                <label key={f.key}>{f.label}
                  {f.type === "select" ? (
                    <select value={modal.config[f.key] ?? ""} onChange={(e) => setModal({ ...modal, config: { ...modal.config, [f.key]: e.target.value } })}>
                      {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input
                      type={f.secret ? "password" : "text"}
                      autoComplete="off"
                      value={modal.config[f.key] ?? ""}
                      required={f.required && !(f.secret && modal.id)}
                      placeholder={f.secret && modal.id ? tx("Leeg laten = ongewijzigd") : ""}
                      onChange={(e) => setModal({ ...modal, config: { ...modal.config, [f.key]: e.target.value } })}
                    />
                  )}
                </label>
              ))}
            </div>
            <p className="muted" style={{ margin: 0, fontSize: ".8rem" }}>{tx("Sleutels worden versleuteld opgeslagen en nooit meer getoond. Na het opslaan druk je op Test.")}</p>
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
