"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, apiBase, errorText } from "../lib/api";
import { getLanguage, tx } from "../lib/t";
import PluginFrame from "./PluginFrame";
import { BgControls, BgLayer } from "./SectionBg";
import { useSession } from "./Session";
import { api as apiCall } from "../lib/api";

// The games page: the active games of the games plugin in a grid, in the look of the theme (header, blocks and colours of the site).
// A visitor sees the games that are public; a member sees all active games and plays them here.
export default function GamesPage() {
  const { user, ready, editing } = useSession();
  const [hero, setHero] = useState({}); // the background of the hero (edit mode: picture or video)
  useEffect(() => { apiCall("/pages/layout/hero-games/").then((d) => setHero(d.bg || {})).catch(() => {}); }, []);
  async function saveHero(bg) {
    try { const d = await apiCall("/pages/layout/hero-games/", { method: "PUT", body: { rows: [], bg } }); setHero(d.bg || {}); } catch (e) { setError(errorText(e)); }
  }
  const [games, setGames] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [open, setOpen] = useState(null); // the game that is being played
  const lang = getLanguage();

  useEffect(() => {
    if (!ready) return;
    setGames(null); setError("");
    api(`/plugins/run/games/${user ? "list" : "public/list"}?lang=${encodeURIComponent(lang)}`).then((d) => setGames(d.games || [])).catch((e) => { setGames([]); setError(errorText(e)); });
  }, [ready, user, lang]);

  const cats = useMemo(() => [...new Set((games || []).flatMap((g) => g.categories || []))], [games]);
  const list = (games || []).filter((g) => (!cat || (g.categories || []).includes(cat)) && (!q || `${g.title} ${g.description}`.toLowerCase().includes(q.toLowerCase())));
  const plays = (games || []).reduce((a, g) => a + (g.plays || 0), 0);

  if (open) {
    return (
      <>
        <p><button type="button" className="btn sm" onClick={() => setOpen(null)}>← {tx("Alle spelletjes")}</button></p>
        <PluginFrame name="games" title={open.title} route={{ path: "/", params: {}, query: { item: open.slug } }} bare />
      </>
    );
  }
  return (
    <>
      <div className={`games-hero${hero.url ? " has-bg" : ""}`}>
        <BgLayer bg={hero} />
        {editing && <div style={{ marginBottom: ".6rem" }}><BgControls bg={hero} onChange={saveHero} /></div>}
        <h1>{tx("Spelletjes")}</h1>
        <p>{tx("Kies een spel en speel direct. Verbeter je score en kijk hoe je het doet tegen anderen.")}</p>
      </div>
      {error && <div className="alert">{error}</div>}
      {games && !user && games.length > 0 && <div className="card" style={{ marginBottom: "1rem", display: "flex", gap: ".8rem", alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}><span>{tx("Log in om te spelen.")}</span><Link href="/login" className="btn primary">{tx("Inloggen")}</Link></div>}
      <div className="games-bar">
        <div className="games-chips">
          {cats.length > 0 && ["", ...cats].map((c) => <button key={c || "all"} type="button" className={`btn ${cat === c ? "on" : ""}`} onClick={() => setCat(c)}>{c || tx("Alle")}</button>)}
        </div>
        <input placeholder={tx("Zoek een spel…")} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {games === null ? <p className="muted">{tx("Laden…")}</p> : (
        <div className="games-grid">
          {list.map((g) => (
            <button key={g.slug} type="button" className="card games-card" onClick={() => (user ? setOpen(g) : (window.location.href = "/login"))}>
              <span className="games-thumb">
                {g.thumb ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={`${apiBase()}/api/plugins/run/games/${g.thumb}`} alt="" /> : "🎮"}
                <span className="games-play">▶ {tx("Spelen")}</span>
              </span>
              <span className="games-body">
                {g.categories?.[0] && <span className="games-cat">{g.categories[0]}</span>}
                <strong>{g.title}{g.min_age ? <span className="games-age">{g.min_age}+</span> : null}</strong>
                <small>{g.description}</small>
                <span className="games-meta"><span>{user ? `${tx("Beste")}: ${g.best ?? "—"}` : ""}</span><span>{tx("{0} keer gespeeld", g.plays || 0)}</span></span>
              </span>
            </button>
          ))}
          {!list.length && <p className="muted">{games.length ? tx("Geen spel gevonden.") : tx("Er zijn nog geen spelletjes.")}</p>}
        </div>
      )}
      {games && plays > 0 && <small className="muted">{tx("{0} spellen", games.length)} · {tx("{0} keer gespeeld", plays)}</small>}
    </>
  );
}
