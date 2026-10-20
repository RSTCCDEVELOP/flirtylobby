"use client";

import { tx } from "../lib/t";
import { IconCart } from "./Icons";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

// Links that plugins put in the header of the website (site_link in plugin.json), with a counter from the plugin's own storage (the cart)
export function ShopLinks() {
  const [links, setLinks] = useState([]);
  const [counts, setCounts] = useState({});
  useEffect(() => { api("/plugins/public/").then(setLinks).catch(() => setLinks([])); }, []);
  useEffect(() => {
    const read = () => setCounts(Object.fromEntries(links.filter((l) => l.count_store).map((l) => {
      let n = 0;
      try { const v = JSON.parse(localStorage.getItem(`plg:${l.name}:${l.count_store}`)); n = Array.isArray(v) ? v.reduce((a, i) => a + (Number(i.qty) || 0), 0) : 0; } catch {}
      return [l.name, n];
    })));
    read();
    window.addEventListener("plugin-store", read);
    window.addEventListener("storage", read);
    return () => { window.removeEventListener("plugin-store", read); window.removeEventListener("storage", read); };
  }, [links]);
  return links.map((l) => (
    <Link key={l.name} href={l.path} className="shop-link" title={tx(l.label)}>
      {l.icon === "cart" && <IconCart />} <span className={l.icon === "cart" ? "shop-label" : undefined}>{tx(l.label)}</span>{counts[l.name] > 0 && <span className="cart-count">{counts[l.name]}</span>}
    </Link>
  ));
}
