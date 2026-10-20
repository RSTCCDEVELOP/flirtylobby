"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { tx } from "../lib/t";
import { menuLabel, useMenu } from "./SiteMenu";

// The overview page of a text-only menu item: the pages under it as tiles, under a banner with the name of the item
export default function MenuOverview({ pageKey }) {
  const { items } = useMenu();
  const it = items.find((i) => i.key === pageKey);
  if (!it) return notFound();
  const kids = it.children || [];
  return (
    <section className="menu-overview pb" data-t="menu">
      <div className="pb-rowwrap hero" data-t="menu"><h1 className="pb-hero-title">{menuLabel(it.titles)}</h1></div>
      <div className="menu-tiles">
        {kids.map((c) => {
          const url = c.urls?.[typeof window === "undefined" ? "nl" : (document.documentElement.lang || "nl")] || c.url;
          return (
            <Link key={c.id} href={url} className="card menu-tile"><strong>{menuLabel(c.titles)}</strong><small className="muted">{url}</small></Link>
          );
        })}
        {!kids.length && <p className="muted">{tx("Er staat nog niets onder dit menu-item.")}</p>}
      </div>
    </section>
  );
}
