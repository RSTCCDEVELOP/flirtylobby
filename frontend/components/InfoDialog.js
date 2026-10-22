"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api, errorText } from "../lib/api";
import { tx } from "../lib/t";
import { IconInfo, IconX } from "./Icons";
import { Logo } from "./BrandingContext";
import Tabs from "./Tabs";

// "Info" in the Beheer menu: the version of Easy2edit, the installed plugins and the copyright
function Popup({ onClose }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("info");
  const [openGroup, setOpenGroup] = useState(""); // only one section open at a time
  useEffect(() => { api("/system/info/").then(setD).catch((e) => setErr(errorText(e))); }, []);
  useEffect(() => { const k = (e) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }, [onClose]);
  return createPortal(
    <div className="overlay" onClick={onClose}>
      <div className="card modal info-modal" role="dialog" aria-label={tx("Info")} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="icon-btn info-x" onClick={onClose} aria-label={tx("Sluiten")}><IconX /></button>
        <div className="info-logo"><Logo /></div>
        {err && <div className="alert">{err}</div>}
        {!d && !err && <p className="muted">{tx("Laden…")}</p>}
        {d && (
          <>
            <h2 style={{ margin: ".4rem 0 0", textAlign: "center" }}>{d.name} <small className="muted">{tx("versie")} {d.version} {tx("build")} {d.build}</small></h2>
            <Tabs value={tab} onChange={setTab} tabs={[["info", "Info"], ["plugins", "Plugins", null, d.plugins.length], ["modules", "Modules", null, d.modules.length], ["about", "Over"]]} />
            <div style={{ marginTop: ".8rem" }}>
              {tab === "info" && (
                <ul className="info-plugins">
                  {[["Licentienummer", d.license?.number], ["Opdrachtgever", d.license?.client], ["Adres opdrachtgever", d.license?.client_address], ["Licentie geldig tot", d.license?.valid_until ? new Date(d.license.valid_until).toLocaleDateString() + (d.license.expired ? ` (${tx("verlopen")})` : "") : ""], ["Website", d.site?.site_name], ["Eigenaar", d.site?.company_name], ["Adres (URL)", d.site?.frontend_url || (typeof window !== "undefined" ? window.location.origin : "")],
                    ["E-mail", d.site?.contact_email], ["Support", d.site?.support_email], ["Telefoon", d.site?.phone], ["Adres", d.site?.address], ["KvK", d.site?.kvk], ["BTW-nummer", d.site?.vat_id]]
                    .filter(([, v]) => v).map(([k, v]) => (
                      <li key={k}><span>{tx(k)}</span><span className="info-ver">{/^https?:\/\//.test(v) ? <a href={v} target="_blank" rel="noreferrer">{v}</a> : k === "E-mail" || k === "Support" ? <a href={`mailto:${v}`}>{v}</a> : v}</span></li>
                    ))}
                  <li><span>{tx("Versie")}</span><span className="info-ver">{d.version} {tx("build")} {d.build}</span></li>
                  <li><span>{tx("Plugins")}</span><span className="info-ver">{d.plugins.filter((p) => p.enabled).length} {tx("aan")} / {d.plugins.length}</span></li>
                  <li><span>{tx("Modules")}</span><span className="info-ver">{d.modules.filter((m) => m.enabled).length} {tx("aan")} / {d.modules.length}</span></li>
                </ul>
              )}
              {tab === "about" && (
                <ul className="info-plugins">
                  <li><span>{tx("Reseller")}</span><span className="info-ver"><strong>Studio2 Communications BV</strong> · <a href="https://www.studio2.nl" target="_blank" rel="noreferrer">www.studio2.nl</a></span></li>
                  <li><span>{tx("Intellectueel eigendom")}</span><span className="info-ver" style={{ display: "grid", justifyItems: "end", gap: ".15rem" }}><strong>RST Coaching en Consultancy BV</strong><small>Ambachtsweg 46</small><small>3542 DH Utrecht</small></span></li>
                  <li><span>{tx("Ontwerp en architectuur")}</span><span className="info-ver"><strong>Ronald Stolk</strong></span></li>
                </ul>
              )}
              {tab === "plugins" && (d.plugins.length ? (
                <ul className="info-plugins">
                  {d.plugins.map((p) => (
                    <li key={p.name}><span><strong>{p.title}</strong>{p.author && <small className="muted"> · {p.author}</small>}</span><span className="info-ver">{p.version && `v${p.version}`} <span className={`badge ${p.enabled ? "ok" : "off"}`}>{p.enabled ? tx("Aan") : tx("Uit")}</span></span></li>
                  ))}
                </ul>
              ) : <p className="muted">{tx("Er zijn geen plugins geïnstalleerd.")}</p>)}
              {tab === "modules" && [...new Set(d.modules.map((m) => m.group))].map((g) => {
                const list = d.modules.filter((m) => m.group === g);
                const isOpen = openGroup === g;
                return (
                  <div key={g} className="info-acc">
                    <button type="button" className="info-acc-head" aria-expanded={isOpen} onClick={() => setOpenGroup(isOpen ? "" : g)}>
                      <span>{tx(g)}</span>
                      <span className="info-ver">{list.filter((m) => m.enabled).length}/{list.length} <span className="info-chev" data-open={isOpen}>▾</span></span>
                    </button>
                    {isOpen && (
                      <ul className="info-plugins">
                        {list.map((m) => (
                          <li key={m.key} title={m.desc}><span><strong>{tx(m.label)}</strong></span><span className="info-ver"><span className={`badge ${m.enabled ? "ok" : "off"}`}>{m.enabled ? tx("Aan") : tx("Uit")}</span></span></li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="muted" style={{ textAlign: "center", margin: "1.2rem 0 0", fontSize: ".85rem" }}>© {new Date().getFullYear()} {d.copyright}. {tx("Alle rechten voorbehouden.")}</p>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

export default function InfoDialog({ className = "", children }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>{children || <><IconInfo /> <span className="label">{tx("Info")}</span></>}</button>
      {open && <Popup onClose={() => setOpen(false)} />}
    </>
  );
}
