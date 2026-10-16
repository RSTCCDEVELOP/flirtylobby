"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorText } from "../lib/api";
import { money, ORDER_STATUS } from "../lib/format";
import { canAdmin, lvl } from "../lib/perms";
import { BarChart, Donut } from "./Charts";
import RichEditor, { plainToHtml, toDisplay } from "./RichEditor";

/* Dashboard blocks. A block only exists while its module is on and the user has the access it needs (see `available`).
   To add one: write a component, add an entry to WIDGETS. */
const on = (mods, ...keys) => keys.every((k) => mods[k] !== false);
const useData = (path, deps = []) => {
  const [d, setD] = useState(undefined);
  useEffect(() => { api(path).then(setD).catch(() => setD(null)); }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return d;
};
const Loading = ({ d }) => (d === undefined ? <p className="muted">Laden…</p> : d === null ? <p className="muted">Niet beschikbaar.</p> : null);
const monthName = (ym) => new Date(`${ym}-01`).toLocaleDateString("nl-NL", { month: "short" });

function Welcome({ ctx }) {
  const name = ctx.user.first_name || ctx.user.email.split("@")[0];
  return <><h2 style={{ fontSize: "1.5rem", margin: 0 }}>Welkom, {name} 👋</h2><p className="muted" style={{ margin: ".35rem 0 0" }}>Dit is jouw dashboard. Gebruik "Dashboard aanpassen" om blokken toe te voegen, te verplaatsen of te verwijderen.</p></>;
}

function Shortcuts({ ctx }) {
  const { user, mods } = ctx;
  const links = [
    ["/dashboard/profile", "Mijn account"],
    on(mods, "profiles") && ["/dashboard/community/profile", "Mijn profielpagina"],
    on(mods, "discover") && ["/dashboard/community/discover", "Zoeken & matchen"],
    on(mods, "messages") && ["/dashboard/community/messages", "Berichten"],
    on(mods, "chat") && ["/dashboard/community/chat", "Chat"],
    on(mods, "products") && ["/producten", "Webshop"],
    canAdmin(user, mods) && ["/dashboard/admin", "Admin"],
    user.is_staff && ["/dashboard/superadmin", "Super admin"],
  ].filter(Boolean);
  return <div className="row" style={{ justifyContent: "flex-start" }}>{links.map(([h, l]) => <Link key={h} href={h} className="btn sm">{l}</Link>)}</div>;
}

function Notice({ ctx }) {
  const KEY = "dashboard.notice";
  const [blocks, setBlocks] = useState(undefined);
  const [edit, setEdit] = useState(false);
  const canEdit = lvl(ctx.user, "edit_mode") >= 2 && on(ctx.mods, "edit_mode");
  const load = () => api("/content/").then((d) => setBlocks(d[KEY] || {})).catch(() => setBlocks({}));
  useEffect(() => { load(); }, []);
  const lang = (() => { try { return localStorage.getItem("lang") || "nl"; } catch { return "nl"; } })();
  const raw = blocks?.[lang] ?? blocks?.nl ?? Object.values(blocks || {})[0] ?? "";
  const html = raw.startsWith("html:") ? raw.slice(5) : raw ? plainToHtml(raw) : "";
  const save = (body) => api("/content/save/", { method: "PUT", body: { key: KEY, lang, ...body } }).then(load).catch((e) => { throw new Error(errorText(e)); });
  return (
    <>
      {html ? <div className="rich-text" dangerouslySetInnerHTML={{ __html: toDisplay(html) }} /> : <p className="muted">Hier kan een mededeling voor alle gebruikers staan.</p>}
      {canEdit && <button className="btn sm" style={{ marginTop: ".5rem" }} onClick={() => setEdit(true)}>Mededeling bewerken</button>}
      {edit && <RichEditor title="Mededeling" initialHtml={html} onSave={(h) => save({ html: true, text: h })} onPlain={(t) => save({ text: t })} onClose={() => setEdit(false)} />}
    </>
  );
}

function ProfileBlock() {
  const s = useData("/community/summary/");
  if (!s) return <Loading d={s} />;
  const vis = { public: "iedereen", members: "alle leden", selected: "geselecteerde leden" }[s.profile.visibility];
  return <><p style={{ margin: 0 }}><strong>{s.profile.enabled ? "Je pagina is actief" : "Je pagina is nog niet actief"}</strong></p><p className="muted" style={{ margin: ".25rem 0 .75rem" }}>{s.profile.photos} foto's{vis ? ` · zichtbaar voor ${vis}` : ""}</p><Link className="btn sm" href="/dashboard/community/profile">Profiel bewerken</Link>{s.profile.enabled && <> <Link className="btn sm" href={`/leden/${s.profile.slug}`}>Bekijk</Link></>}</>;
}

function MessagesBlock() {
  const d = useData("/messages/conversations/");
  if (!d) return <Loading d={d} />;
  const unread = d.reduce((n, c) => n + c.unread, 0);
  return (
    <>
      <p style={{ margin: 0 }}><strong>{unread}</strong> ongelezen</p>
      <ul className="widget-list">{d.slice(0, 4).map((c) => <li key={c.user.id}><span>{c.user.name}{c.unread > 0 && <span className="cart-count">{c.unread}</span>}</span><small className="muted">{c.last.subject || c.last.body}</small></li>)}</ul>
      {!d.length && <p className="muted">Nog geen berichten.</p>}
      <Link className="btn sm" href="/dashboard/community/messages">Naar berichten</Link>
    </>
  );
}

function ChatBlock() {
  const d = useData("/community/summary/");
  if (!d) return <Loading d={d} />;
  return <><p style={{ margin: 0 }}><strong>{d.unread_chat}</strong> ongelezen chatberichten</p><p className="muted">De chat staat ook als popup rechtsonder.</p><Link className="btn sm" href="/dashboard/community/chat">Open chat</Link></>;
}

function MatchesBlock() {
  const d = useData("/community/summary/");
  if (!d?.discover) return <Loading d={d === undefined ? d : null} />;
  return <><div className="cards" style={{ margin: 0 }}><div className="stat"><span>Matches</span><strong>{d.discover.matches}</strong></div><div className="stat"><span>Nieuwe likes</span><strong>{d.discover.likes_new}</strong></div><div className="stat"><span>Favorieten</span><strong>{d.discover.favorites}</strong></div></div><Link className="btn sm" style={{ marginTop: ".75rem" }} href="/dashboard/community/discover">Zoeken & matchen</Link></>;
}

function VisitsChart() {
  const d = useData("/dashboard/stats/?kind=visits_daily");
  if (!d) return <Loading d={d} />;
  return <><p style={{ margin: "0 0 .5rem" }}><strong>{d.total}</strong> bezoekers in 30 dagen</p><BarChart points={d.points} /></>;
}

function UsersStats() {
  const d = useData("/dashboard/stats/?kind=users_growth");
  if (!d) return <Loading d={d} />;
  return <div className="cards" style={{ margin: 0 }}><div className="stat"><span>Users</span><strong>{d.total}</strong></div><div className="stat"><span>Actief</span><strong>{d.active}</strong></div><div className="stat"><span>Geblokkeerd</span><strong>{d.blocked}</strong></div></div>;
}

function UsersChart() {
  const d = useData("/dashboard/stats/?kind=users_growth");
  if (!d) return <Loading d={d} />;
  return <BarChart points={d.points.map((p) => ({ ...p, label: monthName(p.label) }))} />;
}

function OrdersChart() {
  const d = useData("/dashboard/stats/?kind=orders_daily");
  if (!d) return <Loading d={d} />;
  return <><p style={{ margin: "0 0 .5rem" }}><strong>{money(d.revenue)}</strong> omzet · {d.orders} orders (30 dagen)</p><BarChart points={d.points} format={(v) => money(v)} color="var(--orange)" /></>;
}

function OrdersRecent() {
  const d = useData("/dashboard/stats/?kind=orders_recent");
  if (!d) return <Loading d={d} />;
  return (
    <>
      <ul className="widget-list">{d.map((o) => <li key={o.number}><span><strong>{o.number}</strong> {o.name}</span><span>{money(o.total)} <span className={`badge ${ORDER_STATUS[o.status][1]}`}>{ORDER_STATUS[o.status][0]}</span></span></li>)}</ul>
      {!d.length && <p className="muted">Nog geen bestellingen.</p>}
      <Link className="btn sm" href="/dashboard/admin/orders">Alle orders</Link>
    </>
  );
}

function LowStock() {
  const d = useData("/dashboard/stats/?kind=low_stock");
  if (!d) return <Loading d={d} />;
  return <><ul className="widget-list">{d.map((p) => <li key={p.id}><span>{p.name}</span><span className={p.stock === 0 ? "stock-out" : "stock-low"}>{p.stock === 0 ? "uitverkocht" : `${p.stock} over`}</span></li>)}</ul>{!d.length && <p className="muted">Alle producten hebben voldoende voorraad. 👍</p>}<Link className="btn sm" href="/dashboard/admin/products">Producten</Link></>;
}

function MediaUsage() {
  const d = useData("/dashboard/stats/?kind=media_usage");
  if (!d) return <Loading d={d} />;
  return <><Donut parts={d.parts} /><p className="muted" style={{ margin: ".5rem 0 0" }}>{(d.bytes / 1048576).toFixed(1)} MB in {d.total} bestanden</p></>;
}

function ModulesBlock() {
  const d = useData("/modules/all/");
  if (!d) return <Loading d={d} />;
  const off = d.filter((m) => !m.enabled);
  return <><p style={{ margin: 0 }}><strong>{d.length - off.length}</strong> van {d.length} modules aan</p>{off.length > 0 && <p className="muted">Uit: {off.map((m) => m.label).join(", ")}</p>}<Link className="btn sm" href="/dashboard/superadmin/modules">Modules beheren</Link></>;
}

function SandboxBlock() {
  const d = useData("/sandbox/settings/");
  if (!d) return <Loading d={d} />;
  return <><p style={{ margin: 0 }}><span className={`badge ${d.settings.enabled ? "off" : "ok"}`}>{d.settings.enabled ? "Sandbox AAN" : "Sandbox uit"}</span></p><p className="muted">{d.settings.enabled ? "Externe diensten worden gesimuleerd." : "Echte e-mail, sms en betalingen."}</p><Link className="btn sm" href="/dashboard/admin/sandbox">Sandbox</Link></>;
}

// id, group, title, description, default size, availability (module on + access) and component
export const WIDGETS = [
  { id: "welcome", group: "Algemeen", title: "Welkom", desc: "Begroeting", size: 2, ok: () => true, C: Welcome },
  { id: "notice", group: "Algemeen", title: "Mededeling", desc: "Een bericht van de beheerders voor alle gebruikers", size: 2, ok: () => true, C: Notice },
  { id: "shortcuts", group: "Algemeen", title: "Snelkoppelingen", desc: "Snel naar je pagina's", size: 2, ok: () => true, C: Shortcuts },
  { id: "profile", group: "Community", title: "Mijn profielpagina", desc: "Status van je profiel", size: 1, ok: ({ mods }) => on(mods, "profiles"), C: ProfileBlock },
  { id: "messages", group: "Community", title: "Berichten", desc: "Ongelezen berichten en laatste gesprekken", size: 1, ok: ({ mods }) => on(mods, "messages"), C: MessagesBlock },
  { id: "chat", group: "Community", title: "Chat", desc: "Ongelezen chatberichten", size: 1, ok: ({ mods }) => on(mods, "chat"), C: ChatBlock },
  { id: "matches", group: "Community", title: "Matches & likes", desc: "Je matches, nieuwe likes en favorieten", size: 1, ok: ({ mods }) => on(mods, "profiles", "discover"), C: MatchesBlock },
  { id: "visits_chart", group: "Community", title: "Profielbezoeken", desc: "Grafiek van de afgelopen 30 dagen", size: 2, ok: ({ mods }) => on(mods, "profiles", "discover"), C: VisitsChart },
  { id: "users_stats", group: "Beheer", title: "Users", desc: "Aantal users, actief en geblokkeerd", size: 2, ok: ({ user }) => lvl(user, "users") >= 1, C: UsersStats },
  { id: "users_chart", group: "Beheer", title: "Nieuwe users per maand", desc: "Grafiek van de laatste 12 maanden", size: 2, ok: ({ user }) => lvl(user, "users") >= 1, C: UsersChart },
  { id: "orders_chart", group: "Beheer", title: "Omzet per dag", desc: "Grafiek van de laatste 30 dagen", size: 2, ok: ({ user, mods }) => on(mods, "orders") && lvl(user, "orders") >= 1, C: OrdersChart },
  { id: "orders_recent", group: "Beheer", title: "Laatste bestellingen", desc: "De nieuwste orders", size: 1, ok: ({ user, mods }) => on(mods, "orders") && lvl(user, "orders") >= 1, C: OrdersRecent },
  { id: "low_stock", group: "Beheer", title: "Lage voorraad", desc: "Producten die bijna op zijn", size: 1, ok: ({ user, mods }) => on(mods, "products") && lvl(user, "products") >= 1, C: LowStock },
  { id: "media_usage", group: "Beheer", title: "Mediagebruik", desc: "Bestanden lokaal en op S3", size: 1, ok: ({ user, mods }) => on(mods, "media") && lvl(user, "media") >= 1, C: MediaUsage },
  { id: "sandbox", group: "Beheer", title: "Sandbox", desc: "Staat de testomgeving aan?", size: 1, ok: ({ user, mods }) => on(mods, "sandbox") && lvl(user, "sandbox") >= 1, C: SandboxBlock },
  { id: "modules", group: "Beheer", title: "Modules", desc: "Welke modules aan staan", size: 1, ok: ({ user }) => user.is_staff, C: ModulesBlock },
];
export const byId = Object.fromEntries(WIDGETS.map((w) => [w.id, w]));

// What a user gets when nobody customised anything: the basics plus every block that fits his modules and rights
const DEFAULT_ORDER = ["welcome", "notice", "shortcuts", "profile", "messages", "chat", "matches", "users_stats", "users_chart", "orders_chart", "orders_recent", "low_stock", "media_usage"];
export const defaultLayout = (ctx) => DEFAULT_ORDER.map((id) => byId[id]).filter((w) => w.ok(ctx)).map((w) => ({ id: w.id, size: w.size }));
