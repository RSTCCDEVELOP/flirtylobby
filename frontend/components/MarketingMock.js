"use client";

import Flag from "./Flag";

// A picture of the module with made-up data, different for every kind of module (gallery, chat, plans, table …). The data comes from the example of the marketing text.
export const KIND = {
  media: "gallery", branding: "gallery", siteimport: "folders", storage: "folders",
  chat: "chat", messages: "chat", directconnect: "chat",
  subscriptions: "plans", donations: "goal", orders: "table", payments: "table",
  profiles: "members", discover: "members", users: "members",
  pages: "tree", modules: "tree", roles: "tree", plugins: "tree", sysobjects: "blocks", dashboard: "blocks",
  edit_mode: "editor", theme: "editor",
  age_gate: "popup", gambling: "popup", cookies: "popup", geo: "popup", word_filter: "popup",
  twofa: "code", registration: "code", security_basic: "code",
  seo: "search", backups: "timeline", notifications: "timeline", help: "timeline", faq: "faq",
  languages: "languages", integrations: "connect", communication: "connect", sandbox: "connect", system: "connect", privacy_pages: "connect",
};
export const EMOJI = {
  pages: "📄", edit_mode: "✏️", media: "🖼️", siteimport: "📥", sysobjects: "🧩", branding: "🎨", theme: "🌈", languages: "🌍", seo: "🔎", help: "💡", faq: "❓", privacy_pages: "🔏",
  subscriptions: "🔁", donations: "💝", orders: "📦", payments: "💳", profiles: "🙂", discover: "💘", messages: "✉️", chat: "💬", directconnect: "🔗",
  geo: "🗺️", age_gate: "🔞", gambling: "🎲", cookies: "🍪", word_filter: "🧹", registration: "📝", twofa: "🔐", integrations: "🔌", communication: "📧", plugins: "🧱", notifications: "🔔", sandbox: "🧪", system: "⚙️", storage: "🗂️", backups: "💾", roles: "🛡️", users: "👥", dashboard: "🏠", security_basic: "🔒", modules: "🎛️",
};
export const HUE = { Content: ["#2563eb", "#7c3aed"], Subscription: ["#059669", "#0ea5a4"], Community: ["#db2777", "#7c3aed"], Beveiliging: ["#dc2626", "#ea580c"], Systeem: ["#475569", "#2563eb"], Kern: ["#0f766e", "#2563eb"] };

const tint = (i) => ["#3b82f6", "#ec4899", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4"][i % 6];
const pct = (s) => { const m = /(\d+)\s*%/.exec(s || ""); return m ? Math.min(100, Number(m[1])) : 60; };

export default function MarketingMock({ module, demo }) {
  const kind = KIND[module] || "list";
  const rows = demo.rows || [], stats = demo.stats || [];
  const initial = (s) => (s || "?").trim().slice(0, 1).toUpperCase();
  const Badge = ({ t, i = 0 }) => (t ? <span className="mk-badge" style={{ color: tint(i + 2), background: `color-mix(in srgb, ${tint(i + 2)} 16%, var(--card))` }}>{t}</span> : null);

  if (kind === "gallery") return (
    <div className="mm-gallery">{[...rows, ...rows].slice(0, 6).map((r, i) => <figure key={i} style={{ background: `linear-gradient(135deg, ${tint(i)}, ${tint(i + 3)})` }}><span>{r.badge}</span><figcaption><strong>{r.a}</strong><small>{r.b}</small></figcaption></figure>)}</div>
  );
  if (kind === "chat") return (
    <div className="mm-chat">{rows.map((r, i) => (
      <div key={i} className={`mm-bubble${i % 2 ? " me" : ""}`}>{i % 2 === 0 && <span className="mm-av" style={{ background: tint(i) }}>{initial(r.a)}</span>}<div><small>{r.a}</small><p>{r.b}</p></div>{r.badge && <em>{r.badge}</em>}</div>
    ))}<div className="mm-typing"><span /><span /><span /></div></div>
  );
  if (kind === "plans") return (
    <div className="mm-plans">{rows.map((r, i) => <div key={i} className={`mm-plan${i === 1 ? " pop" : ""}`}><strong>{r.a}</strong><b>{r.b}</b>{r.badge && <Badge t={r.badge} i={i} />}<ul><li>✓</li><li>✓</li><li>{i ? "✓" : "–"}</li></ul><button type="button" tabIndex={-1}>→</button></div>)}</div>
  );
  if (kind === "goal") return (
    <div className="mm-goal"><div className="mm-goalbar"><i style={{ width: `${pct(rows[0]?.badge)}%` }} /></div><div className="mm-goaltop"><strong>{rows[0]?.a}</strong><span>{rows[0]?.b}</span></div>
      <div className="mm-slider"><span /><i /></div>{rows.slice(1).map((r, i) => <div key={i} className="mm-donor"><span className="mm-av" style={{ background: tint(i + 1) }}>{initial(r.a)}</span><div><strong>{r.a}</strong><small>{r.b}</small></div><Badge t={r.badge} i={i} /></div>)}</div>
  );
  if (kind === "table") return (
    <table className="mm-table"><tbody>{rows.map((r, i) => <tr key={i}><td><strong>{r.a}</strong></td><td>{r.b}</td><td><Badge t={r.badge} i={i} /></td></tr>)}</tbody></table>
  );
  if (kind === "members") return (
    <div className="mm-members">{rows.map((r, i) => <div key={i} className="mm-member"><span className="mm-photo" style={{ background: `linear-gradient(160deg, ${tint(i)}, ${tint(i + 2)})` }}>{initial(r.a)}</span><strong>{r.a}</strong><small>{r.b}</small><Badge t={r.badge} i={i} /></div>)}</div>
  );
  if (kind === "tree") return (
    <ul className="mm-tree">{rows.map((r, i) => <li key={i}><span className="mm-sw on" /><div><strong>{r.a}</strong><small>{r.b}</small></div><Badge t={r.badge} i={i} /></li>)}<li className="off"><span className="mm-sw" /><div><strong>…</strong><small>+</small></div></li></ul>
  );
  if (kind === "blocks") return (
    <div className="mm-blocks">{rows.map((r, i) => <div key={i} className="mm-block" style={{ borderTopColor: tint(i) }}><span style={{ background: tint(i) }}>{initial(r.a)}</span><strong>{r.a}</strong><small>{r.b}</small><Badge t={r.badge} i={i} /></div>)}</div>
  );
  if (kind === "editor") return (
    <div className="mm-editor"><div className="mm-toolbar"><b>B</b><i>I</i><u>U</u><span /><em>↶</em></div>
      <div className="mm-page"><h4>{rows[0]?.a}</h4><p className="mm-line" /><p className="mm-line s" /><div className="mm-swatches">{[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ background: tint(i) }} />)}</div></div>
      <div className="mm-chips">{rows.map((r, i) => <span key={i}>{r.a}<Badge t={r.badge} i={i} /></span>)}</div></div>
  );
  if (kind === "popup") return (
    <div className="mm-popup"><div className="mm-pop"><strong>{rows[0]?.a}</strong><small>{rows[0]?.b}</small><div><button type="button" tabIndex={-1} className="p">{rows[1]?.a}</button><button type="button" tabIndex={-1}>{rows[2]?.a}</button></div></div><div className="mm-pophint">{rows.slice(1).map((r, i) => <small key={i}>{r.b}</small>)}</div></div>
  );
  if (kind === "code") return (
    <div className="mm-code">{rows.map((r, i) => <div key={i} className="mm-step"><span className="mm-n" style={{ background: tint(i) }}>{i + 1}</span><div><strong>{r.a}</strong><small>{r.b}</small></div><Badge t={r.badge} i={i} /></div>)}<div className="mm-boxes">{["4", "8", "2", "9", "1", "3"].map((c, i) => <span key={i}>{c}</span>)}</div></div>
  );
  if (kind === "search") return (
    <div className="mm-search"><div className="mm-q"><span>🔎</span>{rows[0]?.a?.split("–")[0]}</div><div className="mm-result"><small>{rows[0]?.b}</small><strong>{rows[0]?.a}</strong><p>{rows[1]?.a}</p></div><div className="mm-result"><small>{rows[2]?.b}</small><strong>{rows[2]?.a}</strong></div></div>
  );
  if (kind === "timeline") return (
    <ul className="mm-time">{rows.map((r, i) => <li key={i}><i style={{ background: tint(i) }} /><div><strong>{r.a}</strong><small>{r.b}</small></div><Badge t={r.badge} i={i} /></li>)}</ul>
  );
  if (kind === "faq") return (
    <div className="mm-faq">{rows.map((r, i) => <details key={i} open={i === 0}><summary>{r.a}</summary><p>{r.b}</p></details>)}</div>
  );
  if (kind === "languages") return (
    <div className="mm-langs"><div className="mm-flags">{["nl", "en", "de", "fr", "es", "it"].map((c) => <Flag key={c} code={c} width={30} title={c} />)}</div><ul className="mm-tree">{rows.map((r, i) => <li key={i}><span className={`mm-sw${i < 2 ? " on" : ""}`} /><div><strong>{r.a}</strong><small>{r.b}</small></div><Badge t={r.badge} i={i} /></li>)}</ul></div>
  );
  if (kind === "folders") return (
    <ul className="mm-folders">{rows.map((r, i) => <li key={i} style={{ paddingLeft: `${i * .8 + .8}rem` }}><span>📁</span><div><strong>{r.a}</strong><small>{r.b}</small></div><Badge t={r.badge} i={i} /></li>)}</ul>
  );
  if (kind === "connect") return (
    <ul className="mm-conn">{rows.map((r, i) => <li key={i}><span className="mm-logo" style={{ background: tint(i) }}>{initial(r.a)}</span><div><strong>{r.a}</strong><small>{r.b}</small></div><Badge t={r.badge} i={i} /></li>)}</ul>
  );
  return <ul className="mk-rows">{rows.map((r, i) => <li key={i}><div><strong>{r.a}</strong><small>{r.b}</small></div><Badge t={r.badge} i={i} /></li>)}</ul>;
}
