"use client";

import { tx } from "../lib/t";
import Link from "next/link";
import { alertDialog } from "../lib/dialog";
import { api, mediaUrl } from "../lib/api";
import {
  IconBolt, IconBriefcase, IconChat, IconFriends, IconGlobe, IconHeart, IconImage, IconLink, IconLock, IconMail, IconPin, IconStar, IconTrophy, IconTruck, IconUser,
} from "./Icons";
import { fieldText, FieldList } from "./ProfileFields";
import VerifyBadge from "./VerifyBadge";

// ── helpers ─────────────────────────────────────────────────────────────────
const byKey = (fields = []) => Object.fromEntries(fields.map((f) => [f.key, f]));
const without = (fields = [], keys) => fields.filter((f) => !keys.includes(f.key));
const chipList = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const DAYS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
const initial = (p) => (p.name || "?")[0].toUpperCase();
const Chips = ({ items }) => <span className="chips">{items.map((t) => <span key={t} className="chip" style={{ cursor: "default" }}>{t}</span>)}</span>;
const Linky = ({ f, icon }) => f && (
  <a className="btn sm" href={f.value} target="_blank" rel="noopener noreferrer nofollow">{icon} {f.label}</a>
);

// ── photos ──────────────────────────────────────────────────────────────────
export function Gallery({ p, i, setI, ratio = "4 / 3", rounded = true }) {
  const n = Math.min(i, Math.max(p.photos.length - 1, 0));
  const cur = p.photos[n];
  if (!cur) return <div className="card" style={{ aspectRatio: ratio === "4 / 5" ? ratio : "16 / 9", display: "grid", placeItems: "center" }}><span className="muted">{p.locked ? <><IconLock /> {tx("Alleen voor geselecteerde leden")}</> : tx("Geen foto's")}</span></div>;
  return (
    <div className="gallery">
      <div className="photo-lock">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="main" src={mediaUrl(cur.url)} alt={p.name} style={{ aspectRatio: ratio, borderRadius: rounded ? undefined : 0 }} />
        {cur.blurred && <span className="lock-badge"><IconLock /> {tx("Wazig · vraag toegang")}</span>}
      </div>
      {p.photos.length > 1 && (
        <div className="thumbs">
          {p.photos.map((ph, k) => /* eslint-disable-next-line @next/next/no-img-element */ <img key={k} src={mediaUrl(ph.url)} alt="" onClick={() => setI(k)} style={{ cursor: "pointer", borderColor: k === n ? "var(--blue)" : undefined }} />)}
        </div>
      )}
    </div>
  );
}

function Avatar({ p, size = 96 }) {
  const ph = p.photos.find((x) => !x.blurred) || p.photos[0];
  return ph
    ? /* eslint-disable-next-line @next/next/no-img-element */ <img className="pf-avatar" src={mediaUrl(ph.url)} alt={p.name} style={{ width: size, height: size }} />
    : <span className="pf-avatar avatar" style={{ width: size, height: size, fontSize: size / 2.6 }}>{initial(p)}</span>;
}

// ── actions (friend requests, like, message, chat, block) ──────────────────
export function Actions({ c, round = false }) {
  const { p, user, ready, rel, chat, label, ask, answer, block, setP } = c;
  const like = async () => {
    try {
      const r = p.liked ? await api(`/discover/like/${p.id}/`, { method: "DELETE" }) : await api("/discover/like/", { method: "POST", body: { user: p.id } });
      setP({ ...p, liked: r.liked, match: r.match });
      if (r.match && !p.match) await alertDialog(tx("Het is een match!"));
    } catch (e) { await alertDialog(e.message); }
  };
  const favorite = async () => { await api(`/discover/favorite/${p.id}/`, { method: p.favorite ? "DELETE" : "POST" }); setP({ ...p, favorite: !p.favorite }); };
  return (
    <>
      {p.is_self && <p className="alert ok" style={{ background: "var(--bg)" }}>{tx("Dit is je eigen pagina")}{!p.enabled && tx(" (nog niet actief, alleen jij ziet hem)")}. <Link href="/dashboard/community/profile" style={{ color: "var(--blue)" }}>{tx("Bewerken")}</Link></p>}
      {user && !p.is_self && rel?.enabled && (
        <div className="request-bar">
          {rel.incoming_friend_id && <><button className="btn primary" onClick={() => answer("accept")}>{tx("Vriendschap accepteren")}</button><button className="btn" onClick={() => answer("decline")}>{tx("Weigeren")}</button></>}
          {!rel.incoming_friend_id && !rel.friends && <button className="btn" disabled={rel.friend === "pending" || rel.friend === "declined"} onClick={() => ask("friend")}><IconFriends /> {label(rel.friend, tx("Vriend worden"))}</button>}
          {rel.friends && <span className="badge ok"><IconFriends /> {tx("Vrienden")}</span>}
          {!rel.friends && p.has_private && p.photos.some((ph) => ph.blurred) && <button className="btn" disabled={rel.photos === "pending" || rel.photos === "declined"} onClick={() => ask("photos")}><IconImage /> {label(rel.photos, tx("Foto's bekijken aanvragen"))}</button>}
          {p.locked && !rel.friends && <button className="btn" disabled={rel.profile === "pending" || rel.profile === "declined"} onClick={() => ask("profile")}><IconUser /> {label(rel.profile, tx("Profiel bekijken aanvragen"))}</button>}
        </div>
      )}
      {user && !p.is_self && !p.locked && (
        <div className={`pf-actions ${round ? "round" : ""}`}>
          {p.can_like && <button className={`btn ${p.liked ? "primary" : ""} ${round ? "pf-round" : ""}`} onClick={like} title={tx("Leuk vinden")}><IconHeart fill={p.liked ? "currentColor" : "none"} />{!round && <> {p.liked ? tx("Leuk") : tx("Leuk vinden")}</>}</button>}
          {p.can_like && <button className={`btn ${round ? "pf-round" : ""}`} onClick={favorite} title={tx("Favoriet")}><IconStar fill={p.favorite ? "currentColor" : "none"} />{!round && <> {tx("Favoriet")}</>}</button>}
          {p.can_message && <Link className={`btn primary ${round ? "pf-round" : ""}`} href="/dashboard/community/messages" title={tx("Bericht sturen")}><IconMail />{!round && <> {tx("Bericht sturen")}</>}</Link>}
          {p.can_chat && chat?.cfg && <button className={`btn ${round ? "pf-round" : ""}`} title={tx("Chatten")} onClick={() => { chat.openPartner({ id: p.id, name: p.name }); chat.setWidgetOpen(true); }}><IconChat />{!round && <> {tx("Chatten")}</>}</button>}
          <button className="btn danger" onClick={block}>{tx("Blokkeren")}</button>
        </div>
      )}
      {!user && ready && <p className="muted" style={{ marginTop: "1rem" }}><Link href="/login" style={{ color: "var(--blue)" }}>{tx("Log in")}</Link> {tx("om dit lid een bericht te sturen.")}</p>}
    </>
  );
}

const Locked = ({ p }) => p.locked && <p className="alert" style={{ background: "var(--bg)" }}>{tx("Dit profiel is alleen zichtbaar voor geselecteerde leden en vrienden. Vraag toegang om het te bekijken.")}</p>;
const Name = ({ p, size }) => <h1 className="pf-name">{p.name}{p.age ? `, ${p.age}` : ""} <VerifyBadge status={p.verification} size={size || 26} label /></h1>;

// ── normal ──────────────────────────────────────────────────────────────────
function Normal({ c }) {
  const { p, i, setI } = c;
  return (
    <div className="profile-hero">
      <Gallery p={p} i={i} setI={setI} />
      <div>
        <Name p={p} />
        {(p.city || p.interests?.length > 0) && <p className="muted">{[p.city].filter(Boolean).join(" · ")}</p>}
        {p.interests?.length > 0 && <Chips items={p.interests} />}
        <Locked p={p} />
        <FieldList fields={p.fields} />
        {p.headline && <p style={{ fontSize: "1.1rem" }}>{p.headline}</p>}
        {p.bio && <p style={{ whiteSpace: "pre-wrap" }}>{p.bio}</p>}
        <Actions c={c} />
      </div>
    </div>
  );
}

// ── dating: big portrait photo with the name on it, round action buttons, soft attribute pills ──
function Dating({ c }) {
  const { p, i, setI } = c;
  const rest = p.fields || [];
  const groups = [...new Set(rest.map((f) => f.group || ""))];
  return (
    <div className="pf-dating">
      <div className="pf-photo-card">
        <Gallery p={p} i={i} setI={setI} ratio="4 / 5" />
        <div className="pf-photo-info">
          <Name p={p} size={22} />
          <span className="pf-meta">
            {p.city && <span><IconPin /> {p.city}</span>}
            {p.online !== undefined && null}
          </span>
        </div>
        <Actions c={c} round />
      </div>
      <div className="pf-body">
        <Locked p={p} />
        {p.headline && <blockquote className="pf-quote">{p.headline}</blockquote>}
        {p.bio && <section className="card"><h2>{tx("Over mij")}</h2><p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{p.bio}</p></section>}
        {p.interests?.length > 0 && <section className="card"><h2>{tx("Interesses")}</h2><Chips items={p.interests} /></section>}
        {groups.map((g) => (
          <section key={g} className="card">
            {g && <h2>{g}</h2>}
            <div className="pf-pills">
              {rest.filter((f) => (f.group || "") === g).map((f) => (
                <span key={f.key} className="pf-pill"><small>{f.label}</small><strong>{fieldText(f)}</strong></span>
              ))}
            </div>
          </section>
        ))}
        {p.is_self && <Actions c={{ ...c, user: null, ready: false, rel: null }} />}
      </div>
    </div>
  );
}

// ── sporters: banner, stat tiles, sport chips, week strip ────────────────────
function Sporters({ c }) {
  const { p, i, setI } = c;
  const F = byKey(p.fields);
  const used = ["sports", "level", "hours", "goals", "days", "time", "buddy", "club", "pb"];
  const days = chipList(F.days?.value);
  return (
    <div className="pf-sport">
      <div className="pf-banner pf-banner-sport">
        <Avatar p={p} size={104} />
        <div>
          <Name p={p} />
          <span className="pf-meta">
            {p.city && <span><IconPin /> {p.city}</span>}
            {F.club && <span><IconBolt /> {F.club.value}</span>}
          </span>
        </div>
        {F.buddy?.value && <span className="badge ok pf-buddy"><IconFriends /> {F.buddy.label}</span>}
      </div>
      <Locked p={p} />
      <div className="pf-stats">
        {F.level && <div className="pf-stat"><IconTrophy /><small>{F.level.label}</small><strong>{F.level.value}</strong></div>}
        {F.hours && <div className="pf-stat"><IconBolt /><small>{F.hours.label}</small><strong>{F.hours.value} {F.hours.unit}</strong></div>}
        {F.time && <div className="pf-stat"><IconStar /><small>{F.time.label}</small><strong>{F.time.value}</strong></div>}
        {F.pb && <div className="pf-stat"><IconTrophy /><small>{F.pb.label}</small><strong>{F.pb.value}</strong></div>}
      </div>
      <div className="pf-cols">
        <div className="pf-body">
          {F.sports && <section className="card"><h2>{F.sports.label}</h2><Chips items={chipList(F.sports.value)} /></section>}
          {F.goals && <section className="card"><h2>{F.goals.label}</h2><Chips items={chipList(F.goals.value)} /></section>}
          {F.days && (
            <section className="card"><h2>{F.days.label}</h2>
              <div className="pf-week">{DAYS.map((d) => <span key={d} className={days.includes(d) ? "on" : ""}>{d}</span>)}</div>
            </section>
          )}
          {(p.headline || p.bio) && <section className="card"><h2>{tx("Over mij")}</h2>{p.headline && <p style={{ fontSize: "1.05rem", fontWeight: 600 }}>{p.headline}</p>}{p.bio && <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{p.bio}</p>}</section>}
          <FieldList fields={without(p.fields, used)} />
        </div>
        <aside className="pf-side">
          <Gallery p={p} i={i} setI={setI} ratio="1 / 1" />
          <Actions c={c} />
        </aside>
      </div>
    </div>
  );
}

// ── business: cover, avatar, "title at company", looking/offer panels ────────
function Business({ c }) {
  const { p, i, setI } = c;
  const F = byKey(p.fields);
  const used = ["company", "title", "industry", "size", "expertise", "looking", "offer", "website", "linkedin", "available"];
  const line = [F.title?.value, F.company?.value].filter(Boolean).join(` ${tx("bij")} `);
  return (
    <div className="pf-biz">
      <div className="pf-cover" />
      <div className="pf-biz-head">
        <Avatar p={p} size={112} />
        <div className="pf-biz-id">
          <Name p={p} />
          {line && <p className="pf-line"><IconBriefcase /> {line}</p>}
          <span className="pf-meta">
            {p.city && <span><IconPin /> {p.city}</span>}
            {F.industry && <span>{F.industry.value}</span>}
            {F.size && <span>{F.size.value}</span>}
          </span>
        </div>
        <div className="pf-biz-links">
          {F.available?.value && <span className="badge ok">{F.available.label}</span>}
          <Linky f={F.website} icon={<IconGlobe />} />
          <Linky f={F.linkedin} icon={<IconLink />} />
        </div>
      </div>
      <Locked p={p} />
      <div className="pf-cols">
        <div className="pf-body">
          {(p.headline || p.bio) && <section className="card"><h2>{tx("Over")}</h2>{p.headline && <p style={{ fontSize: "1.05rem", fontWeight: 600 }}>{p.headline}</p>}{p.bio && <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{p.bio}</p>}</section>}
          <div className="pf-two">
            {F.looking && <section className="card"><h2>{F.looking.label}</h2><Chips items={chipList(F.looking.value)} /></section>}
            {F.offer && <section className="card"><h2>{F.offer.label}</h2><p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{F.offer.value}</p></section>}
          </div>
          {F.expertise && <section className="card"><h2>{F.expertise.label}</h2><Chips items={chipList(F.expertise.value)} /></section>}
          <FieldList fields={without(p.fields, used)} />
        </div>
        <aside className="pf-side">
          <Actions c={c} />
          {p.photos.length > 0 && <Gallery p={p} i={i} setI={setI} ratio="4 / 3" />}
        </aside>
      </div>
    </div>
  );
}

// ── webshop: shop header, info tiles (delivery, regions, payment), return policy ──
function Webshop({ c }) {
  const { p, i, setI } = c;
  const F = byKey(p.fields);
  const used = ["shop", "category", "website", "delivery", "region", "payment", "returns", "kvk"];
  return (
    <div className="pf-shop">
      <div className="pf-shop-head">
        <Avatar p={p} size={96} />
        <div className="pf-biz-id">
          <h1 className="pf-name">{F.shop?.value || p.name} <VerifyBadge status={p.verification} size={26} label /></h1>
          <span className="pf-meta">
            <span><IconUser /> {p.name}</span>
            {p.city && <span><IconPin /> {p.city}</span>}
            {F.category && <span className="badge ok">{F.category.value}</span>}
          </span>
        </div>
        <Linky f={F.website} icon={<IconGlobe />} />
      </div>
      <Locked p={p} />
      <div className="pf-tiles">
        {F.delivery && <div className="pf-tile"><IconTruck /><small>{F.delivery.label}</small><strong>{F.delivery.value}</strong></div>}
        {F.region && <div className="pf-tile"><IconGlobe /><small>{F.region.label}</small><strong>{chipList(F.region.value).join(", ")}</strong></div>}
        {F.payment && <div className="pf-tile"><IconBriefcase /><small>{F.payment.label}</small><strong>{chipList(F.payment.value).join(", ")}</strong></div>}
        {F.kvk && <div className="pf-tile"><IconUser /><small>{F.kvk.label}</small><strong>{F.kvk.value}</strong></div>}
      </div>
      <div className="pf-cols">
        <div className="pf-body">
          {(p.headline || p.bio) && <section className="card"><h2>{tx("Over de winkel")}</h2>{p.headline && <p style={{ fontSize: "1.05rem", fontWeight: 600 }}>{p.headline}</p>}{p.bio && <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{p.bio}</p>}</section>}
          {F.returns && <section className="card"><h2>{F.returns.label}</h2><p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{F.returns.value}</p></section>}
          <FieldList fields={without(p.fields, used)} />
        </div>
        <aside className="pf-side">
          <Gallery p={p} i={i} setI={setI} ratio="4 / 3" />
          <Actions c={c} />
        </aside>
      </div>
    </div>
  );
}

const LAYOUTS = { normal: Normal, dating: Dating, sporters: Sporters, business: Business, webshop: Webshop };

// The public profile page follows the community theme chosen in Admin -> Community -> Profielthema
export default function ProfileLayout({ c }) {
  const Layout = LAYOUTS[c.p.theme] || Normal;
  return <div className={`pf pf-theme-${LAYOUTS[c.p.theme] ? c.p.theme : "normal"}`}><Layout c={c} /></div>;
}
