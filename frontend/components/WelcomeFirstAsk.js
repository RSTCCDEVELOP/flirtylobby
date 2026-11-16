// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { tx } from "../lib/t";
import KitScope from "../lib/ui-kit/KitScope";
import { useAuth } from "./AuthContext";
import { answerWelcome, useSandboxFirst } from "../lib/firstRun";

// The very first popup of a new installation (and after a reset), for the superadmin: the language (Dutch or English) and the display (light or dark).
// It comes before every other message (licence, terms, sandbox, installation ...): they wait until it is answered.
const LANGS = [["nl", "Nederlands", "NL"], ["en", "English", "EN"]];
const MODES = [["light", "Licht", "#ffffff", "#f1f5f9", "#0f172a"], ["dark", "Donker", "#0b1220", "#1a2336", "#e5e7eb"]];

export default function WelcomeFirstAsk() {
  const { user } = useAuth();
  const { welcomeOpen } = useSandboxFirst(!!user?.is_staff);
  const [lang, setLang] = useState("nl");
  const [mode, setMode] = useState("light");
  useEffect(() => {
    try { const l = localStorage.getItem("lang"); if (l === "en" || l === "nl") setLang(l); } catch {}
    setMode(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  }, [welcomeOpen]);
  if (!user?.is_staff || !welcomeOpen || typeof document === "undefined") return null;
  const pickLang = (c) => { setLang(c); try { localStorage.setItem("lang", c); } catch {} window.dispatchEvent(new CustomEvent("langchange", { detail: c })); };
  const pickMode = (m) => { setMode(m); document.documentElement.dataset.theme = m; try { localStorage.setItem("theme", m); } catch {} window.dispatchEvent(new CustomEvent("themechange", { detail: m })); };
  const card = (on) => ({ position: "relative", display: "grid", gap: ".6rem", justifyItems: "center", padding: "1rem .8rem", borderRadius: 16, border: `2px solid ${on ? "var(--e2e-primary)" : "var(--e2e-border)"}`, background: on ? "color-mix(in srgb, var(--e2e-primary) 10%, var(--e2e-surface))" : "var(--e2e-surface)", color: "var(--e2e-text)", cursor: "pointer", font: "inherit", fontWeight: 600, boxShadow: on ? "0 6px 20px color-mix(in srgb, var(--e2e-primary) 25%, transparent)" : "none", transition: "all .15s" });
  const badge = (on) => on ? <span aria-hidden="true" style={{ position: "absolute", top: 8, right: 8, width: 22, height: 22, borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--e2e-primary)", color: "var(--e2e-on-primary, #fff)" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span> : null;
  const Sect = ({ n, title, children }) => <section style={{ display: "grid", gap: ".6rem" }}><h3 style={{ margin: 0, fontSize: ".78rem", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--e2e-muted)" }}>{n}. {title}</h3>{children}</section>;
  return createPortal(
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Welcome" style={{ zIndex: 100000 }}>
      <KitScope>
        <div className="e2e-card" data-easy2edit-tag="ui-welcome" style={{ width: "min(520px, 94vw)", padding: 0, overflow: "hidden", borderRadius: 20, boxShadow: "0 24px 70px rgba(0,0,0,.45)" }}>
          <header style={{ padding: "1.5rem 1.6rem 1.2rem", background: "var(--e2e-primary)", color: "var(--e2e-on-primary, #fff)" }}>
            <h2 style={{ margin: 0, fontSize: "1.5rem", color: "inherit" }}>{tx("Welkom bij easy2edit")}</h2>
            <p style={{ margin: ".35rem 0 0", opacity: .9 }}>{tx("Kies eerst je taal en hoe het scherm eruit ziet. Je past dit later altijd aan.")}</p>
          </header>
          <div style={{ padding: "1.3rem 1.6rem", display: "grid", gap: "1.3rem" }}>
            <Sect n={1} title={tx("Taal")}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".8rem" }}>
                {LANGS.map(([c, l, ab]) => <button type="button" key={c} aria-pressed={lang === c} onClick={() => pickLang(c)} style={card(lang === c)}>
                  {badge(lang === c)}
                  <span aria-hidden="true" style={{ width: 46, height: 46, borderRadius: "50%", display: "grid", placeItems: "center", background: lang === c ? "var(--e2e-primary)" : "var(--e2e-border)", color: lang === c ? "var(--e2e-on-primary, #fff)" : "var(--e2e-text)", fontSize: ".95rem", letterSpacing: ".04em" }}>{ab}</span>
                  {l}
                </button>)}
              </div>
            </Sect>
            <Sect n={2} title={tx("Weergave")}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".8rem" }}>
                {MODES.map(([m, l, bg, sf, tc]) => <button type="button" key={m} aria-pressed={mode === m} onClick={() => pickMode(m)} style={card(mode === m)}>
                  {badge(mode === m)}
                  <span aria-hidden="true" style={{ width: "100%", height: 62, borderRadius: 10, background: bg, border: "1px solid var(--e2e-border)", display: "grid", gridTemplateColumns: "24% 1fr", gap: 5, padding: 6, boxSizing: "border-box" }}>
                    <i style={{ borderRadius: 4, background: sf }} />
                    <span style={{ display: "grid", gap: 4, alignContent: "start" }}><i style={{ height: 8, width: "70%", borderRadius: 3, background: tc, opacity: .8 }} /><i style={{ height: 6, borderRadius: 3, background: sf }} /><i style={{ height: 6, width: "50%", borderRadius: 3, background: "var(--e2e-primary)" }} /></span>
                  </span>
                  {tx(l)}
                </button>)}
              </div>
            </Sect>
          </div>
          <footer style={{ padding: "0 1.6rem 1.5rem", display: "flex", justifyContent: "flex-end" }}>
            <button type="button" className="e2e-btn" style={{ background: "var(--e2e-primary)", color: "var(--e2e-on-primary, #fff)", minWidth: 140 }} onClick={answerWelcome}>{tx("Verder")}</button>
          </footer>
        </div>
      </KitScope>
    </div>, document.body);
}
