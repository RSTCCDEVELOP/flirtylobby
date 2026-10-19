"use client";

import { tx } from "../../../../lib/t";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import Tabs from "../../../../components/Tabs";
import Paged from "../../../../components/Paged";
import ViewBar from "../../../../components/ViewBar";
import { api, errorText } from "../../../../lib/api";
import { alertDialog, confirmDialog } from "../../../../lib/dialog";
import { money } from "../../../../lib/format";
import { lvl } from "../../../../lib/perms";
import { useView } from "../../../../lib/useView";

const KIND = { page: "Pagina", content: "Content", service: "Dienst" };

// A readable sentence of the conditions, e.g. "Abonnement Gold of donatie vanaf € 10"
function summary(item, o) {
  if (!item.gated) return tx("Open voor iedereen");
  const conds = item.conditions?.length ? item.conditions : [{ type: "entitlement" }];
  const name = (list, id, f = "name") => list.find((x) => x.id === id)?.[f] || `#${id}`;
  const parts = conds.map((c) => {
    const days = c.days ? ` ${tx("in de laatste")} ${c.days} ${tx("dagen")}` : "";
    switch (c.type) {
      case "entitlement": return tx("abonnement of donatie-actie die dit geeft");
      case "any_plan": return tx("een lopend abonnement");
      case "plan": return `${tx("abonnement")} ${name(o.plans, c.ref)}`;
      case "donation_total": return `${tx("donatie vanaf")} ${money(c.amount || 0)}${days}`;
      case "donation_campaign": return `${tx("donatie aan")} ${name(o.campaigns, c.ref)}${Number(c.amount) ? ` ${tx("vanaf")} ${money(c.amount)}` : ""}${days}`;
      case "member_days": return `${tx("lid sinds")} ${c.value} ${tx("dagen")}`;
      case "verified_email": return tx("e-mail bevestigd");
      case "profile_complete": return `${tx("profiel met")} ${c.value || 1} ${tx("foto's")}`;
      case "verified_profile": return tx("profiel gecontroleerd");
      case "role": return `${tx("rol")} ${name(o.roles, c.ref)}`;
      default: return c.type;
    }
  });
  return parts.join(item.mode === "all" ? ` ${tx("én")} ` : ` ${tx("of")} `);
}

// The things that can give this item: donations and subscriptions. Drag one to the list on the right (or click the arrow) and the item is linked to it; drag it back to unlink.
function LinkLists({ modal, setModal, o }) {
  const [over, setOver] = useState("");
  const all = [...(o.campaigns || []).map((c) => ({ id: `d:${c.id}`, label: c.name, kind: "donation" })), ...(o.plans || []).map((p) => ({ id: `p:${p.id}`, label: p.name, kind: "plan" }))];
  const linked = new Set([...(modal.donations || []).map((x) => `d:${x}`), ...(modal.plans || []).map((x) => `p:${x}`)]);
  const move = (id, to) => {
    const [t, n] = [id[0], Number(id.slice(2))];
    const key = t === "d" ? "donations" : "plans";
    const cur = modal[key] || [];
    setModal({ ...modal, [key]: to === "linked" ? [...new Set([...cur, n])] : cur.filter((x) => x !== n) });
  };
  const item = (x, to) => (
    <li key={x.id} className="link-item" draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", x.id); e.dataTransfer.effectAllowed = "move"; }} onDoubleClick={() => move(x.id, to)}>
      <span className={`badge ${x.kind === "donation" ? "ok" : ""}`}>{x.kind === "donation" ? tx("Donatie") : tx("Abonnement")}</span>
      <span style={{ flex: 1, minWidth: 0 }}>{x.label}</span>
      <button type="button" className="btn sm" title={to === "linked" ? tx("Koppelen") : tx("Ontkoppelen")} aria-label={to === "linked" ? tx("Koppelen") : tx("Ontkoppelen")} onClick={() => move(x.id, to)}>{to === "linked" ? "→" : "←"}</button>
    </li>
  );
  const box = (title, list, to, hint) => (
    <div className={`link-box${over === to ? " over" : ""}`} onDragOver={(e) => { e.preventDefault(); setOver(to); }} onDragLeave={() => setOver("")} onDrop={(e) => { e.preventDefault(); setOver(""); const id = e.dataTransfer.getData("text/plain"); if (id) move(id, to); }}>
      <strong style={{ fontSize: ".85rem" }}>{title}</strong>
      <ul>{list.map((x) => item(x, to === "linked" ? "free" : "linked"))}{!list.length && <li className="muted link-empty">{hint}</li>}</ul>
    </div>
  );
  return (
    <div className="act-links">
      <strong style={{ fontSize: ".85rem" }}>{tx("Gekoppeld aan")}</strong>
      <small className="muted" style={{ display: "block" }}>{tx("Sleep een donatie of abonnement naar de lijst rechts: dan geeft dat dit onderdeel aan wie het neemt. Sleep terug om te ontkoppelen.")}</small>
      <div className="link-lists">
        {box(tx("Beschikbaar"), all.filter((x) => !linked.has(x.id)), "free", tx("Alles is gekoppeld."))}
        {box(tx("Gekoppeld"), all.filter((x) => linked.has(x.id)), "linked", tx("Sleep hier iets naartoe."))}
      </div>
    </div>
  );
}

const PRESETS = [["1h", "1 uur"], ["1d", "1 dag"], ["1w", "1 week"], ["1m", "1 maand"], ["3m", "3 maanden"], ["1y", "1 jaar"], ["", "Altijd geldig (geen einde)"]];

// "Geldig tot": how long (and how often) a donor may use this item after a completed donation. Applies to every donation that gives the item.
function ValidTab({ modal, setModal, o }) {
  const r = modal.rule || {};
  const set = (patch) => setModal({ ...modal, rule: { ...r, ...patch } });
  const linked = (modal.donations || []).length > 0;
  return (
    <div className="stack-sm">
      <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>{tx("Hoelang mag een donateur dit onderdeel gebruiken nadat zijn donatie is voltooid? Dit geldt voor elke donatie die dit onderdeel geeft.")}{!modal.gated ? ` ${tx("Zet eerst Afschermen aan bij Instellingen.")}` : !linked && o.campaigns?.length ? ` ${tx("Koppel bij Instellingen een donatie, anders is er niets om te laten verlopen.")}` : ""}</p>
      <div className="avail-pick">
        {PRESETS.map(([v, l]) => (
          <button key={v || "always"} type="button" className={`avail-chip pick ${(r.valid_for || "") === v ? "on" : ""}`} aria-pressed={(r.valid_for || "") === v} onClick={() => set({ valid_for: v })}>
            {tx(l)}{modal.suggest === v && v ? ` · ${tx("voorstel")}` : ""}
          </button>
        ))}
      </div>
      {modal.suggest && (r.valid_for || "") !== modal.suggest && <div><button type="button" className="btn sm" onClick={() => set({ valid_for: modal.suggest })}>{tx("Ons voorstel gebruiken")}: {tx(PRESETS.find(([v]) => v === modal.suggest)?.[1] || "")}</button></div>}
      <div className="form-grid">
        <label>{tx("Hoe vaak te gebruiken")} <small className="muted">{tx("(0 = zo vaak als hij wil)")}</small><input type="number" min={0} value={r.uses ?? 0} onChange={(e) => set({ uses: e.target.value })} /></label>
        <label>{tx("Vanaf bedrag")}<input type="number" min={0} step="0.01" value={r.min_amount ?? 0} onChange={(e) => set({ min_amount: e.target.value })} /></label>
      </div>
      <label className="check sec-toggle"><input type="checkbox" checked={!!r.session_only} onChange={(e) => set({ session_only: e.target.checked })} /><span><strong>{tx("Alleen deze sessie")}</strong><br /><small className="muted">{tx("Geldt alleen zolang de donateur ingelogd blijft; na uitloggen is de actie voorbij.")}</small></span></label>
      <details>
        <summary className="muted" style={{ cursor: "pointer", fontSize: ".85rem" }}>{tx("Vaste data (optioneel)")}</summary>
        <div className="form-grid" style={{ marginTop: ".5rem" }}>
          <label>{tx("Geldt vanaf (datum en tijd)")}<input type="datetime-local" value={r.from || ""} onChange={(e) => set({ from: e.target.value })} /></label>
          <label>{tx("Deadline (datum en tijd)")}<input type="datetime-local" value={r.until || ""} onChange={(e) => set({ until: e.target.value })} /></label>
        </div>
      </details>
    </div>
  );
}

export default function Actions() {
  const { user } = useAuth();
  const L = Math.max(lvl(user, "subscriptions"), lvl(user, "donations"));
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState(null);
  const [modal, setModal] = useState(null); // item being edited
  const [mtab, setMtab] = useState("settings"); // settings | valid
  const [add, setAdd] = useState(null); // own item being added
  const [email, setEmail] = useState("");
  const [check, setCheck] = useState(null);
  const [state, setState] = useState("");
  const view = useView("actions");

  const load = useCallback(() => api("/subscriptions/admin/actions/").then(setD).catch((e) => setMsg({ ok: false, text: errorText(e) })), []);
  useEffect(() => { load(); }, [load]);

  const save = async (item, patch) => {
    try { const r = await api(`/subscriptions/admin/actions/${encodeURIComponent(item.key)}/`, { method: "PATCH", body: patch }); setD((x) => ({ ...x, items: x.items.map((i) => (i.key === item.key ? r : i)) })); return r; }
    catch (e) { await alertDialog(errorText(e)); return null; }
  };
  const submitModal = async (e) => {
    e.preventDefault();
    const r = await save(modal, { gated: modal.gated, mode: modal.mode, conditions: modal.conditions, ...(modal.gated && o.campaigns?.length ? { donations: modal.donations || [] } : {}), ...(modal.gated && o.plans?.length ? { plans: modal.plans || [] } : {}), rule: modal.rule, ...(modal.pair ? { share: !!modal.share } : {}), ...(modal.builtin ? {} : { name: modal.name, description: modal.description }) });
    if (r) setModal(null);
  };
  const create = async (e) => {
    e.preventDefault();
    try { setD(await api("/subscriptions/admin/actions/", { method: "POST", body: add })); setAdd(null); }
    catch (er) { setAdd((a) => ({ ...a, error: errorText(er) })); }
  };
  const remove = async (item) => {
    if (!(await confirmDialog(tx("Dit eigen onderdeel uit de lijst halen? Het wordt weer open voor iedereen."), { danger: true }))) return;
    try { await api(`/subscriptions/admin/actions/${encodeURIComponent(item.key)}/`, { method: "DELETE" }); setModal(null); load(); } catch (e) { await alertDialog(errorText(e)); }
  };
  const runCheck = async (e) => {
    e.preventDefault();
    try { setCheck(await api(`/subscriptions/admin/actions/check/?email=${encodeURIComponent(email)}`)); } catch (er) { setCheck(null); setMsg({ ok: false, text: errorText(er) }); }
  };

  const items = useMemo(() => (d?.items || []).filter((i) => (!i.themes || i.themes.includes(d.options.theme)) && view.match(i.name, i.description, i.group, summary(i, d.options)) && (!state || (state === "gated" ? i.gated : state === "open" ? !i.gated : i.builtin === false))), [d, view, state]);
  const groups = useMemo(() => [...new Set(items.map((i) => i.group))], [items]);
  if (!d) return msg ? <div className="alert">{msg.text}</div> : <p className="muted">{tx("Laden…")}</p>;
  const o = d.options;
  const passed = check ? Object.fromEntries(check.items.map((i) => [i.key, i])) : {};

  const condRow = (c, i, set) => {
    const upd = (patch) => set((m) => ({ ...m, conditions: m.conditions.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
    return (
      <div className="cond-row" key={i}>
        <select value={c.type} onChange={(e) => upd({ type: e.target.value, ref: "", amount: "", days: 0, value: 0 })}>{o.condition_types.map((t) => <option key={t.type} value={t.type}>{tx(t.label)}</option>)}</select>
        {c.type === "plan" && <select value={c.ref || ""} onChange={(e) => upd({ ref: Number(e.target.value) })}><option value="">{tx("Kies een abonnement…")}</option>{o.plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
        {c.type === "donation_campaign" && <select value={c.ref || ""} onChange={(e) => upd({ ref: Number(e.target.value) })}><option value="">{tx("Kies een donatie-actie…")}</option>{o.campaigns.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
        {c.type === "role" && <select value={c.ref || ""} onChange={(e) => upd({ ref: Number(e.target.value) })}><option value="">{tx("Kies een rol…")}</option>{o.roles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
        {["donation_total", "donation_campaign"].includes(c.type) && (
          <>
            <input type="number" min="0" step="0.01" value={c.amount ?? ""} placeholder={tx("Bedrag")} title={tx("Minimaal bedrag")} onChange={(e) => upd({ amount: e.target.value })} />
            <input type="number" min="0" value={c.days ?? 0} placeholder={tx("Dagen")} title={tx("Binnen hoeveel dagen (0 = ooit)")} onChange={(e) => upd({ days: e.target.value })} />
          </>
        )}
        {["member_days", "profile_complete"].includes(c.type) && <input type="number" min="0" value={c.value ?? 0} title={c.type === "member_days" ? tx("Aantal dagen") : tx("Aantal foto's")} onChange={(e) => upd({ value: e.target.value })} />}
        <button type="button" className="btn sm danger" onClick={() => set((m) => ({ ...m, conditions: m.conditions.filter((_, j) => j !== i) }))}>{tx("Weg")}</button>
      </div>
    );
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{tx("Actions")}</h1>
          <p className="muted" style={{ margin: 0 }}>{tx("Alles in het systeem waar voor betaald of gedoneerd kan worden. Zet een onderdeel op afgeschermd en kies de voorwaarden: een abonnement, een donatie, hoe lang iemand lid is, een rol … Een onderdeel kan meerdere voorwaarden hebben, zodat je het zowel met een abonnement als met een donatie kunt krijgen.")}</p>
        </div>
        {L >= 3 && <button className="btn primary" onClick={() => setAdd({ kind: "content", ref: "", name: "", description: "" })}>{tx("+ Eigen onderdeel")}</button>}
      </div>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}

      <form className="card check-user" onSubmit={runCheck}>
        <strong>{tx("Controleer een lid")}</strong>
        <input type="email" required value={email} placeholder={tx("e-mailadres van het lid")} onChange={(e) => setEmail(e.target.value)} />
        <button className="btn">{tx("Controleer")}</button>
        {check && <span className="muted">{check.user.name}: <strong>{check.items.filter((i) => i.gated && i.ok).length}</strong> {tx("afgeschermde onderdelen beschikbaar")}</span>}
        {check && <button type="button" className="btn sm" onClick={() => setCheck(null)}>{tx("Wissen")}</button>}
      </form>

      <ViewBar view={view} count={`${items.length}/${d.items.length}`} placeholder={tx("Zoek een onderdeel…")}
        extra={<select value={state} onChange={(e) => setState(e.target.value)}><option value="">{tx("Alles")}</option><option value="gated">{tx("Afgeschermd")}</option><option value="open">{tx("Open voor iedereen")}</option><option value="custom">{tx("Eigen onderdelen")}</option></select>} />

      {groups.map((g) => (
        <section key={g} className="act-group">
          <h2>{tx(g)}</h2>
          <Paged id={`actions-${g}`} query={view.q}>
          <div className={`sub-plans${view.cls}`}>
            {items.filter((i) => i.group === g).map((i) => (
              <div className={`card sub-plan${i.gated ? "" : " off"}`} key={i.key}>
                <div className="sub-plan-top">
                  <strong>{tx(i.name)}</strong>
                  {!i.builtin && <span className="badge">{tx(KIND[i.kind])}</span>}
                  <span className={`badge ${i.gated ? "ok" : "off"}`}>{i.gated ? tx("Afgeschermd") : tx("Open")}</span>
                  {check && i.gated && <span className={`badge ${passed[i.key]?.ok ? "ok" : "off"}`}>{passed[i.key]?.ok ? tx("Lid heeft toegang") : tx("Lid heeft geen toegang")}</span>}
                </div>
                {i.description && <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>{tx(i.description)}</p>}
                <div className="act-sum">{summary(i, o)}{i.gated && i.share ? ` · ${tx("geldt ook voor de ander")}` : ""}</div>
                {i.gated && i.plans?.length > 0 && <small className="muted">{tx("Abonnement")}: {i.plans.map((id) => o.plans?.find((p) => p.id === id)?.name).filter(Boolean).join(", ")}</small>}
                {i.gated && i.donations?.length > 0 && <small className="muted">{tx("Donatie")}: {i.donations.map((id) => o.campaigns?.find((c) => c.id === id)?.name).filter(Boolean).join(", ")}</small>}
                {check && i.gated && passed[i.key]?.conditions.length > 0 && (
                  <ul className="act-why">{passed[i.key].conditions.map((c, k) => <li key={k} className={c.ok ? "yes" : "no"}>{c.ok ? "✓" : "✗"} {tx(c.reason)}</li>)}</ul>
                )}
                <div className="sub-actions">
                  {L >= 3 && <label className="switch" title={i.gated ? tx("Afgeschermd: klik om open te zetten") : tx("Open: klik om af te schermen")}><input type="checkbox" checked={i.gated} onChange={(e) => save(i, { gated: e.target.checked })} /><span /></label>}
                  {L >= 2 && <button className="btn sm" onClick={() => { setMtab("settings"); setModal({ ...i, conditions: i.conditions.map((c) => ({ ...c })), rule: { ...(i.rule || {}) }, plans: [...(i.plans || [])], donations: [...(i.donations || [])] }); }}>{tx("Voorwaarden")}</button>}
                </div>
              </div>
            ))}
          </div>
          </Paged>
        </section>
      ))}
      {!items.length && <p className="muted">{tx("Niets gevonden.")}</p>}

      {modal && (
        <div className="overlay" onClick={() => setModal(null)}>
          <form className="card modal form int-modal" onClick={(e) => e.stopPropagation()} onSubmit={submitModal}>
            <h2>{tx(modal.name)}</h2>
            {modal.builtin ? <p className="muted" style={{ margin: 0 }}>{tx(modal.description)}</p> : (
              <div className="form-grid">
                <label>{tx("Naam")}<input value={modal.name} maxLength={120} onChange={(e) => setModal({ ...modal, name: e.target.value })} /></label>
                <label>{tx("Omschrijving")}<input value={modal.description} maxLength={300} onChange={(e) => setModal({ ...modal, description: e.target.value })} /></label>
              </div>
            )}
            <Tabs value={mtab} onChange={setMtab} tabs={[["settings", "Instellingen"], ["valid", "Geldig tot"]]} />
            {mtab === "settings" && (
              <>
            <label className="check sec-toggle">
              <input type="checkbox" checked={modal.gated} onChange={(e) => setModal({ ...modal, gated: e.target.checked, ...(e.target.checked && o.campaigns?.length === 1 && !(modal.donations || []).length ? { donations: [o.campaigns[0].id] } : {}) })} />
              <span><strong>{tx("Afschermen")}</strong><br /><small className="muted">{tx("Uit = iedereen kan dit gebruiken. Aan = alleen wie aan de voorwaarden voldoet.")}</small></span>
            </label>
            {modal.gated && (
              <>
                <label>{tx("Hoeveel voorwaarden moeten kloppen?")}
                  <select value={modal.mode} onChange={(e) => setModal({ ...modal, mode: e.target.value })}>
                    <option value="any">{tx("Eén van de voorwaarden is genoeg (of)")}</option>
                    <option value="all">{tx("Alle voorwaarden (én)")}</option>
                  </select>
                </label>
                {(o.plans?.length > 0 || o.campaigns?.length > 0) && <LinkLists modal={modal} setModal={setModal} o={o} />}
                <div className="grants">
                  {modal.conditions.map((c, i) => condRow(c, i, setModal))}
                  {!modal.conditions.length && <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>{tx("Geen voorwaarden gekozen: dan geldt een abonnement of donatie-actie die dit onderdeel geeft (bij Abonnementen en Donaties).")}</p>}
                  <div><button type="button" className="btn sm" onClick={() => setModal({ ...modal, conditions: [...modal.conditions, { type: "any_plan" }] })}>{tx("+ Voorwaarde")}</button></div>
                </div>
                {modal.pair && (
                  <label className="check sec-toggle">
                    <input type="checkbox" checked={!!modal.share} onChange={(e) => setModal({ ...modal, share: e.target.checked })} />
                    <span><strong>{tx("Ook voor de ander met wie hij verbonden is")}</strong><br /><small className="muted">{tx("Heeft het lid dit recht, dan mag ook de ander (de persoon met wie hij chat of verbonden is) het gebruiken in dat gesprek. Uit = alleen het lid zelf.")}</small></span>
                  </label>
                )}
                <div className="act-sum">{summary(modal, o)}{modal.pair && modal.share ? ` · ${tx("geldt ook voor de ander")}` : ""}</div>
              </>
            )}
              </>
            )}
            {mtab === "valid" && <ValidTab modal={modal} setModal={setModal} o={o} />}
            <div className="row">
              {!modal.builtin && L >= 3 && <button type="button" className="btn danger" onClick={() => remove(modal)}>{tx("Verwijderen")}</button>}
              <button type="button" className="btn" onClick={() => setModal(null)}>{tx("Annuleren")}</button>
              <button className="btn primary">{tx("Opslaan")}</button>
            </div>
          </form>
        </div>
      )}

      {add && (
        <div className="overlay" onClick={() => setAdd(null)}>
          <form className="card modal form" onClick={(e) => e.stopPropagation()} onSubmit={create}>
            <h2>{tx("Eigen onderdeel toevoegen")}</h2>
            <label>{tx("Soort")}
              <select value={add.kind} onChange={(e) => setAdd({ ...add, kind: e.target.value, ref: "" })}>
                <option value="content">{tx("Content (tekst of beeld met een sleutel)")}</option><option value="page">{tx("Eigen pagina")}</option><option value="service">{tx("Dienst of product")}</option>
              </select>
            </label>
            {add.kind === "content" && <label>{tx("Sleutel van de content")}<input value={add.ref} maxLength={80} placeholder="cursus-1" onChange={(e) => setAdd({ ...add, ref: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })} required /></label>}
            {add.kind === "page" && <label>{tx("Pagina")}<select value={add.ref} onChange={(e) => setAdd({ ...add, ref: e.target.value })} required><option value="">{tx("Kies een pagina…")}</option>{o.pages.map((p) => <option key={p.key} value={p.key}>{p.title}</option>)}</select></label>}
            {add.kind === "service" && <label>{tx("Product")}<select value={add.ref} onChange={(e) => setAdd({ ...add, ref: e.target.value })} required><option value="">{tx("Kies een product…")}</option>{o.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
            <label>{tx("Naam")}<input value={add.name} maxLength={120} onChange={(e) => setAdd({ ...add, name: e.target.value })} required /></label>
            <label>{tx("Omschrijving")}<input value={add.description} maxLength={300} onChange={(e) => setAdd({ ...add, description: e.target.value })} /></label>
            {add.error && <div className="alert">{add.error}</div>}
            <div className="row"><button type="button" className="btn" onClick={() => setAdd(null)}>{tx("Annuleren")}</button><button className="btn primary">{tx("Toevoegen")}</button></div>
          </form>
        </div>
      )}
    </>
  );
}
