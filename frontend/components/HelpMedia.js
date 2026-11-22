// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { mediaUrl } from "../lib/api";
import { getLanguage } from "../lib/t";

// A help answer may hold {{image:name}} or {{video:name}}: the picture or the video of the manual, in the mode (light or dark) that the reader uses.
const MARK = /\{\{(image|video):([a-z0-9-]{1,60})\}\}/g;
const mode = () => (typeof document !== "undefined" && document.documentElement.dataset.theme === "dark" ? "dark" : "light");

function useMode() {
  const [m, setM] = useState("light");
  useEffect(() => {
    const f = () => setM(mode());
    f();
    window.addEventListener("themechange", f);
    const mo = new MutationObserver(f);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => { window.removeEventListener("themechange", f); mo.disconnect(); };
  }, []);
  return m;
}

function Media({ kind, name }) {
  const m = useMode();
  const [failed, setFailed] = useState(false);
  const [noDark, setNoDark] = useState(false);
  const lang = getLanguage() === "nl" ? "nl" : "en";
  const sfx = m === "dark" && !noDark ? "-dark" : "";
  const base = mediaUrl(`/api/manual/${kind === "image" ? "html" : "video"}/${lang}/${kind === "image" ? "images/" : ""}${name}${sfx}`);
  if (failed) return null;
  if (kind === "image") return <img className="help-media" src={`${base}.jpg`} alt="" loading="lazy" onError={() => (sfx ? setNoDark(true) : setFailed(true))} />;
  return <video className="help-media" key={base} controls preload="none" playsInline poster={`${base}.jpg`} src={`${base}.mp4`} onError={() => (sfx ? setNoDark(true) : setFailed(true))} />;
}

export default function HelpMedia({ text }) {
  const parts = [];
  let last = 0, m;
  const s = String(text || "");
  MARK.lastIndex = 0;
  while ((m = MARK.exec(s))) {
    if (m.index > last) parts.push(<p key={last}>{s.slice(last, m.index).trim()}</p>);
    parts.push(<Media key={m.index} kind={m[1]} name={m[2]} />);
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push(<p key={last}>{s.slice(last).trim()}</p>);
  return <>{parts}</>;
}
