"use client";

import { Busy } from "../../../../components/PageLoader";
import { tx } from "../../../../lib/t";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import Collapsible, { CollapseAll } from "../../../../components/Collapsible";
import { useModules } from "../../../../components/Modules";
import Tabs from "../../../../components/Tabs";
import { useSession } from "../../../../components/Session";
import PagePreview from "../../../../components/PagePreview";
import PageSettingsModal from "../../../../components/PageSettingsModal";
import MenuPreview from "../../../../components/MenuPreview";
import MenuSettingsAdmin from "../../../../components/MenuSettingsAdmin";
import { DEFAULT_MENU, menuLabel } from "../../../../components/SiteMenu";
import { IconUser } from "../../../../components/Icons";
import { VISIBILITY_ICON } from "../../../../components/VisibilityPicker";
import ViewBar from "../../../../components/ViewBar";
import TableView from "../../../../components/TableView";
import { useView } from "../../../../lib/useView";
import { api, apiBase, errorText, getToken } from "../../../../lib/api";
import { confirmDialog } from "../../../../lib/dialog";
import { lvl } from "../../../../lib/perms";

// the pages whose blocks can be looked at and edited right here: own pages, and the standard pages that have blocks
const WITH_BLOCKS = { members: "members", products: "products", subscriptions: "subscriptions", donations: "donations", "plugin-games": "games", cart: "cart", checkout: "checkout", product: "product", community: "community", search: "search", payment: "payment" };
const blocksKey = (p) => (p.kind === "content" ? p.key : WITH_BLOCKS[p.key] || null);
const KIND = { system: "Systeempagina", content: "Eigen pagina", link: "Link", menu: "Menu-item" };
const AUDIENCE = { all: "Iedereen", members: "Alleen ingelogde users", guests: "Alleen bezoekers (niet ingelogd)" };
const EMPTY = { kind: "content", title: {}, url: "", audience: "all", new_tab: false, in_menu: true };

const Sw = ({ checked, onChange, disabled, label }) => (
  <label className="check sec-toggle">
    <span className="switch"><input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /><span /></span>
    {label && <span>{label}</span>}
  </label>
);

export default function PagesAdmin() {
  const tv = useView("pages", "list");
  const { user } = useAuth();
  const mods = useModules();
  const router = useRouter();
  const [settings, setSettings] = useState(null); // page whose settings pop-up is open
  const [view, setView] = useState(null); // the page shown (and edited) in this screen: {url, title, edit}
  const { canEdit, setEditMode } = useSession();
  // open the page with edit mode switched on, so the texts can be changed right there
  const editPage = (p) => { setEditMode(true); router.push(p.path); };
  const L = lvl(user, "pages");
  const [pages, setPages] = useState(null);
  const [scope, setScope] = useState("public"); // public: the website · private: behind the login, in the dashboard
  const priv = scope === "private";
  const [langs, setLangs] = useState({ languages: [], default: "nl" });
  const [msg, setMsg] = useState(null);
  const [modal, setModal] = useState(null);
  const [ai, setAi] = useState(false); // Claude is connected: names are translated into every language
  const [drag, setDrag] = useState(null); // the page that is being dragged in the menu editor
  const [over, setOver] = useState(null); // the menu item it is above
  const [busy, setBusy] = useState(false);
  const [menuTab, setMenuTab] = useState("menu"); // Menu | Instellingen
  const [menuCfg, setMenuCfg] = useState(null); // the menu settings (the preview shows the menu as they say)
  const [pvDevice, setPvDevice] = useState("desktop");
  const [pvScrolled, setPvScrolled] = useState(false);
  const pvDrop = useRef(null);
  const [nameLang, setNameLang] = useState(""); // the language tab of the name in the pop-up

  const load = useCallback(() => api(`/pages/?scope=${scope}`).then((d) => { setPages(d.pages); setAi(!!d.ai); }).catch((e) => setMsg({ ok: false, text: errorText(e) })), [scope]);
  useEffect(() => {
    if (mods.pages === false || L < 1) router.replace("/dashboard/admin");
    else { load(); api("/languages/").then(setLangs).catch(() => {}); }
  }, [mods.pages, L, load, router]);

  const label = (p) => menuLabel(p.title);
  useEffect(() => {
    if (scope !== "public") return undefined;
    const loadCfg = () => api("/pages/menu-settings/").then((d) => setMenuCfg({ ...DEFAULT_MENU, ...d })).catch(() => setMenuCfg({ ...DEFAULT_MENU }));
    loadCfg();
    window.addEventListener("pages-changed", loadCfg);
    return () => window.removeEventListener("pages-changed", loadCfg);
  }, [scope, menuTab]);
  const act = async (fn) => { setMsg(null); try { await fn(); await load(); router.refresh(); window.dispatchEvent(new Event("pages-changed")); } catch (e) { setMsg({ ok: false, text: errorText(e) }); } };
  const fileIn = useRef(null);
  const [fKind, setFKind] = useState(""); // filter of the list: kind, status, menu
  const [fState, setFState] = useState("");
  const [fMenu, setFMenu] = useState("");
  async function exportPage(p) { // the page with its blocks, linked content and pictures as a zip
    setMsg(null);
    const res = await fetch(`${apiBase()}/api/pages/${p.id}/export/`, { headers: { Authorization: `Token ${getToken()}` } });
    if (!res.ok) return setMsg({ ok: false, text: tx("De pagina kon niet worden geëxporteerd.") });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await res.blob()); a.download = `page-${p.key}.zip`; a.click();
    setMsg({ ok: true, text: tx("De pagina is geëxporteerd en staat ook in de map site/{0}/{1}.", priv ? "private" : "public", p.key) });
  }
  async function importPage(file) { // a zip from the export of another website
    if (!file) return;
    setBusy(true); setMsg(null);
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("scope", scope);
      const r = await api("/pages/import/", { method: "POST", body: fd });
      await load(); router.refresh(); window.dispatchEvent(new Event("pages-changed"));
      setMsg({ ok: true, text: [tx("De pagina {0} is geïmporteerd ({1} bestanden, {2} teksten). Hij gebruikt het thema van deze website.", menuLabel(r.page.title), r.media, r.blocks), ...(r.notes || [])].join(" ") });
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  }
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
    if (!(body.kind === "menu" && ai && !id) && !body.title?.[langs.default]) { setNameLang(langs.default); setModal({ ...modal, error: tx("Vul de naam in de standaardtaal in.") }); return; }
    setBusy(true);
    try {
      if (!id && body.kind === "menu" && ai) { // one name in the default language: Claude makes it in every language (also the ones that are off)
        const src = body.title?.[langs.default] || Object.values(body.title || {}).find(Boolean) || "";
        body.title = (await api("/pages/translate/", { method: "POST", body: { text: src } })).titles;
      }
      if (id) await api(`/pages/${id}/`, { method: "PATCH", body: { title: body.title, audience: body.audience, new_tab: body.new_tab, ...(body.kind === "link" ? { url: body.url } : {}) } });
      else await api("/pages/", { method: "POST", body: { ...body, scope } });
      setModal(null); await load(); router.refresh(); window.dispatchEvent(new Event("pages-changed"));
    } catch (err) { setModal({ ...modal, error: errorText(err) }); }
    setBusy(false);
  }
  async function translateAgain() { // an existing menu item: fill every language from the default one
    setBusy(true);
    try { const r = await api("/pages/translate/", { method: "POST", body: { text: modal.title?.[langs.default] || "" } }); setModal({ ...modal, title: { ...modal.title, ...r.titles }, error: "" }); } catch (err) { setModal({ ...modal, error: errorText(err) }); }
    setBusy(false);
  }

  // drag a page onto a menu item: it goes under it (a dropdown); onto the left or right edge of an item: before or after it
  async function place(targetId, pos = "into") {
    const x = (pages || []).find((p) => p.id === drag);
    setDrag(null); setOver(null);
    if (!x || x.id === targetId || L < 2) return;
    const had = tree.find((t) => t.id === x.id);
    const t0 = tree.find((t) => t.id === targetId) || tree.find((t) => t.kids.some((k) => k.id === targetId));
    if (!t0) return;
    const targetIsKid = !tree.some((t) => t.id === targetId);
    if (had?.kids.length && (pos === "into" || targetIsKid)) { setMsg({ ok: false, text: tx("Een item met subitems kan niet onder een ander item komen.") }); return; }
    if (!x.in_menu) { try { await api(`/pages/${x.id}/`, { method: "PATCH", body: { in_menu: true } }); } catch (e) { setMsg({ ok: false, text: errorText(e) }); return; } }
    const next = clone().map((t) => ({ ...t, kids: t.kids.filter((k) => k.id !== x.id) })).filter((t) => t.id !== x.id || t.kids.length);
    const item = { ...x, kids: had ? had.kids : [] };
    if (pos === "into" && !targetIsKid) next.find((t) => t.id === targetId).kids.push({ ...item, kids: [] });
    else if (targetIsKid) {
      const par = next.find((t) => t.kids.some((k) => k.id === targetId));
      const at = par.kids.findIndex((k) => k.id === targetId);
      par.kids.splice(pos === "after" ? at + 1 : at, 0, { ...item, kids: [] });
    } else {
      const at = next.findIndex((t) => t.id === targetId);
      next.splice(pos === "after" ? at + 1 : at, 0, item);
    }
    saveStructure(next);
  }
  const dropOn = (id) => place(id, "into");
  // dropped back on "Niet in het menu": the item leaves the menu (its sub items stay in the menu as items of their own)
  async function removeFromMenu() {
    const x = (pages || []).find((p) => p.id === drag);
    setDrag(null); setOver(null);
    if (!x || !x.in_menu || L < 2) return;
    const had = tree.find((t) => t.id === x.id);
    try { await api(`/pages/${x.id}/`, { method: "PATCH", body: { in_menu: false } }); } catch (e) { setMsg({ ok: false, text: errorText(e) }); return; }
    const next = [];
    clone().forEach((t) => { if (t.id === x.id) (had?.kids || []).forEach((k) => next.push({ ...k, kids: [] })); else next.push({ ...t, kids: t.kids.filter((k) => k.id !== x.id) }); });
    saveStructure(next);
  }
  const [dropPos, setDropPos] = useState(null); // {id, pos: before | after} above an item of the menu preview
  const startPv = (e, id) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(id)); setTimeout(() => setDrag(id), 0); };
  const endPv = () => { setDrag(null); setOver(null); setDropPos(null); };
  const hoverPv = (e, id, top) => { // the left or right edge of an item = before / after it; the middle = under it (a sub menu)
    if (drag == null || drag === id) return;
    e.preventDefault(); e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    const edge = top ? (x < 0.25 ? "before" : x > 0.75 ? "after" : null) : (y < 0.5 ? "before" : "after");
    if (edge) { setOver(null); setDropPos((d) => (d?.id === id && d.pos === edge ? d : { id, pos: edge })); } else { setDropPos(null); setOver(id); }
  };
  const dropPv = (e, id) => { e.preventDefault(); e.stopPropagation(); const pos = dropPos?.id === id ? dropPos.pos : "into"; setDropPos(null); place(id, pos); };
  // the preview shows the real menu: its items are the pages of the menu; events are handled by delegation
  const pvItems = useMemo(() => tree.map((t) => ({ id: t.id, key: t.key, kind: t.kind, titles: t.title, url: t.path, urls: {}, audience: "all", devices: t.devices || {}, cta: t.cta, label_link: t.label_link, children: t.kids.map((k) => ({ id: k.id, key: k.key, kind: k.kind, titles: k.title, url: k.path, urls: {}, audience: "all", devices: k.devices || {}, cta: k.cta, children: [] })) })), [tree]);
  const markEl = (el, cls) => { document.querySelectorAll(".hm-prev-frame [data-mid].drop-into, .hm-prev-frame [data-mid].drop-before, .hm-prev-frame [data-mid].drop-after").forEach((n) => n.classList.remove("drop-into", "drop-before", "drop-after")); if (el && cls) el.classList.add(cls); };
  const midOf = (e) => e.target.closest?.("[data-mid]");
  const frameHandlers = {
    onDragStart: (e) => { const el = midOf(e); if (el) startPv(e, Number(el.dataset.mid)); },
    onDragEnd: () => { markEl(null); pvDrop.current = null; endPv(); },
    onDragOver: (e) => {
      if (drag == null) return;
      e.preventDefault();
      const el = midOf(e);
      if (!el || Number(el.dataset.mid) === drag) { markEl(null); pvDrop.current = null; return; }
      const r = el.getBoundingClientRect();
      const vertical = menuCfg && !["bar", "bottom"].includes(menuCfg.forms[pvDevice]);
      const t = vertical || el.dataset.top === "0" ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
      const top = el.dataset.top === "1";
      const pos = top ? (t < 0.25 ? "before" : t > 0.75 ? "after" : "into") : (t < 0.5 ? "before" : "after");
      pvDrop.current = { id: Number(el.dataset.mid), pos };
      markEl(el, `drop-${pos}`);
    },
    onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) { markEl(null); pvDrop.current = null; } },
    onDrop: (e) => {
      e.preventDefault();
      const d = pvDrop.current; pvDrop.current = null; markEl(null);
      if (d) place(d.id, d.pos);
      else { const last = tree.slice(-1)[0]; if (last && last.id !== drag) place(last.id, "after"); }
    },
  };
  async function remove(p) {
    if (await confirmDialog(tx("Pagina \"{0}\" verwijderen?", label(p)), { danger: true })) act(() => api(`/pages/${p.id}/`, { method: "DELETE" }));
  }

  if (!pages) return msg ? <div className="alert">{msg.text}</div> : <Busy />;
  const status = (p) => (!p.enabled ? ["off", tx("Uit")] : !p.available ? ["off", tx("Module uit")] : ["ok", tx("Aan")]);
  const editLangs = langs.languages.length ? langs.languages : [{ code: "nl", native_name: "Nederlands" }];
  const activeLang = editLangs.some((l) => l.code === nameLang) ? nameLang : langs.default;
  const visible = (p) => p.enabled && p.available;
  const shown = pages.filter((p) => tv.match(label(p), p.path, p.key, tx(KIND[p.kind])) && (!fKind || p.kind === fKind) && (!fState || (fState === "on") === visible(p)) && (!fMenu || (fMenu === "in") === p.in_menu));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{tx("Pagina's")}</h1>
          <p className="muted" style={{ margin: 0 }}>{priv ? tx("Privé pagina's: alleen voor ingelogde leden, op /dashboard/<pagina>, met een eigen menu in de header van het dashboard.") : tx("Alle pagina's van de website en het menu in de header. Alleen wat aan staat wordt getoond.")}</p>
        </div>
        <div className="row"><CollapseAll /></div>
      </div>
      <Tabs value={scope} onChange={(v) => { setPages(null); setScope(v); }} tabs={[["public", "Openbaar"], ["private", "Privé"]]} />
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}

      {view && <PagePreview key={`${view.key}-${view.edit}`} pageKey={view.key} path={view.url} withTitle={view.withTitle} title={view.title} startEdit={view.edit} onClose={() => setView(null)} />}
      <Collapsible id={`pages-overview-${scope}`} title={priv ? tx("Overzicht van de privé pagina's") : tx("Overzicht van de pagina's")}>
        <ViewBar view={tv} count={shown.length}
          extra={<>
            <select value={fKind} onChange={(e) => setFKind(e.target.value)} aria-label={tx("Soort")}><option value="">{tx("Alle soorten")}</option>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{tx(v)}</option>)}</select>
            <select value={fState} onChange={(e) => setFState(e.target.value)} aria-label={tx("Status")}><option value="">{tx("Alle statussen")}</option><option value="on">{tx("Aan")}</option><option value="off">{tx("Uit")}</option></select>
            <select value={fMenu} onChange={(e) => setFMenu(e.target.value)} aria-label={tx("In menu")}><option value="">{tx("Menu: alles")}</option><option value="in">{tx("In het menu")}</option><option value="out">{tx("Niet in het menu")}</option></select>
          </>} />
        {L >= 3 && (
          <div className="row" style={{ marginBottom: ".5rem" }}>
            <button type="button" className="btn sm" disabled={busy} onClick={() => fileIn.current?.click()}>{tx("Pagina importeren (.zip)")}</button>
            <input ref={fileIn} type="file" accept=".zip,application/zip" hidden onChange={(e) => { importPage(e.target.files[0]); e.target.value = ""; }} />
          </div>
        )}
        <TableView view={tv}>
          <table>
            <thead><tr><th>{tx("Pagina")}</th><th>{tx("Adres")}</th><th>{tx("Status")}</th><th>{tx("Actief")}</th><th>{tx("In menu")}</th><th /></tr></thead>
            <tbody>
              {shown.map((p) => {
                const [cls, text] = status(p);
                return (
                  <tr key={p.id}>
                    <td><strong>{label(p)}</strong><br /><small className="muted">{tx(KIND[p.kind])}{p.audience !== "all" ? ` · ${tx(AUDIENCE[p.audience])}` : ""}</small></td>
                    <td><code>{p.path}</code></td>
                    <td><span className={`badge ${cls}`}>{text}</span></td>
                    <td><Sw checked={p.enabled} disabled={L < 2 || p.locked} onChange={(v) => patch(p, { enabled: v })} /></td>
                    <td><Sw checked={p.in_menu} disabled={L < 2} onChange={(v) => patch(p, { in_menu: v })} /></td>
                    <td className="actions">
                      {blocksKey(p) && <button className="btn sm" onClick={() => { setView({ key: blocksKey(p), url: p.path, title: label(p), withTitle: p.kind === "content", edit: false }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{tx("Bekijken")}</button>}
                      {blocksKey(p) && canEdit && <button className="btn sm primary" onClick={() => { setView({ key: blocksKey(p), url: p.path, title: label(p), withTitle: p.kind === "content", edit: true }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{tx("Bewerken")}</button>}
                      <a className="btn sm" href={p.path} {...(priv ? {} : { target: "_blank", rel: "noreferrer" })}>{tx("Openen")}</a>
                      {L >= 2 && p.kind === "content" && <button className="btn sm" onClick={() => exportPage(p)}>{tx("Exporteren")}</button>}
                      {L >= 2 && <button className="btn sm" onClick={() => setSettings(p)}>{tx("Instellingen")}</button>}
                      {L >= 3 && p.kind !== "system" && <button className="btn sm danger" onClick={() => remove(p)}>{tx("Verwijder")}</button>}
                    </td>
                  </tr>
                );
              })}
              {!shown.length && <tr><td colSpan={6} className="muted">{tx("Geen pagina's gevonden.")}</td></tr>}
            </tbody>
          </table>
        </TableView>
        <small className="muted">{tx("Een pagina waarvan de module uit staat (bijvoorbeeld Producten) verdwijnt vanzelf uit de website en het menu. De tekst van een eigen pagina bewerk je op de pagina zelf in de bewerkmodus.")}</small>
      </Collapsible>

      <Collapsible id={`pages-menu-${scope}`} title={priv ? tx("Privé menu (header van het dashboard)") : tx("Menu-editor (header)")}>
        {!priv && <Tabs value={menuTab} onChange={setMenuTab} tabs={[["menu", "Menu"], ["settings", "Instellingen"]]} />}
        {!priv && menuTab === "settings" && <MenuSettingsAdmin canEdit={L >= 3} />}
        {(priv || menuTab === "menu") && <>
        <div>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "nowrap" }}>
            <strong style={{ fontSize: ".85rem" }}>{tx("Zo ziet het menu eruit")}</strong>
            {L >= 3 && <button type="button" className="btn primary sm" onClick={() => setModal({ ...EMPTY })}>{tx("+ Nieuw item")}</button>}
          </div>
          {!priv && menuCfg && (
            <>
              <div className="hm-prev-bar">
                <span className="hm-devices" role="group" aria-label={tx("Apparaat")}>
                  {[["desktop", "Computer", <svg key="d" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>],
                    ["tablet", "Tablet", <svg key="t" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M11 18h2" /></svg>],
                    ["mobile", "Telefoon", <svg key="m" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></svg>]].map(([k, l, ic]) => (
                    <button key={k} type="button" className={pvDevice === k ? "on" : ""} onClick={() => setPvDevice(k)} title={tx(l)} aria-pressed={pvDevice === k}>{ic}{tx(l)}</button>
                  ))}
                </span>
                <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={pvScrolled} onChange={(e) => setPvScrolled(e.target.checked)} /><span /></span><span>{tx("Na het scrollen")}</span></label>
              </div>
              <MenuPreview items={pvItems} cfg={menuCfg} device={pvDevice} scrolled={pvScrolled} draggable={L >= 2} handlers={frameHandlers} />
            </>
          )}
          {priv && (
          <nav className="site-nav menu-preview" onDragOver={(e) => { if (drag != null) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); const last = tree.filter((t) => visible(t) || t.kind === "menu").slice(-1)[0]; if (last) place(last.id, "after"); }}>
            {tree.filter((t) => visible(t) || t.kind === "menu").map((t) => (
              <span key={t.id} className={`nav-drop pv-item${over === t.id ? " drop-into" : ""}${dropPos?.id === t.id ? ` drop-${dropPos.pos}` : ""}`}
                onDragOver={(e) => hoverPv(e, t.id, true)} onDragLeave={() => { setOver(null); setDropPos(null); }} onDrop={(e) => dropPv(e, t.id)}>
                <a draggable={L >= 2} onDragStart={(e) => startPv(e, t.id)} onDragEnd={endPv}>{label(t)}</a>
                {(t.kids.some(visible) || (drag != null && t.kind === "menu")) && <span className="nav-drop-menu" onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOver(t.id); setDropPos(null); }} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); place(t.id, "into"); }}>
                  {t.kids.filter(visible).map((k) => <a key={k.id} className={dropPos?.id === k.id ? `drop-${dropPos.pos}` : ""} draggable={L >= 2} onDragStart={(e) => startPv(e, k.id)} onDragEnd={endPv} onDragOver={(e) => hoverPv(e, k.id, false)} onDrop={(e) => dropPv(e, k.id)}>{label(k)}</a>)}
                </span>}
              </span>
            ))}
            {!tree.some(visible) && <span className="muted">{tx("Het menu is leeg.")}</span>}
          </nav>
          )}
          <small className="muted">{tx("Sleep een item in dit menu: op een ander item = submenu, aan de rand = ervoor of erna. Items uit de lijst eronder kun je er ook naartoe slepen.")}</small>
        </div>
        <div className="menu-edit">
          {tree.map((t, i) => (
            <div key={t.id} className="menu-group">
              <MenuRow p={t} name={label(t)} status={status(t)} can={L >= 2} dnd={{ drag, over, setDrag, setOver, dropOn }}
                up={i > 0 && (() => moveTop(i, -1))} down={i < tree.length - 1 && (() => moveTop(i, 1))}
                indent={i > 0 && !t.kids.length && (() => indent(i))} onPick={(v) => setAudience(t, v)} />
              {t.kids.map((k, j) => (
                <MenuRow key={k.id} child p={k} name={label(k)} status={status(k)} can={L >= 2} dnd={{ drag, over, setDrag, setOver, dropOn }}
                  up={j > 0 && (() => moveKid(i, j, -1))} down={j < t.kids.length - 1 && (() => moveKid(i, j, 1))}
                  outdent={() => outdent(i, j)} onPick={(v) => setAudience(k, v)} />
              ))}
            </div>
          ))}
          {!tree.length && <p className="muted" style={{ margin: 0 }}>{tx("Er staat nog niets in het menu.")}</p>}
        </div>
        {(notInMenu.length > 0 || drag != null) && (
          <div className={`menu-edit menu-out${drag != null && tree.some((t) => t.id === drag || t.kids.some((k) => k.id === drag)) ? " accepting" : ""}${over === "out" ? " drop-here" : ""}`}
            onDragOver={(e) => { if (drag != null) { e.preventDefault(); if (over !== "out") setOver("out"); } }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver((o) => (o === "out" ? null : o)); }}
            onDrop={(e) => { e.preventDefault(); removeFromMenu(); }}>
            <strong style={{ fontSize: ".85rem" }}>{tx("Niet in het menu")}</strong>
            {drag != null && tree.some((t) => t.id === drag || t.kids.some((k) => k.id === drag)) && <small className="muted">{tx("Laat hier los om het uit het menu te halen.")}</small>}
            {notInMenu.map((p) => <MenuRow key={p.id} p={p} name={label(p)} status={status(p)} can={L >= 2} dnd={{ drag, over, setDrag, setOver, dropOn }} onPick={(v) => setAudience(p, v)} />)}
          </div>
        )}
        </>}
        <small className="muted">{tx("Maak een dropdown door een pagina met de greep ⋮⋮ naar een menu-item te slepen, of met → onder het vorige item te zetten. Een dropdown kan één niveau diep. Een menu-item (alleen tekst) maak je met + Nieuw item.")}</small>
      </Collapsible>

      {settings && (
        <PageSettingsModal page={settings} languages={langs.languages} defaultLang={langs.default} canSeo={mods?.seo !== false && lvl(user, "seo") >= 1}
          onClose={() => setSettings(null)} onSaved={async () => { setSettings(null); await load(); router.refresh(); setMsg({ ok: true, text: tx("Pagina-instellingen opgeslagen.") }); }} />
      )}

      {modal && (
        <div className="overlay" onClick={() => setModal(null)}>
          <form className="card modal form" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h2>{modal.id ? tx("Pagina wijzigen") : tx("Nieuw item")}</h2>
            {!modal.id && (
              <label>{tx("Soort")}
                <select value={modal.kind} onChange={(e) => setModal({ ...modal, kind: e.target.value })}>
                  <option value="content">{tx("Eigen pagina (met tekst)")}</option><option value="link">{tx("Link naar een adres")}</option><option value="menu">{tx("Menu-item (alleen tekst, voor een dropdown)")}</option>
                </select>
              </label>
            )}
            {modal.kind === "menu" && !modal.id && ai ? (
              <>
                <label>{tx("Naam")}
                  <input value={modal.title?.[langs.default] || ""} maxLength={80} required onChange={(e) => setModal({ ...modal, title: { [langs.default]: e.target.value } })} />
                </label>
                <small className="muted">{tx("Claude maakt de naam in alle talen, ook de talen die uit staan.")}</small>
              </>
            ) : (
              <>
            <strong style={{ fontSize: ".85rem" }}>{tx("Naam per taal")}</strong>
            {modal.kind === "menu" && !ai && !modal.id && <small className="muted">{tx("Claude is niet gekoppeld: vul de naam zelf in per taal. Koppelen kan bij Admin → API keys.")}</small>}
            {modal.kind === "menu" && ai && modal.id && <button type="button" className="btn sm" disabled={busy || !modal.title?.[langs.default]} onClick={translateAgain}>{tx("Vertaal naar alle talen")}</button>}
            <Tabs className="lang-tabs" value={activeLang} onChange={setNameLang} tabs={editLangs.map((l) => [l.code, l.native_name || l.code, null, modal.title?.[l.code] ? "✓" : null])} />
            {editLangs.filter((l) => l.code === activeLang).map((l) => (
              <label key={l.code}>{l.native_name}
                <input value={modal.title?.[l.code] || ""} maxLength={80} onChange={(e) => setModal({ ...modal, title: { ...modal.title, [l.code]: e.target.value } })} />
              </label>
            ))}
              </>
            )}
            {modal.kind === "link" && <label>{tx("Link")}<input value={modal.url} onChange={(e) => setModal({ ...modal, url: e.target.value })} placeholder="https://… of /pad" required /></label>}
            {modal.kind !== "system" && !priv && (
              <div className="theme-grid">
                <label>{tx("Voor wie")}
                  <select value={modal.audience} onChange={(e) => setModal({ ...modal, audience: e.target.value })}>{Object.entries(AUDIENCE).map(([k, v]) => <option key={k} value={k}>{tx(v)}</option>)}</select>
                </label>
                {modal.kind !== "menu" && <Sw label={tx("Opent in een nieuw tabblad")} checked={!!modal.new_tab} onChange={(v) => setModal({ ...modal, new_tab: v })} />}
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

function MenuRow({ p, name, status, child, can, up, down, indent, outdent, onPick, dnd }) {
  const target = !!dnd && !child && dnd.drag != null && dnd.drag !== p.id; // a menu item (top level) can receive a dragged page
  return (
    <div className={`menu-row ${child ? "child" : ""}${target && dnd.over === p.id ? " drop-here" : ""}`}
      onDragOver={target ? (e) => { e.preventDefault(); if (dnd.over !== p.id) dnd.setOver(p.id); } : undefined}
      onDragLeave={target ? () => dnd.setOver((o) => (o === p.id ? null : o)) : undefined}
      onDrop={target ? (e) => { e.preventDefault(); dnd.dropOn(p.id); } : undefined}>
      {can && dnd && (
        <span className="menu-grip" draggable title={tx("Sleep dit item naar het menu hierboven (op een item = submenu)")} aria-label={tx("Slepen")}
          onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(p.id)); const row = e.currentTarget.closest(".menu-row"); if (row) e.dataTransfer.setDragImage(row, 16, 16); setTimeout(() => dnd.setDrag(p.id), 0); }}
          onDragEnd={() => { dnd.setDrag(null); dnd.setOver(null); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.7" /><circle cx="15" cy="6" r="1.7" /><circle cx="9" cy="12" r="1.7" /><circle cx="15" cy="12" r="1.7" /><circle cx="9" cy="18" r="1.7" /><circle cx="15" cy="18" r="1.7" /></svg>
        </span>
      )}
      <span className="grow"><strong>{name}</strong> <small className="muted">{p.kind === "menu" ? tx("Menu-item (alleen tekst)") : p.path}</small></span>
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
