// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../../../../lib/t";
import { confirmDialog } from "../../../../lib/dialog";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import Collapsible, { CollapseAll } from "../../../../components/Collapsible";
import { IconUser } from "../../../../components/Icons";
import Paged from "../../../../components/Paged";
import ViewBar from "../../../../components/ViewBar";
import { useView } from "../../../../lib/useView";
import { api, errorText } from "../../../../lib/api";

const GROUPS = ["Content", "Community", "Webshop", "Subscription", "Beveiliging", "Systeem", "Kern"];
const LEVELS = [
  [1, "Gebruik", "Openen en bekijken"],
  [2, "Bewerken", "Ook wijzigen en instellingen aanpassen"],
  [3, "Beheer", "Ook toevoegen en verwijderen"],
];

// Who may use / edit / manage a module: groups (roles) or single users
function AccessModal({ module, onClose, onChange }) {
  const [grants, setGrants] = useState([]);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [add, setAdd] = useState({ type: "role", id: "", level: 1 });
  const [error, setError] = useState("");

  const load = useCallback(() => api(`/module-grants/?module=${module.key}`).then(setGrants).catch((e) => setError(errorText(e))), [module.key]);
  useEffect(() => {
    load();
    api("/roles/").then(setRoles).catch(() => {});
    api("/users/").then(setUsers).catch(() => {});
    api("/user-groups/").then(setGroups).catch(() => {});
  }, [load]);

  async function run(fn) {
    setError("");
    try { await fn(); await load(); onChange(); } catch (e) { setError(errorText(e)); }
  }
  const options = add.type === "role"
    ? roles.filter((r) => !r.all_permissions).map((r) => ({ id: r.id, label: r.name }))
    : add.type === "group"
    ? groups.map((g) => ({ id: g.id, label: `${g.name} (${g.member_count})` }))
    : users.filter((u) => !u.is_staff).map((u) => ({ id: u.id, label: `${[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email} (${u.email})` }));

  return (
    <div className="overlay" onClick={onClose}>
      <div className="card modal form" onClick={(e) => e.stopPropagation()}>
        <h2>{tx("Toegang tot \"")}{module.label}"</h2>
        <p className="muted" style={{ margin: 0 }}>{tx("Kies rollen, user groups of users en wat ze mogen. Superadmins hebben altijd alles. Een hoger niveau omvat de lagere. Rechten uit rollen tellen ook mee.")}</p>
        <ul className="level-help">{LEVELS.map(([v, n, d]) => <li key={v}><strong>{v}. {n}</strong> <span className="muted">{d}</span></li>)}</ul>

        <div className="table-wrap" style={{ border: "1px solid var(--line)", borderRadius: "var(--btn-radius)" }}>
          <table>
            <thead><tr><th>{tx("Wie")}</th><th>{tx("Soort")}</th><th>{tx("Niveau")}</th><th></th></tr></thead>
            <tbody>
              {grants.map((g) => (
                <tr key={g.id}>
                  <td>{g.subject}{g.email && <small className="muted"> {g.email}</small>}</td>
                  <td>{g.type === "role" ? tx("Rol") : g.type === "group" ? tx("User group") : tx("User")}</td>
                  <td>
                    <select style={{ width: "auto" }} value={g.level} onChange={(e) => run(() => api(`/module-grants/${g.id}/`, { method: "PATCH", body: { level: Number(e.target.value) } }))}>
                      {LEVELS.map(([v, n]) => <option key={v} value={v}>{v}. {n}</option>)}
                    </select>
                  </td>
                  <td className="actions"><button className="btn sm danger" onClick={() => run(() => api(`/module-grants/${g.id}/`, { method: "DELETE" }))}>{tx("Verwijder")}</button></td>
                </tr>
              ))}
              {!grants.length && <tr><td colSpan={4} className="muted">{tx("Nog niemand toegevoegd.")}</td></tr>}
            </tbody>
          </table>
        </div>

        <h3 style={{ margin: ".5rem 0 0" }}>{tx("Toevoegen")}</h3>
        <div className="grant-add">
          <select value={add.type} onChange={(e) => setAdd({ type: e.target.value, id: "", level: add.level })}>
            <option value="role">{tx("Rol")}</option><option value="group">{tx("User group")}</option><option value="user">{tx("User")}</option>
          </select>
          <select value={add.id} onChange={(e) => setAdd({ ...add, id: e.target.value })}>
            <option value="">{add.type === "role" ? tx("Kies een rol…") : add.type === "group" ? tx("Kies een groep…") : tx("Kies een user…")}</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <select value={add.level} onChange={(e) => setAdd({ ...add, level: Number(e.target.value) })}>
            {LEVELS.map(([v, n]) => <option key={v} value={v}>{v}. {n}</option>)}
          </select>
          <button className="btn primary" disabled={!add.id} onClick={() => run(async () => {
            await api("/module-grants/", { method: "POST", body: { module: module.key, type: add.type, id: Number(add.id), level: add.level } });
            setAdd({ ...add, id: "" });
          })}>{tx("Toevoegen")}</button>
        </div>
        {error && <div className="alert">{error}</div>}
        <div className="row"><button className="btn primary" onClick={onClose}>{tx("Sluiten")}</button></div>
      </div>
    </div>
  );
}

export default function ModulesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [mods, setMods] = useState([]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState("");
  const [access, setAccess] = useState(null);
  const view = useView("modules");

  const load = useCallback(() => api("/modules/all/").then(setMods).catch((e) => setMsg({ ok: false, text: errorText(e) })), []);
  const [pk, setPk] = useState([]);
  const loadPk = useCallback(() => api("/modules/packages/").then(setPk).catch(() => {}), []);
  useEffect(() => { load(); loadPk(); }, [load, loadPk]);

  async function toggle(m) {
    if (m.core || m.plugin) return;
    const next = !m.enabled;
    if (!next && !(await confirmDialog(tx("Module \"{0}\" uitzetten? De functie is dan overal inactief.", m.label)))) return;
    setBusy(m.key);
    setMsg(null);
    try {
      const fresh = await api(`/modules/${m.key}/`, { method: "PATCH", body: { enabled: next } });
      setMods(fresh);
      const missing = next ? (fresh.find((x) => x.key === m.key)?.requires || []).filter((r) => !r.enabled) : [];
      const dependants = !next ? fresh.filter((x) => x.enabled && (x.requires || []).some((r) => r.key === m.key)) : [];
      const warn = missing.length
        ? tx("Let op: {0} heeft ook de module {1} nodig en die staat uit. Zet die ook aan, anders werken bestellingen en betalingen niet.", m.label, missing.map((r) => r.label).join(", "))
        : dependants.length ? tx("Let op: {0} heeft deze module nodig en staat nog aan: {1}.", dependants.map((x) => x.label).join(", "), m.label) : "";
      setMsg({ ok: !warn, text: `${tx("{0} staat nu {1}.", m.label, next ? "aan" : "uit")}${warn ? ` ${warn}` : ""}` });
      router.refresh(); // menus and the website read the module state from the server layout
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    }
    setBusy("");
  }

  async function togglePackage(p, on) { // all modules of a package on or off at once
    if (!on && !(await confirmDialog(tx("Alle modules van het pakket \"{0}\" uitzetten?", p.label)))) return;
    setBusy("pkg"); setMsg(null);
    try {
      let fresh = mods;
      for (const m of p.modules) if (!m.plugin && m.enabled !== on) fresh = await api(`/modules/${m.key}/`, { method: "PATCH", body: { enabled: on } });
      setMods(fresh); await loadPk();
      setMsg({ ok: true, text: tx("{0} staat nu {1}.", p.label, on ? "aan" : "uit") });
      router.refresh();
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy("");
  }

  // switch on the modules another module needs (and the ones those need, in turn)
  async function enableNeeded(keys) {
    setBusy("needed"); setMsg(null);
    try {
      let fresh = mods, todo = [...keys], guard = 0;
      while (todo.length && guard++ < 10) {
        for (const k of todo) fresh = await api(`/modules/${k}/`, { method: "PATCH", body: { enabled: true } });
        todo = [...new Set(fresh.filter((x) => x.enabled).flatMap((x) => (x.requires || []).filter((r) => !r.enabled).map((r) => r.key)))];
      }
      setMods(fresh);
      setMsg({ ok: true, text: tx("De modules zijn aangezet.") });
      router.refresh();
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy("");
  }
  const missingAll = [...new Map(mods.filter((m) => m.enabled).flatMap((m) => (m.requires || []).filter((r) => !r.enabled)).map((r) => [r.key, r])).values()];

  if (!user.is_staff) return null;
  const on = mods.filter((m) => m.enabled).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{tx("Modules")}</h1>
          <p className="muted" style={{ margin: 0 }}>{tx("Zet onderdelen aan of uit en bepaal met het poppetje wie ze mag gebruiken, bewerken of beheren. Een module die uit staat is nergens meer actief; je data blijft bewaard.")} {tx("{0} van {1} aan.", on, mods.length)}</p>
        </div>
        <CollapseAll />
      </div>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}
      {missingAll.length > 0 && (
        <div className="alert" style={{ marginBottom: "1rem", display: "flex", gap: ".8rem", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <span>{tx("Er staan modules aan die een andere module nodig hebben die uit staat: {0}.", missingAll.map((r) => r.label).join(", "))}</span>
          <button type="button" className="btn primary" disabled={busy === "needed"} onClick={() => enableNeeded(missingAll.map((r) => r.key))}>{busy === "needed" ? tx("Bezig…") : tx("Zet ze aan")}</button>
        </div>
      )}
      {pk.length > 0 && (
        <Collapsible id="modules-packages" title={tx("Pakketten (los van het kern-CMS)")}>
          <p className="muted" style={{ margin: 0 }}>{tx("Het kern-CMS is het product. Deze onderdelen passen niet bij elke doelgroep en verkoop je als apart pakket met een eigen prijs in de licentie. Een pakket aan- of uitzetten zet al zijn modules aan of uit.")}</p>
          <div className="module-grid" style={{ marginTop: ".6rem" }}>
            {pk.map((p) => {
              const onCount = p.modules.filter((m) => m.enabled).length, all = onCount === p.modules.length;
              const plugins = [...new Set(p.modules.map((m) => m.plugin).filter(Boolean))]; // parts that are plugins: switched on and off at Plugins
              return (
                <div key={p.key} className={`card module-tile ${onCount ? "" : "off"}`}>
                  <div className="module-top">
                    <strong>{tx(p.label)}</strong>
                    <label className="switch" title={all ? tx("Het hele pakket uitzetten") : tx("Het hele pakket aanzetten")}>
                      <input type="checkbox" checked={onCount > 0} disabled={!!busy || plugins.length > 0} onChange={() => togglePackage(p, onCount === 0)} /><span />
                    </label>
                  </div>
                  <p className="muted">{tx(p.desc)}</p>
                  <small className="muted">{p.modules.map((m) => `${m.label} ${m.enabled ? "✓" : "–"}`).join(" · ")}</small>
                  {plugins.length > 0 && <small className="muted">{tx("Dit pakket zet je aan of uit bij Plugins")}: {plugins.join(", ")}</small>}
                  <span className={`badge ${onCount ? "ok" : "off"}`}>{onCount}/{p.modules.length} {tx("aan")}{Number(p.price) > 0 ? ` · ${new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(Number(p.price))} ${tx("per maand")}` : ""}</span>
                </div>
              );
            })}
          </div>
        </Collapsible>
      )}
      <ViewBar view={view} count={`${on}/${mods.length}`} placeholder={tx("Zoek een module…")} />

      {GROUPS.map((g) => {
        const list = mods.filter((m) => m.group === g);
        const shownList = list.filter((m) => view.match(m.label, m.desc, m.key));
        if (!list.length) return null; // a group without modules (e.g. Webshop without its plugin) is not shown
        if (view.q.trim() && !shownList.length) return null;
        return (
          <Collapsible key={g} id={`modules-${g}`} title={`${tx(g)} (${list.filter((m) => m.enabled).length}/${list.length})`}>
            <Paged id={`modules-${g}`} query={view.q}>
            <div className={`module-grid${view.cls}`}>
              {shownList.map((m) => (
                <div key={m.key} className={`card module-tile ${m.enabled ? "" : "off"}`}>
                  <div className="module-top">
                    <strong>{m.label}</strong>
                    <span className="module-controls">
                      {m.acl && (
                        <button className="icon-btn module-people" onClick={() => setAccess(m)} title={tx("Wie heeft toegang?")} aria-label={tx("Toegang tot {0}", m.label)}>
                          <IconUser />
                          {m.grants > 0 && <span className="module-count">{m.grants}</span>}
                        </button>
                      )}
                      <label className="switch" title={m.core ? tx("Kernmodule: altijd aan") : m.plugin ? tx("Dit is een plugin: aan of uit zet je bij Plugins") : m.enabled ? tx("Uitzetten") : tx("Aanzetten")}>
                        <input type="checkbox" checked={m.enabled} disabled={m.core || !!m.plugin || busy === m.key} onChange={() => toggle(m)} />
                        <span />
                      </label>
                    </span>
                  </div>
                  <p className="muted">{m.desc}</p>
                  {m.enabled && (m.requires || []).filter((r) => !r.enabled).map((r) => (
                    <div className="alert" key={r.key} style={{ margin: ".4rem 0", fontSize: ".8rem", display: "flex", gap: ".5rem", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                      <span>{tx("Heeft ook de module {0} nodig; die staat uit.", r.label)}</span>
                      <button type="button" className="btn sm primary" disabled={busy === "needed"} onClick={() => enableNeeded([r.key])}>{tx("Zet aan")}</button>
                    </div>
                  ))}
                  <span className={`badge ${m.enabled ? "ok" : "off"}`}>{m.core ? tx("Kern") : m.enabled ? tx("Aan") : tx("Uit")}</span>
                </div>
              ))}
            </div>
            </Paged>
          </Collapsible>
        );
      })}

      {access && <AccessModal module={access} onClose={() => setAccess(null)} onChange={load} />}
    </>
  );
}
