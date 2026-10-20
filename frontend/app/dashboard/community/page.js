"use client";

import { tx } from "../../../lib/t";
import Link from "next/link";
import { useEffect, useState } from "react";
import DashHero from "../../../components/DashHero";
import { useModules } from "../../../components/Modules";
import { api } from "../../../lib/api";

// What matters per community theme: the buttons under the title, and the numbers shown first
const THEME = {
  dating: { cta: [["/dashboard/community/discover?tab=swipe", "Start met swipen"], ["/dashboard/community/discover?tab=likedme", "Wie vindt mij leuk?"]], first: ["matches", "likes", "messages", "chat"] },
  business: { cta: [["/dashboard/community/discover?tab=search", "Netwerk zoeken"], ["/dashboard/community/requests", "Verbindingsverzoeken"]], first: ["friends", "requests", "messages", "chat"] },
  sporters: { cta: [["/dashboard/community/discover?tab=search", "Trainingsmaatje zoeken"], ["/dashboard/community/chat", "Naar de chat"]], first: ["friends", "chat", "messages", "requests"] },
  webshop: { cta: [["/leden", "Verkopers en winkels"], ["/dashboard/community/messages", "Berichten"]], first: ["friends", "messages", "chat", "requests"] },
  normal: { cta: [["/dashboard/community/discover?tab=search", "Leden zoeken"], ["/dashboard/community/profile", "Mijn profiel aanpassen"]], first: ["friends", "messages", "chat", "requests"] },
};

// "Mijn community": a dashboard that fits the community theme of the website (dating, business, sporters, webshop, normal)
export default function Community() {
  const mods = useModules();
  const [s, setS] = useState(null);
  const [theme, setTheme] = useState("normal");
  useEffect(() => { api("/community/summary/").then(setS).catch(() => {}); api("/community/config/").then((d) => setTheme(d.profile?.theme || "normal")).catch(() => {}); }, []);
  const on = (m) => mods[m] !== false;
  const t = THEME[theme] || THEME.normal;
  const all = {
    matches: on("discover") && { label: "Matches", value: s?.discover?.matches, hint: tx("wederzijdse likes"), href: "/dashboard/community/discover?tab=matches" },
    likes: on("discover") && { label: "Nieuwe likes", value: s?.discover?.likes_new, hint: tx("die je nog niet zag"), href: "/dashboard/community/discover?tab=likedme" },
    friends: on("profiles") && { label: theme === "business" ? "Verbindingen" : theme === "sporters" ? "Trainingsmaatjes" : "Vrienden", value: s?.friends, hint: tx("in je netwerk"), href: "/dashboard/community/requests" },
    requests: on("profiles") && { label: "Verzoeken", value: s?.requests, hint: tx("wachten op jou"), href: "/dashboard/community/requests" },
    messages: on("messages") && { label: "Berichten", value: s?.unread_messages, hint: tx("ongelezen"), href: "/dashboard/community/messages" },
    chat: on("chat") && { label: "Chat", value: s?.unread_chat, hint: tx("ongelezen chatberichten"), href: "/dashboard/community/chat" },
  };
  const stats = t.first.map((k) => all[k]).filter(Boolean);
  const actions = t.cta.filter(([href]) => !href.includes("discover") || on("discover")).map(([href, label]) => ({ href, label }));
  const more = [
    on("profiles") && { href: "/dashboard/community/profile", title: "Mijn profielpagina", big: s?.profile.enabled ? tx("Actief") : tx("Nog niet actief"), small: s ? tx("{0} foto's", s.profile.photos) : "" },
    on("discover") && { href: "/dashboard/community/discover", title: "Zoeken & matchen", big: tx("Vind andere leden"), small: s?.discover ? tx("{0} favorieten", s.discover.favorites) : "" },
    on("profiles") && { href: "/leden", title: "Ledenlijst", big: tx("Leden zoeken"), small: tx("Bekijk profielen waar je bij mag") },
    on("profiles") && { href: "/dashboard/community/blocked", title: "Geblokkeerd", big: s ? String(s.blocked) : "…", small: tx("users die je niet meer kunnen zien of vinden") },
  ].filter(Boolean);
  return (
    <>
      <DashHero title="Mijn community" textId={`page.my-community.intro.${theme}`} actions={actions} stats={stats} />
      <h2 className="dash-section">{tx("Meer in je community")}</h2>
      <div className="cards" style={{ marginTop: 0 }}>
        {more.map((m) => (
          <Link key={m.href} href={m.href} className="card stat link-card">
            <span>{tx(m.title)}</span>
            <strong style={{ fontSize: "1.25rem" }}>{m.big}</strong>
            <small>{m.small}</small>
          </Link>
        ))}
      </div>
    </>
  );
}
