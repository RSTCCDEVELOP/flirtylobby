"use client";

import { useEffect, useState } from "react";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";
import Flag from "./Flag";
import ProgressBar from "./ProgressBar";
import { IconX } from "./Icons";
import MarketingMock, { EMOJI, HUE } from "./MarketingMock";

const siteLang = () => { try { return localStorage.getItem("lang") || "nl"; } catch { return "nl"; } };

// The marketing pop-up of a module: a short text, three advantages and an example with made-up data in the theme of the site. The flags switch the language;
// super admins also see the AI buttons (improve the text, translate it into the active languages).
export default function MarketingPopup({ module, lang: start, onClose }) {
  const [lang, setLang] = useState(start || siteLang());
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [wish, setWish] = useState("");
  useEffect(() => { const k = (e) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }, [onClose]);
  const load = (l) => api(`/marketing/${module}/?lang=${l}`).then((r) => { setD(r); setLang(r.lang); setErr(""); }).catch((e) => setErr(errorText(e)));
  useEffect(() => { load(lang); }, [module]); // eslint-disable-line react-hooks/exhaustive-deps

  const ask = async (action) => {
    setBusy(action); setNote(""); setErr("");
    try {
      await api(`/system/marketing/${module}/ai/`, { method: "POST", body: action === "improve" ? { action, lang, instruction: wish } : { action } });
      await load(lang);
      setNote(action === "improve" ? tx("De tekst is verbeterd.") : tx("De tekst is vertaald naar de actieve talen."));
    } catch (e) { setErr(errorText(e)); }
    setBusy("");
  };
  const c = d?.content;
  const rtl = d?.languages?.find((l) => l.code === lang)?.rtl;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="card modal mk-modal" role="dialog" aria-label={c?.title || "Marketing"} dir={rtl ? "rtl" : undefined} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="icon-btn info-x" onClick={onClose} aria-label={tx("Sluiten")}><IconX /></button>
        {err && !c && <div className="alert">{err}</div>}
        {!c && !err && <p className="muted">{tx("Laden…")}</p>}
        {c && (
          <>
            <header className="mk-hero" style={{ background: `linear-gradient(135deg, ${(HUE[d.group] || HUE.Systeem)[0]}, ${(HUE[d.group] || HUE.Systeem)[1]})` }}>
              <span className="mk-bigico" aria-hidden="true">{EMOJI[module] || "✨"}</span>
              <div className="mk-herotext"><small>{tx(d.group || "Easy2edit")}</small><h2>{c.title}</h2><p>{c.tagline}</p></div>
              {d.languages.length > 1 && (
                <span className="mk-flags" role="group" aria-label={tx("Taal")}>
                  {d.languages.map((l) => (
                    <button key={l.code} type="button" className={`mk-flag${l.code === lang ? " on" : ""}`} title={l.native_name} aria-label={l.native_name} aria-pressed={l.code === lang} onClick={() => load(l.code)}><Flag code={l.code} width={26} title={l.native_name} /></button>
                  ))}
                </span>
              )}
            </header>
            <div className="mk-body">
              <section className="mk-text">
                <p className="mk-intro">{c.intro}</p>
                {c.story && <p className="mk-story">{c.story}</p>}
                {c.steps?.length > 0 && (
                  <div className="mk-steps"><h3>{tx("Zo werkt het")}</h3><ol>{c.steps.map((p, i) => <li key={i}><span className="mk-n">{i + 1}</span><div><strong>{p.t}</strong><small>{p.d}</small></div></li>)}</ol></div>
                )}
                {d.source === "fallback" && <small className="muted">{tx("Nog niet vertaald: de Engelse tekst wordt getoond.")}</small>}
              </section>
              <aside className="mk-demo" aria-label={c.demo.title}>
                <div className="mk-demohead"><span /><span /><span /><strong>{c.demo.title}</strong></div>
                <MarketingMock module={module} demo={c.demo} />
                <div className="mk-stats">{c.demo.stats.map((s, i) => <div key={i}><strong>{s.v}</strong><span>{s.l}</span></div>)}</div>
                <small className="mk-fake">{tx("Voorbeeldgegevens")}</small>
              </aside>
            </div>
            <ul className="mk-points">{c.points.map((p, i) => <li key={i}><span className="mk-dot" aria-hidden="true">✓</span><div><strong>{p.t}</strong><small>{p.d}</small></div></li>)}</ul>
            {c.usecase && <p className="mk-use">{c.usecase}</p>}
            {d.can_edit && (
              <section className="mk-ai">
                <div className="mk-ai-top"><strong>✨ {tx("AI")}</strong><small className="muted">{tx("Alleen zichtbaar voor superadmins.")}</small></div>
                <label>{tx("Wat moet er beter of anders? (optioneel)")}<input value={wish} onChange={(e) => setWish(e.target.value)} placeholder={tx("bijvoorbeeld korter en zakelijker")} /></label>
                <div className="mk-ai-actions">
                  <button type="button" className="btn primary" disabled={!!busy} onClick={() => ask("improve")}>✨ {tx("Verbeter de pagina met AI")}</button>
                  <button type="button" className="btn" disabled={!!busy} onClick={() => ask("translate")}>🌐 {tx("Vertaal naar de actieve talen")}</button>
                </div>
                <ProgressBar running={!!busy} label={busy === "translate" ? tx("De AI vertaalt de tekst…") : tx("De AI verbetert de tekst…")} />
                {note && <div className="alert ok">{note}</div>}
                {err && <div className="alert">{err}</div>}
              </section>
            )}
            <footer className="mk-foot"><button type="button" className="btn primary" onClick={onClose}>{tx("Sluiten")}</button></footer>
          </>
        )}
      </div>
    </div>
  );
}
