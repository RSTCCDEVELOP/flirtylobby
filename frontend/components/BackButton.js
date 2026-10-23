// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { tx } from "../lib/t";
import { IconBack } from "./Icons";

// "Back": to the page the visitor came from (inside this tab), else to the main menu of the area (fallback).
// A small stack of visited pages is kept per tab; going back takes the top off, so it works like a trail and never ping-pongs.
const KEY = "navtrail";
const read = () => { try { return JSON.parse(sessionStorage.getItem(KEY)) || []; } catch { return []; } };
const write = (a) => { try { sessionStorage.setItem(KEY, JSON.stringify(a.slice(-30))); } catch {} };

export default function BackButton({ pathname, fallback, label }) {
  const router = useRouter();
  const [prev, setPrev] = useState(null);
  useEffect(() => {
    let st = read();
    let backing = false;
    try { backing = sessionStorage.getItem("navback") === "1"; sessionStorage.removeItem("navback"); } catch {}
    if (!backing && st[st.length - 1] !== pathname) st = [...st, pathname];
    else if (backing && st[st.length - 1] !== pathname) st = [...st, pathname];
    write(st);
    setPrev(st.length > 1 ? st[st.length - 2] : null);
  }, [pathname]);
  const target = prev && prev !== pathname ? prev : fallback;
  if (!target || target === pathname) return null;
  const go = () => {
    const st = read();
    if (prev && st[st.length - 1] === pathname) { st.pop(); write(st); try { sessionStorage.setItem("navback", "1"); } catch {} }
    router.push(target);
  };
  return (
    <button type="button" className="btn sm back-btn" onClick={go} title={prev ? tx("Terug naar de vorige pagina") : tx("Terug naar het hoofdmenu")}>
      <IconBack width={16} height={16} /> <span>{label || (prev ? tx("Terug") : tx("Hoofdmenu"))}</span>
    </button>
  );
}
