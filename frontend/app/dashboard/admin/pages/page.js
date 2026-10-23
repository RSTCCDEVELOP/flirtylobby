// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

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
import { alertDialog, confirmDialog } from "../../../../lib/dialog";
import { translateName } from "../../../../lib/translate-name";
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
    setMsg({ ok: true, text: tx("De pagina is geëxporteerd en staat ook in site/pages/{0}.zip.", p.key) });
  }
  const [sel, setSel] = useState(() => new Set()); // ids of the own pages that are selected for a package
  const toggleSel = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  async function exportSelected() { // a package (zip with the page, its pictures and videos, objects and what it needs) per selected page in site/pages/<page>.zip
    const menus = await confirmDialog(tx("Moeten de menu's ook mee? Dan gaan de plek in het menu, de volgorde en de dropdowns van de geselecteerde pagina's mee, zodat ze op de andere website op dezelfde plek komen."), { okLabel: tx("Ja, menu's meenemen"), cancelLabel: tx("Nee, alleen de pagina's") });
    const bundle = sel.size > 1 && await confirmDialog(tx("Wil je ook één totaalpakket van de {0} geselecteerde pagina's (selected_pages.zip)? Dat kun je in één keer importeren.", sel.size), { okLabel: tx("Ja, ook een totaalpakket"), cancelLabel: tx("Nee, alleen losse pakketten") });
    setBusy(true); setMsg(null);
    try {
      const r = await api("/pages/export/", { method: "POST", body: { ids: [...sel], bundle, menus } });
      const failed = Object.entries(r.failed || {});
      const text = tx("{0} pakketten staan in {1}.", r.files.length, r.folder) + (r.bundle ? `\n${tx("Totaalpakket")}: ${r.bundle}` : "") + (failed.length ? `\n${failed.map(([k, v]) => `${k}: ${v}`).join("\n")}` : "");
      setMsg({ ok: !failed.length, text: text.replace("\n", " ") });
      setSel(new Set());
      await alertDialog(`${tx("Export klaar")}\n${text}`);
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); await alertDialog(errorText(e)); }
    setBusy(false);
  }
  const [importPlan, setImportPlan] = useState(null); // {file, info, mode, menus}: what is in the package, and what to do with pages that exist already
  async function importPage(file) { // a zip from the export of another website (one page, or selected_pages.zip with several, maybe with menus)
    if (!file) return;
    setBusy(true); setMsg(null);
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("inspect", "1");
      const info = await api("/pages/import/", { method: "POST", body: fd });
      if (info.pages.some((p) => p.exists) || info.menu) { setImportPlan({ file, info, mode: "copy", menus: !!info.menu }); setBusy(false); return; }
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); setBusy(false); return; }
    await runImport(file, { mode: "copy", menus: false });
  }
  async function confirmImport() {
    const { file, info, mode, menus } = importPlan;
    const existing = info.pages.filter((p) => p.exists);
    if (mode === "replace" && existing.length && !(await confirmDialog(tx("Let op: deze pagina's bestaan al en worden overschreven. Hun blokken en teksten worden vervangen door die uit het pakket en dat kun je niet ongedaan maken:\n\n{0}", existing.map((p) => `• ${p.title} (/${p.key})`).join("\n")), { danger: true, okLabel: tx("Ja, overschrijven"), cancelLabel: tx("Annuleren") }))) return;
    setImportPlan(null);
    await runImport(file, { mode, menus });
  }
  async function runImport(file, { mode, menus }) {
    setBusy(true); setMsg(null);
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("scope", scope); fd.append("mode", mode); if (menus) fd.append("menus", "1");
      const r = await api("/pages/import/", { method: "POST", body: fd });
      await load(); router.refresh(); window.dispatchEvent(new Event("pages-changed"));
      const parts = [r.pages > 1 ? tx("{0} pagina's zijn geïmporteerd ({1} bestanden, {2} teksten). Ze gebruiken het thema van deze website.", r.pages, r.media, r.blocks) : r.pages === 1 && r.page ? tx("De pagina {0} is geïmporteerd ({1} bestanden, {2} teksten). Hij gebruikt het thema van deze website.", menuLabel(r.page.title), r.media, r.blocks) : "",
        r.replaced?.length ? tx("Overschreven: {0}.", r.replaced.join(", ")) : "", r.skipped?.length ? tx("Overgeslagen (bestonden al): {0}.", r.skipped.join(", ")) : "", r.menu_items ? tx("{0} menu-items geplaatst.", r.menu_items) : "", ...(r.notes || [])].filter(Boolean);
      setMsg({ ok: true, text: parts.join(" ") });
      const w = r.warnings || {};
      const todo = [
        ...(w.modules || []).map((m) => `${tx("Zet de module aan")}: ${m.label}`),
        ...(w.plugins || []).map((x) => `${x.state === "missing" ? tx("Installeer de plugin") : tx("Zet de plugin aan")}: ${x.title}${x.version ? ` ${x.version}` : ""}`),
        ...(w.objects || []).map((o) => `${tx("Maak het systeemobject")}: ${o.label || o.slug}`),
      ];
      if (todo.length) await alertDialog(`${tx("De pagina's zijn geïmporteerd, maar hebben nog dit nodig:")}\n\n${todo.map((x) => `• ${x}`).join("\n")}`);
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  }
  async function resetPage(p) { // a standard page that was changed: back to the first setup
    if (!(await confirmDialog(tx("\"{0}\" terugzetten naar de eerste opzet? De naam, het menu, de rechten, de blokken en de teksten van deze pagina worden vervangen door wat het systeem maakte. Wat je zelf hebt aangepast gaat verloren.", label(p)), { danger: true, okLabel: tx("Terugzetten"), cancelLabel: tx("Annuleren") }))) return;
    setBusy(true); setMsg(null);
    try {
      await api(`/pages/${p.id}/reset/`, { method: "POST", body: {} });
      await load(); router.refresh(); window.dispatchEvent(new Event("pages-changed"));
      setMsg({ ok: true, text: tx("\"{0}\" staat weer op de eerste opzet.", label(p)) });
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
      const main = (body.title?.[langs.default] || "").trim();
      if (main) body.title = { ...body.title, ...Object.fromEntries(editLangs.filter((l) => !(body.title?.[l.code] || "").trim()).map((l) => [l.code, main])) }; // a language left empty takes over the main language
      if (id) await api(`/pages/${id}/`, { method: "PATCH", body: { title: body.title, audience: body.audience, new_tab: body.new_tab, ...(body.kind === "link" ? { url: body.url } : {}) } });
      else await api("/pages/", { method: "POST", body: { ...body, scope } });
      setModal(null); await load(); router.refresh(); window.dispatchEvent(new Event("pages-changed"));
    } catch (err) { setModal({ ...modal, error: errorText(err) }); }
    setBusy(false);
  }
  const [trProg, setTrProg] = useState(null); // {done, total} while Claude translates the name
  async function translateAll() { // fill EVERY language (also the ones that are off) from the default one, with a progress bar
    const text = (modal.title?.[langs.default] || "").trim();
    if (!text) return;
    setBusy(true); setModal((m) => ({ ...m, error: "" }));
    try {
      const { titles, failed } = await translateName(text, langs.default, setTrProg);
      setModal((m) => ({ ...m, title: { ...m.title, ...titles }, error: failed ? tx("{0} talen konden niet worden vertaald; die nemen de hoofdtaal over.", failed) : "" }));
    } catch (err) { setModal((m) => ({ ...m, error: errorText(err) })); }
    setTrProg(null); setBusy(false);
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
          <p className="muted" style={{ margin: 0 }}>{priv ? tx("Dashboardpagina's: alleen voor ingelogde leden, op /dashboard/<pagina>, met een eigen menu in de header van het dashboard.") : tx("Alle pagina's van de website en het menu in de header. Alleen wat aan staat wordt getoond.")}</p>
        </div>
        <div className="row"><CollapseAll /></div>
      </div>
      <Tabs value={scope} onChange={(v) => { setPages(null); setScope(v); }} tabs={[["public", "Openbaar"], ["private", "Dashboard"]]} />
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}

      {view && <PagePreview key={`${view.key}-${view.edit}`} pageKey={view.key} path={view.url} withTitle={view.withTitle} title={view.title} startEdit={view.edit} onClose={() => setView(null)} />}
      <Collapsible id={`pages-overview-${scope}`} title={priv ? tx("Overzicht van de dashboardpagina's") : tx("Overzicht van de pagina's")}>
        <ViewBar view={tv} count={shown.length}
          after={L >= 3 && <button type="button" className="btn primary sm" onClick={() => setModal({ ...EMPTY })} title={tx("Nieuwe pagina")} aria-label={tx("Nieuwe pagina")}>{tx("+ Nieuwe pagina")}</button>}
          extra={<>
            <select value={fKind} onChange={(e) => setFKind(e.target.value)} aria-label={tx("Soort")}><option value="">{tx("Alle soorten")}</option>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{tx(v)}</option>)}</select>
            <select value={fState} onChange={(e) => setFState(e.target.value)} aria-label={tx("Status")}><option value="">{tx("Alle statussen")}</option><option value="on">{tx("Aan")}</option><option value="off">{tx("Uit")}</option></select>
            <select value={fMenu} onChange={(e) => setFMenu(e.target.value)} aria-label={tx("In menu")}><option value="">{tx("Menu: alles")}</option><option value="in">{tx("In het menu")}</option><option value="out">{tx("Niet in het menu")}</option></select>
          </>} />
        {L >= 2 && (
          <div className="row" style={{ marginBottom: ".5rem" }}>
            {L >= 3 && <button type="button" className="btn sm" disabled={busy} onClick={() => fileIn.current?.click()}>{tx("Pagina importeren (.zip)")}</button>}
            <input ref={fileIn} type="file" accept=".zip,application/zip" hidden onChange={(e) => { importPage(e.target.files[0]); e.target.value = ""; }} />
            <button type="button" className="btn sm primary" disabled={busy || !sel.size} onClick={exportSelected}>{tx("Pakketten maken")}{sel.size ? ` (${sel.size})` : ""}</button>
            {sel.size > 0 && <button type="button" className="btn sm" onClick={() => setSel(new Set())}>{tx("Selectie wissen")}</button>}
            {sel.size === 0 && <small className="muted">{tx("Vink eigen pagina's aan om er een pakket (zip) van te maken. Het komt in site/pages/.")}</small>}
          </div>
        )}
        <TableView view={tv}>
          <table>
            <thead><tr>{L >= 2 && <th style={{ width: "2rem" }}><input type="checkbox" aria-label={tx("Alle eigen pagina's selecteren")} checked={shown.some((p) => p.kind === "content") && shown.filter((p) => p.kind === "content").every((p) => sel.has(p.id))} onChange={(e) => setSel(e.target.checked ? new Set(shown.filter((p) => p.kind === "content").map((p) => p.id)) : new Set())} /></th>}<th>{tx("Pagina")}</th><th>{tx("Adres")}</th><th>{tx("Status")}</th><th>{tx("Actief")}</th><th>{tx("In menu")}</th><th /></tr></thead>
            <tbody>
              {shown.map((p) => {
                const [cls, text] = status(p);
                return (
                  <tr key={p.id}>
                    {L >= 2 && <td>{p.kind === "content" && <input type="checkbox" aria-label={tx("Selecteren")} checked={sel.has(p.id)} onChange={() => toggleSel(p.id)} />}</td>}
                    <td><strong>{label(p)}</strong><br /><small className="muted">{tx(KIND[p.kind])}{p.audience !== "all" ? ` · ${tx(AUDIENCE[p.audience])}` : ""}{p.resettable && p.modified ? ` · ${tx("gewijzigd")}` : ""}</small></td>
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
                      {L >= 3 && p.resettable && p.modified && <button className="btn sm" title={tx("Terug naar de eerste opzet van deze standaardpagina")} onClick={() => resetPage(p)}>{tx("Herstel")}</button>}
                      {L >= 3 && p.kind !== "system" && <button className="btn sm danger" onClick={() => remove(p)}>{tx("Verwijder")}</button>}
                    </td>
                  </tr>
                );
              })}
              {!shown.length && <tr><td colSpan={7} className="muted">{tx("Geen pagina's gevonden.")}</td></tr>}
            </tbody>
          </table>
        </TableView>
        <small className="muted">{tx("Een pagina waarvan de module uit staat (bijvoorbeeld Producten) verdwijnt vanzelf uit de website en het menu. De tekst van een eigen pagina bewerk je op de pagina zelf in de bewerkmodus.")}</small>
      </Collapsible>

      <Collapsible id={`pages-menu-${scope}`} title={priv ? tx("Dashboardmenu (header van het dashboard)") : tx("Menu-editor (header)")}>
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
        <PageSettingsModal ai={ai} page={settings} languages={langs.languages} defaultLang={langs.default} canSeo={mods?.seo !== false && lvl(user, "seo") >= 1}
          onClose={() => setSettings(null)} onSaved={async () => { setSettings(null); await load(); router.refresh(); setMsg({ ok: true, text: tx("Pagina-instellingen opgeslagen.") }); }} />
      )}

      {importPlan && (
        <div className="overlay" onClick={() => setImportPlan(null)}>
          <div className="card modal form" onClick={(e) => e.stopPropagation()}>
            <h2>{tx("Pakket importeren")}</h2>
            <div style={{ display: "grid", gap: ".3rem", maxHeight: "30vh", overflow: "auto" }}>
              {importPlan.info.pages.map((p) => (
                <div key={p.key} className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
                  <span><strong>{p.title}</strong> <small className="muted">/{p.key}</small></span>
                  {p.exists ? <span className="badge off">{tx("bestaat al")}</span> : <span className="badge ok">{tx("nieuw")}</span>}
                </div>
              ))}
            </div>
            {importPlan.info.pages.some((p) => p.exists) && (
              <>
                <div className="alert">{tx("Een of meer pagina's bestaan al op deze website. Kies wat er mee moet gebeuren.")}</div>
                {[["copy", "Een nieuwe pagina ernaast maken (met een nieuw adres)"], ["replace", "Bestaande pagina's overschrijven (blokken en teksten worden vervangen)"], ["skip", "Bestaande pagina's overslaan"]].map(([k, l]) => (
                  <label key={k} className="check" style={{ alignItems: "flex-start" }}>
                    <input type="radio" name="impmode" checked={importPlan.mode === k} onChange={() => setImportPlan({ ...importPlan, mode: k })} /><span>{tx(l)}</span>
                  </label>
                ))}
                {importPlan.mode === "replace" && importPlan.info.pages.some((p) => p.exists && !p.replaceable) && <small className="muted">{tx("Pagina's die geen eigen pagina zijn (systeempagina's of links) worden niet overschreven: daar komt een nieuwe pagina naast.")}</small>}
              </>
            )}
            {importPlan.info.menu && <Sw label={tx("Menu's ook importeren (plek in het menu, volgorde en dropdowns)")} checked={importPlan.menus} onChange={(v) => setImportPlan({ ...importPlan, menus: v })} />}
            <div className="row">
              <button type="button" className="btn" onClick={() => setImportPlan(null)}>{tx("Annuleren")}</button>
              <button type="button" className={`btn ${importPlan.mode === "replace" ? "danger" : "primary"}`} onClick={confirmImport}>{importPlan.mode === "replace" ? tx("Importeren en overschrijven") : tx("Importeren")}</button>
            </div>
          </div>
        </div>
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
            {ai && (
              <>
                <button type="button" className="btn sm" disabled={busy || !modal.title?.[langs.default]?.trim()} onClick={translateAll}>{tx("Vertaal naar alle talen")}</button>
                {trProg && (
                  <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={trProg.total} aria-valuenow={trProg.done}>
                    <div className="progress-top"><span>{tx("Vertalen…")}</span><strong>{trProg.done} / {trProg.total}</strong></div>
                    <div className="progress-track"><i style={{ width: `${Math.round((trProg.done / Math.max(1, trProg.total)) * 100)}%` }} /></div>
                  </div>
                )}
              </>
            )}
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
