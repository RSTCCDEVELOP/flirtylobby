"use client";

import { tx } from "../../../../lib/t";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import Collapsible, { CollapseAll } from "../../../../components/Collapsible";
import { useModules } from "../../../../components/Modules";
import { menuLabel } from "../../../../components/SiteMenu";
import { IconUser } from "../../../../components/Icons";
import { VISIBILITY_ICON } from "../../../../components/VisibilityPicker";
import { api, errorText } from "../../../../lib/api";
import { confirmDialog } from "../../../../lib/dialog";
import { lvl } from "../../../../lib/perms";

const KIND = { system: "Systeempagina", content: "Eigen pagina", link: "Link" };
const AUDIENCE = { all: "Iedereen", members: "Alleen ingelogde users", guests: "Alleen bezoekers (niet ingelogd)" };
const EMPTY = { kind: "content", title: {}, url: "", audience: "all", new_tab: false, in_menu: true };

const Sw = ({ checked, onChange, disabled, label }) => (
  <label className="check sec-toggle">
    <span className="switch"><input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /><span /></span>
    {label && <span>{label}</span>}
  </label>
);

export default function PagesAdmin() {
  const { user } = useAuth();
  const mods = useModules();
  const router = useRouter();
  const L = lvl(user, "pages");
  const [pages, setPages] = useState(null);
  const [langs, setLangs] = useState({ languages: [], default: "nl" });
  const [msg, setMsg] = useState(null);
  const [modal, setModal] = useState(null);

  const load = useCallback(() => api("/pages/").then((d) => setPages(d.pages)).catch((e) => setMsg({ ok: false, text: errorText(e) })), []);
  useEffect(() => {
    if (mods.pages === false || L < 1) router.replace("/dashboard/admin");
    else { load(); api("/languages/").then(setLangs).catch(() => {}); }
  }, [mods.pages, L, load, router]);

  const label = (p) => menuLabel(p.title);
  const act = async (fn) => { setMsg(null); try { await fn(); await load(); router.refresh(); } catch (e) { setMsg({ ok: false, text: errorText(e) }); } };
  const patch = (p, body) => act(() => api(`/pages/${p.id}/`, { method: "PATCH", body }));

  // ── menu structure: top level items with their sub items ──────────────────
  const tree = useMemo(() => {
    const inMenu = (pages || []).filter((p) => p.in_menu);
    const tops = inMenu.filter((p) => !p.parent || !inMenu.some((x) => x.id === p.parent)).sort((a, b) => a.order - b.order);
    return tops.map((t) => ({ ...t, kids: inMenu.filter((c) => c.parent === t.id).sort((a, b) => a.order - b.order) }));
  }, [pages]);
  const saveStructure = (next) => {
    const items = [];
    next.forEach((t) => { items.push({ id: t.id, parent: null }); t.kids.forEach((k) => items.push({ id: k.id, parent: t.id })); });
    const used = new Set(items.map((i) => i.id));
    (pages || []).filter((p) => !used.has(p.id)).forEach((p) => items.push({ id: p.id, parent: null }));
    return act(() => api("/pages/order/", { method: "PUT", body: { items } }));
  };
  const clone = () => tree.map((t) => ({ ...t, kids: [...t.kids] }));
  const moveTop = (i, d) => { const n = clone(); [n[i], n[i + d]] = [n[i + d], n[i]]; saveStructure(n); };
  const moveKid = (i, j, d) => { const n = clone(); const k = n[i].kids; [k[j], k[j + d]] = [k[j + d], k[j]]; saveStructure(n); };
  const indent = (i) => { const n = clone(); if (i === 0 || n[i].kids.length) return; const [it] = n.splice(i, 1); n[i - 1].kids.push(it); saveStructure(n); };
  const outdent = (i, j) => { const n = clone(); const [it] = n[i].kids.splice(j, 1); n.splice(i + 1, 0, { ...it, kids: [] }); saveStructure(n); };
  const notInMenu = (pages || []).filter((p) => !p.in_menu);
  const setAudience = (p, v) => patch(p, v === "hidden" ? { in_menu: false } : { in_menu: true, audience: v });

  async function save(e) {
    e.preventDefault();
    const { id, ...body } = modal;
    try {
      if (id) await api(`/pages/${id}/`, { method: "PATCH", body: { title: body.title, audience: body.audience, new_tab: body.new_tab, ...(body.kind === "link" ? { url: body.url } : {}) } });
      else await api("/pages/", { method: "POST", body });
      setModal(null); await load(); router.refresh();
    } catch (err) { setModal({ ...modal, error: errorText(err) }); }
  }
  async function remove(p) {
    if (await confirmDialog(tx("Pagina \"{0}\" verwijderen?", label(p)), { danger: true })) act(() => api(`/pages/${p.id}/`, { method: "DELETE" }));
  }

  if (!pages) return msg ? <div className="alert">{msg.text}</div> : <p className="muted">{tx("Laden…")}</p>;
  const status = (p) => (!p.enabled ? ["off", tx("Uit")] : !p.available ? ["off", tx("Module uit")] : ["ok", tx("Aan")]);
  const editLangs = langs.languages.length ? langs.languages : [{ code: "nl", native_name: "Nederlands" }];
  const visible = (p) => p.enabled && p.available;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{tx("Pagina's")}</h1>
          <p className="muted" style={{ margin: 0 }}>{tx("Alle pagina's van de website en het menu in de header. Alleen wat aan staat wordt getoond.")}</p>
        </div>
        <div className="row"><CollapseAll />{L >= 3 && <button className="btn primary" onClick={() => setModal({ ...EMPTY })}>{tx("+ Nieuwe pagina of link")}</button>}</div>
      </div>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}

      <Collapsible id="pages-overview" title={tx("Overzicht van de pagina's")}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>{tx("Pagina")}</th><th>{tx("Adres")}</th><th>{tx("Status")}</th><th>{tx("Actief")}</th><th>{tx("In menu")}</th><th /></tr></thead>
            <tbody>
              {pages.map((p) => {
                const [cls, text] = status(p);
                return (
                  <tr key={p.id}>
                    <td><strong>{label(p)}</strong><br /><small className="muted">{tx(KIND[p.kind])}{p.audience !== "all" ? ` · ${tx(AUDIENCE[p.audience])}` : ""}</small></td>
                    <td><code>{p.path}</code></td>
                    <td><span className={`badge ${cls}`}>{text}</span></td>
                    <td><Sw checked={p.enabled} disabled={L < 2 || p.locked} onChange={(v) => patch(p, { enabled: v })} /></td>
                    <td><Sw checked={p.in_menu} disabled={L < 2} onChange={(v) => patch(p, { in_menu: v })} /></td>
                    <td className="actions">
                      <a className="btn sm" href={p.path} target="_blank" rel="noreferrer">{tx("Openen")}</a>
                      {L >= 2 && <button className="btn sm" onClick={() => setModal({ ...p })}>{p.kind === "system" ? tx("Naam") : tx("Wijzig")}</button>}
                      {L >= 3 && p.kind !== "system" && <button className="btn sm danger" onClick={() => remove(p)}>{tx("Verwijder")}</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <small className="muted">{tx("Een pagina waarvan de module uit staat (bijvoorbeeld Producten) verdwijnt vanzelf uit de website en het menu. De tekst van een eigen pagina bewerk je op de pagina zelf in de bewerkmodus.")}</small>
      </Collapsible>

      <Collapsible id="pages-menu" title={tx("Menu-editor (header)")}>
        <div>
          <strong style={{ fontSize: ".85rem" }}>{tx("Zo ziet het menu eruit")}</strong>
          <nav className="site-nav menu-preview">
            {tree.filter(visible).map((t) => (
              <span key={t.id} className="nav-drop">
                <a>{label(t)}</a>
                {t.kids.some(visible) && <span className="nav-drop-menu">{t.kids.filter(visible).map((k) => <a key={k.id}>{label(k)}</a>)}</span>}
              </span>
            ))}
            {!tree.some(visible) && <span className="muted">{tx("Het menu is leeg.")}</span>}
          </nav>
        </div>
        <div className="menu-edit">
          {tree.map((t, i) => (
            <div key={t.id} className="menu-group">
              <MenuRow p={t} name={label(t)} status={status(t)} can={L >= 2}
                up={i > 0 && (() => moveTop(i, -1))} down={i < tree.length - 1 && (() => moveTop(i, 1))}
                indent={i > 0 && !t.kids.length && (() => indent(i))} onPick={(v) => setAudience(t, v)} />
              {t.kids.map((k, j) => (
                <MenuRow key={k.id} child p={k} name={label(k)} status={status(k)} can={L >= 2}
                  up={j > 0 && (() => moveKid(i, j, -1))} down={j < t.kids.length - 1 && (() => moveKid(i, j, 1))}
                  outdent={() => outdent(i, j)} onPick={(v) => setAudience(k, v)} />
              ))}
            </div>
          ))}
          {!tree.length && <p className="muted" style={{ margin: 0 }}>{tx("Er staat nog niets in het menu.")}</p>}
        </div>
        {notInMenu.length > 0 && (
          <div className="menu-edit">
            <strong style={{ fontSize: ".85rem" }}>{tx("Niet in het menu")}</strong>
            {notInMenu.map((p) => <MenuRow key={p.id} p={p} name={label(p)} status={status(p)} can={L >= 2} onPick={(v) => setAudience(p, v)} />)}
          </div>
        )}
        <small className="muted">{tx("Maak een dropdown door een item met → onder het vorige item te zetten. Een dropdown kan één niveau diep.")}</small>
      </Collapsible>

      {modal && (
        <div className="overlay" onClick={() => setModal(null)}>
          <form className="card modal form" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h2>{modal.id ? tx("Pagina wijzigen") : tx("Nieuwe pagina of link")}</h2>
            {!modal.id && (
              <label>{tx("Soort")}
                <select value={modal.kind} onChange={(e) => setModal({ ...modal, kind: e.target.value })}>
                  <option value="content">{tx("Eigen pagina (met tekst)")}</option><option value="link">{tx("Link naar een adres")}</option>
                </select>
              </label>
            )}
            <strong style={{ fontSize: ".85rem" }}>{tx("Naam per taal")}</strong>
            <div className="theme-grid">
              {editLangs.map((l) => (
                <label key={l.code}>{l.native_name}
                  <input value={modal.title?.[l.code] || ""} maxLength={80} required={l.code === langs.default} onChange={(e) => setModal({ ...modal, title: { ...modal.title, [l.code]: e.target.value } })} />
                </label>
              ))}
            </div>
            {modal.kind === "link" && <label>{tx("Link")}<input value={modal.url} onChange={(e) => setModal({ ...modal, url: e.target.value })} placeholder="https://… of /pad" required /></label>}
            {modal.kind !== "system" && (
              <div className="theme-grid">
                <label>{tx("Voor wie")}
                  <select value={modal.audience} onChange={(e) => setModal({ ...modal, audience: e.target.value })}>{Object.entries(AUDIENCE).map(([k, v]) => <option key={k} value={k}>{tx(v)}</option>)}</select>
                </label>
                <Sw label={tx("Opent in een nieuw tabblad")} checked={!!modal.new_tab} onChange={(v) => setModal({ ...modal, new_tab: v })} />
              </div>
            )}
            {modal.error && <div className="alert">{modal.error}</div>}
            <div className="row"><button type="button" className="btn" onClick={() => setModal(null)}>{tx("Annuleren")}</button><button className="btn primary">{tx("Opslaan")}</button></div>
          </form>
        </div>
      )}
    </>
  );
}

// Who sees a menu item: everyone, logged-in users, visitors only (not logged in), or nobody (not in the menu)
const AUDIENCES = [
  ["all", VISIBILITY_ICON.public, "Zichtbaar voor iedereen"],
  ["members", VISIBILITY_ICON.members, "Alleen zichtbaar voor ingelogde users"],
  ["guests", <IconUser key="g" width={16} height={16} />, "Alleen zichtbaar voor bezoekers (niet ingelogd)"],
  ["hidden", VISIBILITY_ICON.hidden, "Onzichtbaar (niet in het menu)"],
];
const current = (p) => (!p.in_menu ? "hidden" : p.audience);

function AudiencePicker({ p, onPick, disabled }) {
  const cur = current(p);
  return (
    <span className="vis-buttons" role="radiogroup" aria-label={tx("Wie ziet dit item")}>
      {AUDIENCES.map(([v, icon, hint]) => (
        <button key={v} type="button" role="radio" aria-checked={v === cur} disabled={disabled} title={tx(hint)}
          className={`vis-btn ${v === cur ? "active" : ""}`} onClick={() => v !== cur && onPick(v)}>{icon}</button>
      ))}
    </span>
  );
}

function MenuRow({ p, name, status, child, can, up, down, indent, outdent, onPick }) {
  return (
    <div className={`menu-row ${child ? "child" : ""}`}>
      <span className="grow"><strong>{name}</strong> <small className="muted">{p.path}</small></span>
      <span className={`badge ${status[0]}`}>{status[1]}</span>
      {can && (
        <span className="request-actions">
          <button type="button" className="btn sm" disabled={!up} onClick={up || undefined} title={tx("Omhoog")}>↑</button>
          <button type="button" className="btn sm" disabled={!down} onClick={down || undefined} title={tx("Omlaag")}>↓</button>
          {!child && <button type="button" className="btn sm" disabled={!indent} onClick={indent || undefined} title={tx("Onder het vorige item (dropdown)")}>→</button>}
          {child && <button type="button" className="btn sm" onClick={outdent} title={tx("Naar het hoofdmenu")}>←</button>}
        </span>
      )}
      <AudiencePicker p={p} disabled={!can} onPick={onPick} />
    </div>
  );
}
