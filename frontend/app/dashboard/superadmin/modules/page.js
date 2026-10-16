"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import Collapsible, { CollapseAll } from "../../../../components/Collapsible";
import { IconUser } from "../../../../components/Icons";
import { api, errorText } from "../../../../lib/api";

const GROUPS = ["Content", "Beveiliging", "Systeem", "Kern"];
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
        <h2>Toegang tot "{module.label}"</h2>
        <p className="muted" style={{ margin: 0 }}>Kies rollen, user groups of users en wat ze mogen. Superadmins hebben altijd alles. Een hoger niveau omvat de lagere. Rechten uit rollen tellen ook mee.</p>
        <ul className="level-help">{LEVELS.map(([v, n, d]) => <li key={v}><strong>{v}. {n}</strong> <span className="muted">{d}</span></li>)}</ul>

        <div className="table-wrap" style={{ border: "1px solid var(--line)", borderRadius: "var(--btn-radius)" }}>
          <table>
            <thead><tr><th>Wie</th><th>Soort</th><th>Niveau</th><th></th></tr></thead>
            <tbody>
              {grants.map((g) => (
                <tr key={g.id}>
                  <td>{g.subject}{g.email && <small className="muted"> {g.email}</small>}</td>
                  <td>{g.type === "role" ? "Rol" : g.type === "group" ? "User group" : "User"}</td>
                  <td>
                    <select style={{ width: "auto" }} value={g.level} onChange={(e) => run(() => api(`/module-grants/${g.id}/`, { method: "PATCH", body: { level: Number(e.target.value) } }))}>
                      {LEVELS.map(([v, n]) => <option key={v} value={v}>{v}. {n}</option>)}
                    </select>
                  </td>
                  <td className="actions"><button className="btn sm danger" onClick={() => run(() => api(`/module-grants/${g.id}/`, { method: "DELETE" }))}>Verwijder</button></td>
                </tr>
              ))}
              {!grants.length && <tr><td colSpan={4} className="muted">Nog niemand toegevoegd.</td></tr>}
            </tbody>
          </table>
        </div>

        <h3 style={{ margin: ".5rem 0 0" }}>Toevoegen</h3>
        <div className="grant-add">
          <select value={add.type} onChange={(e) => setAdd({ type: e.target.value, id: "", level: add.level })}>
            <option value="role">Rol</option><option value="group">User group</option><option value="user">User</option>
          </select>
          <select value={add.id} onChange={(e) => setAdd({ ...add, id: e.target.value })}>
            <option value="">{add.type === "role" ? "Kies een rol…" : add.type === "group" ? "Kies een groep…" : "Kies een user…"}</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <select value={add.level} onChange={(e) => setAdd({ ...add, level: Number(e.target.value) })}>
            {LEVELS.map(([v, n]) => <option key={v} value={v}>{v}. {n}</option>)}
          </select>
          <button className="btn primary" disabled={!add.id} onClick={() => run(async () => {
            await api("/module-grants/", { method: "POST", body: { module: module.key, type: add.type, id: Number(add.id), level: add.level } });
            setAdd({ ...add, id: "" });
          })}>Toevoegen</button>
        </div>
        {error && <div className="alert">{error}</div>}
        <div className="row"><button className="btn primary" onClick={onClose}>Sluiten</button></div>
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

  const load = useCallback(() => api("/modules/all/").then(setMods).catch((e) => setMsg({ ok: false, text: errorText(e) })), []);
  useEffect(() => { load(); }, [load]);

  async function toggle(m) {
    if (m.core) return;
    const next = !m.enabled;
    if (!next && !confirm(`Module "${m.label}" uitzetten? De functie is dan overal inactief.`)) return;
    setBusy(m.key);
    setMsg(null);
    try {
      setMods(await api(`/modules/${m.key}/`, { method: "PATCH", body: { enabled: next } }));
      setMsg({ ok: true, text: `${m.label} staat nu ${next ? "aan" : "uit"}.` });
      router.refresh(); // menus and the website read the module state from the server layout
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    }
    setBusy("");
  }

  if (!user.is_staff) return null;
  const on = mods.filter((m) => m.enabled).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Modules</h1>
          <p className="muted" style={{ margin: 0 }}>Zet onderdelen aan of uit en bepaal met het poppetje wie ze mag gebruiken, bewerken of beheren. Een module die uit staat is nergens meer actief; je data blijft bewaard. {on} van {mods.length} aan.</p>
        </div>
        <CollapseAll />
      </div>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}

      {GROUPS.map((g) => {
        const list = mods.filter((m) => m.group === g);
        return (
          <Collapsible key={g} id={`modules-${g}`} title={`${g} (${list.filter((m) => m.enabled).length}/${list.length})`}>
            <div className="module-grid">
              {list.map((m) => (
                <div key={m.key} className={`card module-tile ${m.enabled ? "" : "off"}`}>
                  <div className="module-top">
                    <strong>{m.label}</strong>
                    <span className="module-controls">
                      {m.acl && (
                        <button className="icon-btn module-people" onClick={() => setAccess(m)} title="Wie heeft toegang?" aria-label={`Toegang tot ${m.label}`}>
                          <IconUser />
                          {m.grants > 0 && <span className="module-count">{m.grants}</span>}
                        </button>
                      )}
                      <label className="switch" title={m.core ? "Kernmodule: altijd aan" : m.enabled ? "Uitzetten" : "Aanzetten"}>
                        <input type="checkbox" checked={m.enabled} disabled={m.core || busy === m.key} onChange={() => toggle(m)} />
                        <span />
                      </label>
                    </span>
                  </div>
                  <p className="muted">{m.desc}</p>
                  <span className={`badge ${m.enabled ? "ok" : "off"}`}>{m.core ? "Kern" : m.enabled ? "Aan" : "Uit"}</span>
                </div>
              ))}
            </div>
          </Collapsible>
        );
      })}

      {access && <AccessModal module={access} onClose={() => setAccess(null)} onChange={load} />}
    </>
  );
}
