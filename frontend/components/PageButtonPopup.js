// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";
import { anchorStyle } from "../lib/anchor";
import { translateName } from "../lib/translate-name";
import Tabs from "./Tabs";

// The settings of a button on a page (edit mode): its text per language (with Claude translating it into the installed languages), where it goes
// (a page of the website or any link) and its look. `btn` is what the item holds; onChange(btn) after every change.
export default function PageButtonPopup({ btn = {}, onChange, onClose, anchor }) {
  const [tab, setTab] = useState("text");
  const [langs, setLangs] = useState([]);
  const [def, setDef] = useState("nl");
  const [pages, setPages] = useState([]);
  const [ai, setAi] = useState(false);
  const [prog, setProg] = useState(null);
  const [err, setErr] = useState("");
  const [mode, setMode] = useState(btn.page ? "page" : "url");
  useEffect(() => {
    api("/languages/").then((d) => { setLangs(d.languages || []); setDef(d.default || "nl"); }).catch(() => {});
    api("/pages/").then((d) => { setPages((d.pages || []).filter((p) => p.enabled !== false && p.kind !== "link" && p.path)); setAi(!!d.ai); }).catch(() => {});
  }, []);
  const labels = btn.labels || {};
  const set = (patch) => onChange({ ...btn, ...patch });
  const setLabel = (code, v) => set({ labels: { ...labels, [code]: v } });
  async function translate() {
    const text = (labels[def] || "").trim();
    if (!text) return;
    setErr("");
    try {
      const { titles, failed } = await translateName(text, def, setProg);
      set({ labels: { ...labels, ...titles } });
      if (failed) setErr(tx("{0} talen konden niet worden vertaald; die nemen de hoofdtaal over.", failed));
    } catch (e) { setErr(errorText(e)); }
    setProg(null);
  }
  const titleOf = (p) => p.title?.[def] || p.title?.nl || Object.values(p.title || {})[0] || p.key;
  const body = (
    <div className={anchor ? "pb-anchorback" : "overlay"} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card modal form" role="dialog" aria-label={tx("Knop")} style={{ maxWidth: 620, ...anchorStyle(anchor, 620) }} onMouseDown={(e) => e.stopPropagation()}>
        <h2>{tx("Knop")}</h2>
        <Tabs tabs={[["text", "Tekst"], ["link", "Link"], ["look", "Uiterlijk"]]} value={tab} onChange={setTab} />
        {err && <div className="alert">{err}</div>}
        {tab === "text" && (
          <div className="stack-sm">
            <label>{tx("Tekst op de knop")} ({def})<input value={labels[def] || ""} maxLength={80} onChange={(e) => setLabel(def, e.target.value)} autoFocus /></label>
            <div className="row" style={{ justifyContent: "flex-start", gap: ".6rem", alignItems: "center" }}>
              <button type="button" className="btn primary sm" disabled={!ai || !(labels[def] || "").trim() || !!prog} onClick={translate} title={ai ? undefined : tx("Claude (AI) is niet ingesteld.")}>{prog ? `${tx("Vertalen…")} ${prog.done}/${prog.total}` : tx("Vertaal met AI naar alle talen")}</button>
              <small className="muted">{tx("De tekst wordt vertaald naar alle geïnstalleerde talen; je kunt elke vertaling daarna nog aanpassen.")}</small>
            </div>
            <div className="pb-btnlangs">
              {langs.filter((l) => l.code !== def).map((l) => (
                <label key={l.code}>{l.native_name || l.name} ({l.code})<input value={labels[l.code] || ""} maxLength={80} onChange={(e) => setLabel(l.code, e.target.value)} placeholder={labels[def] || ""} /></label>
              ))}
            </div>
          </div>
        )}
        {tab === "link" && (
          <div className="stack-sm">
            <span className="pb-seg">{[["page", "Pagina van de website"], ["url", "Eigen link"]].map(([k, l]) => <button type="button" key={k} className={mode === k ? "on" : ""} onClick={() => { setMode(k); if (k === "url") set({ page: "" }); }}>{tx(l)}</button>)}</span>
            {mode === "page" ? (
              <label>{tx("Naar welke pagina?")}
                <select value={btn.page || ""} onChange={(e) => set({ page: e.target.value, url: "" })}>
                  <option value="">{tx("Kies een pagina…")}</option>
                  {pages.map((p) => <option key={p.key} value={p.key}>{titleOf(p)} ({p.path})</option>)}
                </select></label>
            ) : (
              <label>{tx("Link")}<input value={btn.url || ""} placeholder="https://… / mailto:… / tel:… / /pad" onChange={(e) => set({ url: e.target.value, page: "" })} /></label>
            )}
            <label className="check"><span className="switch"><input type="checkbox" checked={!!btn.new_tab} onChange={(e) => set({ new_tab: e.target.checked })} /><span /></span><span>{tx("Open in een nieuw tabblad")}</span></label>
          </div>
        )}
        {tab === "look" && (
          <div className="stack-sm">
            <div className="pb-stylerow"><span>{tx("Stijl")}</span>
              <span className="pb-seg">{[["primary", "Gevuld"], ["outline", "Omlijnd"], ["ghost", "Tekst"]].map(([k, l]) => <button type="button" key={k} className={(btn.style || "primary") === k ? "on" : ""} onClick={() => set({ style: k })}>{tx(l)}</button>)}</span></div>
            <div className="pb-stylerow"><span>{tx("Grootte")}</span>
              <span className="pb-seg">{[["sm", "Klein"], ["md", "Middel"], ["lg", "Groot"]].map(([k, l]) => <button type="button" key={k} className={(btn.size || "md") === k ? "on" : ""} onClick={() => set({ size: k })}>{tx(l)}</button>)}</span></div>
            <label className="check"><span className="switch"><input type="checkbox" checked={!!btn.full} onChange={(e) => set({ full: e.target.checked })} /><span /></span><span>{tx("Over de volle breedte")}</span></label>
          </div>
        )}
        <div className="row" style={{ justifyContent: "flex-end" }}><button type="button" className="btn primary" onClick={onClose}>{tx("Klaar")}</button></div>
      </div>
    </div>
  );
  return typeof document === "undefined" ? null : createPortal(body, document.body);
}
