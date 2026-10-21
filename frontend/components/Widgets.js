"use client";

import { Busy } from "./PageLoader";
import { tx } from "../lib/t";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorText } from "../lib/api";
import { confirmDialog } from "../lib/dialog";
import { money, ORDER_STATUS } from "../lib/format";
import { canAdmin, lvl } from "../lib/perms";
import { IconBag, IconChat, IconGrid, IconGroup, IconKey, IconMail, IconSearch, IconShield, IconUser, IconUsers } from "./Icons";
import { BarChart, Donut } from "./Charts";
import RichEditor, { plainToHtml, toDisplay } from "./RichEditor";
import AgendaTile from "./AgendaTile";

/* Dashboard blocks. A block only exists while its module is on and the user has the access it needs (see `available`).
   To add one: write a component, add an entry to WIDGETS. */
const on = (mods, ...keys) => keys.every((k) => mods[k] !== false);
const useData = (path, deps = []) => {
  const [d, setD] = useState(undefined);
  useEffect(() => { api(path).then(setD).catch(() => setD(null)); }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return d;
};
const Loading = ({ d }) => (d === undefined ? <Busy /> : d === null ? <p className="muted">{tx("Niet beschikbaar.")}</p> : null);
const monthName = (ym) => new Date(`${ym}-01`).toLocaleDateString("nl-NL", { month: "short" });

function Welcome({ ctx }) {
  const name = ctx.user.first_name || ctx.user.email.split("@")[0];
  return <><h2 style={{ fontSize: "1.5rem", margin: 0 }}>{tx("Welkom,")} {name}</h2><p className="muted" style={{ margin: ".35rem 0 0" }}>{tx("Dit is jouw dashboard. Kies \"Dashboard aanpassen\" om blokken uit de bibliotheek toe te voegen en te verslepen.")}</p></>;
}

function Shortcuts({ ctx }) {
  const { user, mods, chat } = ctx;
  // [href, label, short text, icon, colour] — colours follow the house style (primary / secondary)
  const tiles = [
    ["/dashboard/profile", tx("Mijn account"), tx("Gegevens en foto's"), <IconUser key="i" />, "blue"],
    on(mods, "profiles") && ["/dashboard/community/profile", tx("Mijn profielpagina"), tx("Zo word je gevonden"), <IconUsers key="i" />, "orange"],
    on(mods, "discover") && ["/dashboard/community/discover", tx("Zoeken & matchen"), tx("Vind nieuwe mensen"), <IconSearch key="i" />, "blue"],
    on(mods, "messages") && ["/dashboard/community/messages", tx("Berichten"), tx("Je postvak"), <IconMail key="i" />, "orange"],
    on(mods, "chat") && ["/dashboard/community/chat", tx("Chat"), tx("Praat live"), <IconChat key="i" />, "blue"],
    on(mods, "directconnect") && ["/dashboard/community/direct", tx("Directe verbinding"), tx("Uitnodigen via link"), <IconKey key="i" />, "orange"],
    on(mods, "profiles") && ["/dashboard/community/requests", tx("Vrienden & verzoeken"), tx("Wie wil je kennen"), <IconGroup key="i" />, "blue"],
    mods["plugin:webshop"] === true && ["/producten", tx("Webshop"), tx("Bekijk de producten"), <IconBag key="i" />, "orange"],
    canAdmin(user, mods) && ["/dashboard/admin", tx("Admin"), tx("Beheer de site"), <IconShield key="i" />, "blue"],
    user.is_staff && ["/dashboard/superadmin", tx("Super admin"), tx("Modules en rechten"), <IconGrid key="i" />, "orange"],
  ].filter(Boolean);
  return (
    <div className="tile-grid">
      {tiles.map(([h, l, d, icon, c]) => (
        <Link key={h} href={h} className={`tile tile-${c}`}>
          <span className="tile-icon">{icon}</span>
          <strong>{l}</strong>
          <small>{d}</small>
        </Link>
      ))}
    </div>
  );
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
      {html ? <div className="rich-text" dangerouslySetInnerHTML={{ __html: toDisplay(html) }} /> : <p className="muted">{tx("Hier kan een mededeling voor alle gebruikers staan.")}</p>}
      {canEdit && <button className="btn sm" style={{ marginTop: ".5rem" }} onClick={() => setEdit(true)}>{tx("Mededeling bewerken")}</button>}
      {edit && <RichEditor title={tx("Mededeling")} initialHtml={html} onSave={(h) => save({ html: true, text: h })} onPlain={(t) => save({ text: t })} onClose={() => setEdit(false)} />}
    </>
  );
}

function ProfileBlock() {
  const s = useData("/community/summary/");
  if (!s) return <Loading d={s} />;
  const vis = { public: tx("iedereen"), members: tx("alle leden"), selected: tx("geselecteerde leden") }[s.profile.visibility];
  return <><p style={{ margin: 0 }}><strong>{s.profile.enabled ? tx("Je pagina is actief") : tx("Je pagina is nog niet actief")}</strong></p><p className="muted" style={{ margin: ".25rem 0 .75rem" }}>{s.profile.photos} {tx("foto's")}{vis ? tx(" · zichtbaar voor {0}", vis) : ""}</p><Link className="btn sm" href="/dashboard/community/profile">{tx("Profiel bewerken")}</Link>{s.profile.enabled && <> <Link className="btn sm" href={`/leden/${s.profile.slug}`}>{tx("Bekijk")}</Link></>}</>;
}

function MessagesBlock() {
  const d = useData("/messages/conversations/");
  if (!d) return <Loading d={d} />;
  const unread = d.reduce((n, c) => n + c.unread, 0);
  return (
    <>
      <p style={{ margin: 0 }}><strong>{unread}</strong> {tx("ongelezen")}</p>
      <ul className="widget-list">{d.slice(0, 4).map((c) => <li key={c.user.id}><span>{c.user.name}{c.unread > 0 && <span className="cart-count">{c.unread}</span>}</span><small className="muted">{c.last.subject || c.last.body}</small></li>)}</ul>
      {!d.length && <p className="muted">{tx("Nog geen berichten.")}</p>}
      <Link className="btn sm" href="/dashboard/community/messages">{tx("Naar berichten")}</Link>
    </>
  );
}

function ChatBlock() {
  const d = useData("/community/summary/");
  if (!d) return <Loading d={d} />;
  return <><p style={{ margin: 0 }}><strong>{d.unread_chat}</strong> {tx("ongelezen chatberichten")}</p><p className="muted">{tx("De chat staat ook als popup rechtsonder.")}</p><Link className="btn sm" href="/dashboard/community/chat">{tx("Open chat")}</Link></>;
}

function MatchesBlock() {
  const d = useData("/community/summary/");
  if (!d?.discover) return <Loading d={d === undefined ? d : null} />;
  return <><div className="cards" style={{ margin: 0 }}><div className="stat"><span>{tx("Matches")}</span><strong>{d.discover.matches}</strong></div><div className="stat"><span>{tx("Nieuwe likes")}</span><strong>{d.discover.likes_new}</strong></div><div className="stat"><span>{tx("Favorieten")}</span><strong>{d.discover.favorites}</strong></div></div><Link className="btn sm" style={{ marginTop: ".75rem" }} href="/dashboard/community/discover">{tx("Zoeken & matchen")}</Link></>;
}

// Start of the search for this profile type: the text and the button follow the theme (Dating / Business / Sporters / …)
const FIND = {
  dating: ["Ontmoeten", "Zoek op leeftijd en afstand, of swipe door nieuwe profielen.", "Zoeken & swipen"],
  business: ["Netwerk", "Zoek zakelijke contacten, functies en banen.", "Netwerk zoeken"],
  sporters: ["Trainingsmaatjes", "Vind sporters in de buurt die bij jouw niveau passen.", "Sporters zoeken"],
  webshop: ["Winkels", "Zoek verkopers en winkels op categorie en plaats.", "Winkels zoeken"],
  normal: ["Leden", "Zoek andere leden op naam, plaats of interesse.", "Leden zoeken"],
};
function FindBlock({ ctx }) {
  const [, text, button] = FIND[ctx.theme] || FIND.normal;
  return <><p style={{ margin: 0 }}>{tx(text)}</p><Link className="btn sm primary" style={{ marginTop: ".75rem" }} href="/dashboard/community/discover">{tx(button)}</Link></>;
}
function SwipeBlock() {
  const d = useData("/community/summary/");
  return <><p style={{ margin: 0 }}>{d?.discover?.likes_new > 0 ? tx("{0} nieuwe likes wachten op je. Swipe door nieuwe profielen.", d.discover.likes_new) : tx("Swipe door nieuwe profielen: like, sla over of stuur een kort bericht.")}</p><Link className="btn sm primary" style={{ marginTop: ".75rem" }} href="/dashboard/community/discover?tab=swipe">{tx("Start met swipen")}</Link></>;
}

function VisitsChart() {
  const d = useData("/dashboard/stats/?kind=visits_daily");
  if (!d) return <Loading d={d} />;
  return <><p style={{ margin: "0 0 .5rem" }}><strong>{d.total}</strong> {tx("bezoekers in 30 dagen")}</p><BarChart points={d.points} /></>;
}

function UsersStats() {
  const d = useData("/dashboard/stats/?kind=users_growth");
  if (!d) return <Loading d={d} />;
  return <div className="cards" style={{ margin: 0 }}><div className="stat"><span>{tx("Users")}</span><strong>{d.total}</strong></div><div className="stat"><span>{tx("Actief")}</span><strong>{d.active}</strong></div><div className="stat"><span>{tx("Geblokkeerd")}</span><strong>{d.blocked}</strong></div></div>;
}

function UsersChart() {
  const d = useData("/dashboard/stats/?kind=users_growth");
  if (!d) return <Loading d={d} />;
  return <BarChart points={d.points.map((p) => ({ ...p, label: monthName(p.label) }))} />;
}

function OrdersChart() {
  const d = useData("/dashboard/stats/?kind=orders_daily");
  if (!d) return <Loading d={d} />;
  return <><p style={{ margin: "0 0 .5rem" }}><strong>{money(d.revenue)}</strong> {tx("omzet ·")} {d.orders} {tx("orders (30 dagen)")}</p><BarChart points={d.points} format={(v) => money(v)} color="var(--orange)" /></>;
}

function OrdersRecent() {
  const d = useData("/dashboard/stats/?kind=orders_recent");
  if (!d) return <Loading d={d} />;
  return (
    <>
      <ul className="widget-list">{d.map((o) => <li key={o.number}><span><strong>{o.number}</strong> {o.name}</span><span>{money(o.total)} <span className={`badge ${ORDER_STATUS[o.status][1]}`}>{ORDER_STATUS[o.status][0]}</span></span></li>)}</ul>
      {!d.length && <p className="muted">{tx("Nog geen bestellingen.")}</p>}
      <Link className="btn sm" href="/dashboard/admin/plugins/orders">{tx("Alle orders")}</Link>
    </>
  );
}

function LowStock() {
  const d = useData("/dashboard/stats/?kind=low_stock");
  if (!d) return <Loading d={d} />;
  return <><ul className="widget-list">{d.map((p) => <li key={p.id}><span>{p.name}</span><span className={p.stock === 0 ? "stock-out" : "stock-low"}>{p.stock === 0 ? "uitverkocht" : `${p.stock} over`}</span></li>)}</ul>{!d.length && <p className="muted">{tx("Alle producten hebben voldoende voorraad.")}</p>}<Link className="btn sm" href="/dashboard/admin/plugins/webshop">{tx("Producten")}</Link></>;
}

function MediaUsage() {
  const d = useData("/dashboard/stats/?kind=media_usage");
  if (!d) return <Loading d={d} />;
  return <><Donut parts={d.parts} /><p className="muted" style={{ margin: ".5rem 0 0" }}>{tx("{0} MB in {1} bestanden", (d.bytes / 1048576).toFixed(1), d.total)}</p></>;
}

function ModulesBlock() {
  const d = useData("/modules/all/");
  if (!d) return <Loading d={d} />;
  const off = d.filter((m) => !m.enabled);
  return <><p style={{ margin: 0 }}><strong>{d.length - off.length}</strong> {tx("van {0} modules aan", d.length)}</p>{off.length > 0 && <p className="muted">{tx("Uit:")} {off.map((m) => m.label).join(", ")}</p>}<Link className="btn sm" href="/dashboard/superadmin/modules">{tx("Modules beheren")}</Link></>;
}

function SandboxBlock() {
  const d = useData("/sandbox/settings/");
  if (!d) return <Loading d={d} />;
  return <><p style={{ margin: 0 }}><span className={`badge ${d.settings.enabled ? "off" : "ok"}`}>{d.settings.enabled ? tx("Sandbox AAN") : tx("Sandbox uit")}</span></p><p className="muted">{d.settings.enabled ? tx("Externe diensten worden gesimuleerd.") : tx("Echte e-mail, sms en betalingen.")}</p><Link className="btn sm" href="/dashboard/admin/sandbox">{tx("Sandbox")}</Link></>;
}

// id, group, title, description, default size, availability (module on + access) and component
// Who is connected through a direct (WebRTC) invitation right now
function DirectBlock() {
  const [rooms, setRooms] = useState(null);
  useEffect(() => {
    let stop = false;
    const load = () => api("/direct/rooms/").then((r) => !stop && setRooms(r)).catch(() => !stop && setRooms([]));
    load();
    const t = setInterval(load, 4000);
    return () => { stop = true; clearInterval(t); };
  }, []);
  if (!rooms) return <Busy />;
  const connected = rooms.filter((r) => r.guest_online);
  return (
    <>
      {connected.length > 0 ? (
        <div className="direct-people">
          {connected.map((r) => (
            <div key={r.token} className="request-row">
              <span className="avatar" data-g={r.guest_gender || undefined}>{(r.guest_name || "?")[0].toUpperCase()}</span>
              <span className="grow"><strong className="gname" data-g={r.guest_gender || undefined}>{r.guest_name}</strong><span className="muted" style={{ fontSize: ".8rem" }}><span className="dot ok" style={{ display: "inline-block", width: 8, height: 8, marginRight: 6, boxShadow: "none" }} />{tx("Verbonden")}</span></span>
              <span className="request-actions">
                <Link className="btn sm primary" href={`/dashboard/community/direct?room=${r.token}`}>{tx("Openen")}</Link>
                <button type="button" className="btn sm danger" onClick={async () => { if (await confirmDialog(tx("De verbinding met {0} verbreken?", r.guest_name), { title: tx("Verbinding verbreken"), okLabel: tx("Verbreken"), danger: true })) { await api(`/direct/rooms/${r.token}/disconnect/`, { method: "POST" }).catch(() => {}); setRooms((l) => l.map((x) => (x.token === r.token ? { ...x, guest_online: false, guest_name: "" } : x))); } }}>{tx("Verbreek")}</button>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted" style={{ margin: 0 }}>{tx("Er is niemand verbonden.")} {rooms.length ? tx("{0} uitnodiging(en) staan open.", rooms.length) : ""}</p>
      )}
      <Link className="btn sm" href="/dashboard/community/direct" style={{ marginTop: ".75rem" }}>{rooms.length ? tx("Uitnodigingen") : tx("Iemand uitnodigen")}</Link>
    </>
  );
}

export const WIDGETS = [
  { id: "welcome", group: "Algemeen", title: "Welkom", desc: "Begroeting", size: 2, ok: () => true, C: Welcome },
  { id: "notice", group: "Algemeen", title: "Mededeling", desc: "Een bericht van de beheerders voor alle gebruikers", size: 2, ok: () => true, C: Notice },
  { id: "shortcuts", group: "Algemeen", title: "Snelkoppelingen", desc: "Snel naar je pagina's", size: 2, ok: () => true, C: Shortcuts },
  { id: "agenda", group: "Algemeen", title: "Agenda", desc: "Je komende afspraken, op jouw manier: lijst, eerstvolgende, week, maand of compact", size: 1, ok: ({ mods }) => mods["plugin:agenda"] === true, C: AgendaTile },
  { id: "profile", group: "Community", title: "Mijn profielpagina", desc: "Status van je profiel", size: 1, ok: ({ mods }) => on(mods, "profiles"), C: ProfileBlock },
  { id: "messages", group: "Community", title: "Berichten", desc: "Ongelezen berichten en laatste gesprekken", size: 1, ok: ({ mods }) => on(mods, "messages"), C: MessagesBlock },
  { id: "chat", group: "Community", title: "Chat", desc: "Ongelezen chatberichten", size: 1, ok: ({ mods }) => on(mods, "chat"), C: ChatBlock },
  { id: "direct", group: "Community", title: "Directe verbinding", desc: "Wie nu rechtstreeks met je verbonden is", size: 1, ok: ({ mods }) => on(mods, "directconnect"), C: DirectBlock },
  { id: "matches", group: "Community", title: "Matches & likes", desc: "Je matches, nieuwe likes en favorieten", size: 1, ok: ({ mods }) => on(mods, "profiles", "discover"), C: MatchesBlock },
  { id: "find", group: "Community", title: "Zoeken", desc: "Snel naar de zoekpagina van jouw profieltype", size: 1, ok: ({ mods }) => on(mods, "profiles", "discover"), C: FindBlock },
  { id: "swipe", group: "Community", title: "Swipen", desc: "Like, sla over of stuur een kort bericht", size: 1, ok: ({ mods, swipe }) => on(mods, "profiles", "discover") && !!swipe, C: SwipeBlock },
  { id: "visits_chart", group: "Community", title: "Profielbezoeken", desc: "Grafiek van de afgelopen 30 dagen", size: 2, ok: ({ mods }) => on(mods, "profiles", "discover"), C: VisitsChart },
  { id: "users_stats", group: "Beheer", title: "Users", desc: "Aantal users, actief en geblokkeerd", size: 2, ok: ({ user }) => lvl(user, "users") >= 1, C: UsersStats },
  { id: "users_chart", group: "Beheer", title: "Nieuwe users per maand", desc: "Grafiek van de laatste 12 maanden", size: 2, ok: ({ user }) => lvl(user, "users") >= 1, C: UsersChart },
  { id: "orders_chart", group: "Beheer", title: "Omzet per dag", desc: "Grafiek van de laatste 30 dagen", size: 2, ok: ({ user, mods }) => on(mods, "orders") && lvl(user, "orders") >= 1, C: OrdersChart },
  { id: "orders_recent", group: "Beheer", title: "Laatste bestellingen", desc: "De nieuwste orders", size: 1, ok: ({ user, mods }) => on(mods, "orders") && lvl(user, "orders") >= 1, C: OrdersRecent },
  { id: "low_stock", group: "Beheer", title: "Lage voorraad", desc: "Producten die bijna op zijn", size: 1, ok: ({ user, mods }) => mods["plugin:webshop"] === true && lvl(user, "orders") >= 1, C: LowStock },
  { id: "media_usage", group: "Beheer", title: "Mediagebruik", desc: "Aantal en grootte van je bestanden", size: 1, ok: ({ user, mods }) => on(mods, "media") && lvl(user, "media") >= 1, C: MediaUsage },
  { id: "sandbox", group: "Beheer", title: "Sandbox", desc: "Staat de testomgeving aan?", size: 1, ok: ({ user, mods }) => on(mods, "sandbox") && lvl(user, "sandbox") >= 1, C: SandboxBlock },
  { id: "modules", group: "Beheer", title: "Modules", desc: "Welke modules aan staan", size: 1, ok: ({ user }) => user.is_staff, C: ModulesBlock },
];
export const byId = Object.fromEntries(WIDGETS.map((w) => [w.id, w]));

// The dashboard follows the community theme chosen in the setup (Admin -> Community -> Profielthema):
// per theme three ready-made layouts (calm / standard / full) and the blocks that fit it best.
export const DASH_THEMES = { normal: "Normaal", dating: "Dating", sporters: "Sporters", business: "Business", webshop: "Webshop" };
export const DASH_LAYOUTS = [["calm", "Rustig"], ["standard", "Standaard"], ["full", "Uitgebreid"]];
const THEME_DASH = {
  normal: { calm: ["welcome", "agenda", "find", "messages"], standard: ["welcome", "agenda", "shortcuts", "messages", "chat", "profile"], full: ["welcome", "agenda", "notice", "shortcuts", "messages", "chat", "direct", "profile", "matches", "visits_chart"], suggested: ["agenda", "find", "shortcuts", "chat", "direct", "notice"] },
  dating: { calm: ["welcome", "agenda", "swipe", "matches"], standard: ["welcome", "agenda", "swipe", "matches", "messages", "visits_chart", "profile", "chat"], full: ["welcome", "agenda", "notice", "shortcuts", "matches", "messages", "visits_chart", "profile", "chat", "direct"], suggested: ["agenda", "find", "visits_chart", "direct", "chat", "shortcuts"] },
  sporters: { calm: ["welcome", "agenda", "find", "profile"], standard: ["welcome", "agenda", "shortcuts", "profile", "messages", "chat", "direct"], full: ["welcome", "agenda", "notice", "shortcuts", "profile", "messages", "chat", "direct", "matches", "visits_chart"], suggested: ["agenda", "find", "notice", "direct", "chat", "matches"] },
  business: { calm: ["welcome", "agenda", "find", "messages"], standard: ["welcome", "agenda", "notice", "shortcuts", "messages", "profile", "visits_chart"], full: ["welcome", "agenda", "notice", "shortcuts", "messages", "profile", "visits_chart", "chat", "direct", "users_stats"], suggested: ["agenda", "find", "notice", "visits_chart", "direct", "users_stats"] },
  webshop: { calm: ["welcome", "agenda", "orders_recent", "low_stock"], standard: ["welcome", "agenda", "orders_chart", "orders_recent", "low_stock", "messages", "shortcuts"], full: ["welcome", "agenda", "notice", "orders_chart", "orders_recent", "low_stock", "media_usage", "messages", "shortcuts", "profile"], suggested: ["agenda", "orders_chart", "orders_recent", "low_stock", "media_usage"] },
};
const dash = (theme) => THEME_DASH[theme] || THEME_DASH.normal;
export const suggestedFor = (theme) => dash(theme).suggested;

// A ready-made layout for a theme, only with blocks this user may see
export const themeLayout = (ctx, theme, kind = "calm") => dash(theme)[kind].map((id) => byId[id]).filter((w) => w && w.ok(ctx)).map((w) => ({ id: w.id, size: w.size }));
// What a user gets when nobody customised anything: the calm layout of the chosen theme
export const defaultLayout = (ctx, theme = "normal") => themeLayout(ctx, theme, "calm");
