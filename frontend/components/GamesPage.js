"use client";

import { Busy } from "./PageLoader";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, apiBase, errorText } from "../lib/api";
import { getLanguage, tx } from "../lib/t";
import { IconGrid, IconMenu } from "./Icons";
import PageBlocks from "./PageBlocks";
import Paged from "./Paged";
import PluginFrame from "./PluginFrame";
import { useSession } from "./Session";

// The games page: the active games of the games plugin in a grid, in the look of the theme (header, blocks and colours of the site).
// A visitor sees the games that are public; a member sees all active games and plays them here.
// examples for the preview in the admin: so the page can be designed with a full list of games (never shown to visitors)
const SAMPLE = [
  ["Vier op een rij", "bord", "Laat vier schijven op een rij komen voordat je tegenstander dat doet.", 0, 142],
  ["Memory", "geheugen", "Vind alle paren zo snel mogelijk. Met meerdere niveaus.", 0, 87],
  ["Galgje", "woord", "Raad het woord voordat het poppetje klaar is.", 0, 64],
  ["Tetris-blokken", "arcade", "Draai en stapel de blokken. Elke volle rij geeft punten.", 0, 215],
  ["Quiz van de dag", "quiz", "Tien vragen, elke dag nieuw. Doe mee met de ranglijst.", 12, 53],
  ["Pokertafel", "kaart", "Speel aan een tafel met andere leden. Alleen voor volwassenen.", 18, 31],
].map(([title, cat, description, min_age, plays], i) => ({ slug: `voorbeeld-${i}`, title, description, categories: [cat], plays, best: null, min_age, thumb: "", sample: true }));

export default function GamesPage({ preview = false }) {
  const { user, ready } = useSession();
  const [games, setGames] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [mode, setMode] = useState(""); // the visitor's own choice: "grid" | "list"; empty = what the page says
  useEffect(() => { try { const v = localStorage.getItem("view:games-page"); if (v === "grid" || v === "list") setMode(v); } catch {} }, []);
  const choose = (m) => { setMode(m); try { localStorage.setItem("view:games-page", m); } catch {} };
  const [open, setOpen] = useState(null); // the game that is being played
  const lang = getLanguage();

  useEffect(() => {
    if (!ready) return;
    setGames(null); setError("");
    api(`/plugins/run/games/${user ? "list" : "public/list"}?lang=${encodeURIComponent(lang)}`).then((d) => setGames(d.games || [])).catch((e) => { setGames([]); setError(errorText(e)); });
  }, [ready, user, lang]);

  const cats = useMemo(() => [...new Set((preview ? [...(games || []), ...SAMPLE] : games || []).flatMap((g) => g.categories || []))], [games, preview]);
  const all = preview ? [...(games || []), ...SAMPLE] : games || [];
  const list = all.filter((g) => (!cat || (g.categories || []).includes(cat)) && (!q || `${g.title} ${g.description}`.toLowerCase().includes(q.toLowerCase())));
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
      <PageBlocks pageKey="games" title={tx("Spelletjes")} />
      {error && <div className="alert">{error}</div>}
      {games && !user && games.length > 0 && <div className="card" style={{ marginBottom: "1rem", display: "flex", gap: ".8rem", alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}><span>{tx("Log in om te spelen.")}</span><Link href="/login" className="btn primary">{tx("Inloggen")}</Link></div>}
      <div className="games-bar">
        <div className="games-chips">
          {cats.length > 0 && ["", ...cats].map((c) => <button key={c || "all"} type="button" className={`btn ${cat === c ? "on" : ""}`} onClick={() => setCat(c)}>{c || tx("Alle")}</button>)}
        </div>
        <span className="games-tools">
          <input type="search" placeholder={tx("Zoek een spel…")} value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="view-switch" role="group" aria-label={tx("Weergave")}>
            <button type="button" className={mode === "grid" ? "active" : ""} onClick={() => choose("grid")} title={tx("Tegels")} aria-pressed={mode === "grid"}><IconGrid /></button>
            <button type="button" className={mode === "list" ? "active" : ""} onClick={() => choose("list")} title={tx("Lijst")} aria-pressed={mode === "list"}><IconMenu /></button>
          </span>
        </span>
      </div>
      {games === null ? <Busy /> : (
        <Paged id="games-page" selector=".games-grid" query={`${q}|${cat}`}><div className="games-grid" data-view={mode || undefined}>
          {list.map((g) => (
            <button key={g.slug} type="button" className="card games-card" onClick={() => { if (g.sample) return; user ? setOpen(g) : (window.location.href = "/login"); }}>
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
        </div></Paged>
      )}
      {games && plays > 0 && <div className="games-foot muted">{tx("{0} spellen", games.length)} · {tx("{0} keer gespeeld", plays)}</div>}
    </>
  );
}
