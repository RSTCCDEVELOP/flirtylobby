// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { tx } from "../../lib/t";
import Tabs from "../../components/Tabs";
import ThemeToggle from "../../components/ThemeToggle";
import { IconGrid, IconInfo, IconKey, IconShield } from "../../components/Icons";
import Loading from "../../components/Loading";
import { matches } from "../../lib/useView";
import { tileWords } from "../../lib/admin-tiles";

// /easy2edit_version: version, build, modules and administrators. Open to everybody; only the prices need a superadmin login.
export default function Easy2editVersion() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("overview");
  const [q, setQ] = useState("");
  useEffect(() => {
    api("/system/overview/").then(setD).catch((e) => setErr(e.message || "Error"));
  }, []);

  const groups = useMemo(() => {
    if (!d) return [];
    const needle = q.trim().toLowerCase();
    const list = d.modules.filter((m) => matches(needle, m.label, m.key, m.group, m.desc, tileWords(m.key)));
    return [...new Set(list.map((m) => m.group))].map((g) => [g, list.filter((m) => m.group === g)]);
  }, [d, q]);

  const shell = { maxWidth: 960, margin: "0 auto", padding: "2rem 1rem 7rem" }; // room under the fixed Beheer bar
  if (err) return <main style={shell}><div className="card"><p>{err}</p></div></main>;
  if (!d) return <main style={shell}><p className="muted">{<Loading compact />}</p></main>;

  const on = d.modules.filter((m) => m.enabled).length;
  return (
    <main style={shell}>
      <div className="card" style={{ padding: "1.5rem 1.75rem", color: "var(--text)", background: "var(--card)" }}>
      <header style={{ marginBottom: "1.25rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
        <div>
          <p className="muted" style={{ margin: 0, fontSize: ".8rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" }}>{tx("Systeeminformatie")}</p>
          <h1 style={{ margin: ".2rem 0 0" }}>{d.name}</h1>
        </div>
        <ThemeToggle /> {/* light / dark mode */}
      </header>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          ["overview", "Overzicht", <IconInfo key="i" />],
          ["modules", "Modules", <IconGrid key="g" />, d.modules.length],
          ["admins", "Beheerders", <IconShield key="s" />, d.admins?.length],
          ["license", "Licentie", <IconKey key="k" />],
        ]}
      />

      {tab === "overview" && (
        <div className="cards">
          <div className="card stat"><span>{tx("Versie")}</span><strong>{d.version}</strong></div>
          <div className="card stat"><span>{tx("Build")}</span><strong>{d.build}</strong></div>
          <div className="card stat"><span>{tx("Modules aan")}</span><strong>{on} / {d.modules.length}</strong></div>
          {d.admins && <div className="card stat"><span>{tx("Beheerders")}</span><strong>{d.admins.length}</strong></div>}
        </div>
      )}

      {tab === "modules" && (
        <div style={{ marginTop: "1.25rem" }}>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Zoek een module…")} aria-label={tx("Zoek een module…")} style={{ width: "100%", maxWidth: 360, marginBottom: "1rem" }} />
          {groups.length === 0 && <p className="muted">{tx("Geen modules gevonden.")}</p>}
          {groups.map(([g, list]) => (
            <section key={g} style={{ marginBottom: "1.25rem" }}>
              <h3 style={{ margin: "0 0 .5rem" }}>{g}</h3>
              <div className="card table-wrap">
                <table>
                  <thead><tr><th>{tx("Module")}</th><th>{tx("Type")}</th><th style={{ textAlign: "right" }}>{tx("Status")}</th></tr></thead>
                  <tbody>
                    {list.map((m) => (
                      <tr key={m.key}>
                        <td>{m.label}</td>
                        <td className="muted">{m.core ? tx("Kern") : m.plugin ? tx("Plugin") : tx("Module")}</td>
                        <td className="actions"><span className={`badge ${m.enabled ? "ok" : "off"}`}>{m.enabled ? tx("Aan") : tx("Uit")}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      {tab === "license" && (
        <div style={{ marginTop: "1.25rem" }}>
          {d.license ? (
            <div className="card table-wrap">
              <table>
                <tbody>
                  {[
                    ["Licentienummer", d.license.number || "—"],
                    ["Klant", d.license.client || "—"],
                    ["Hoofdadres", d.license.main_url || "—"],
                    ["Uitgegeven op", d.license.issued_at ? String(d.license.issued_at).slice(0, 10) : "—"],
                    ["Geldig tot", d.license.valid_until || "—"],
                    ["Looptijd (maanden)", d.license.renew_months],
                    ...(d.license.yearly !== undefined ? [["Prijs per maand", d.license.monthly], ["Prijs per kwartaal", d.license.quarterly], ["Prijs per jaar", d.license.yearly]] : []),
                  ].map(([k, v]) => (
                    <tr key={k}><th style={{ textTransform: "none", fontSize: ".9rem", width: "40%" }}>{tx(k)}</th><td style={{ whiteSpace: "normal" }}>{v}</td></tr>
                  ))}
                  <tr><th style={{ textTransform: "none", fontSize: ".9rem" }}>{tx("Status")}</th><td><span className={`badge ${d.license.has && !d.license.expired ? "ok" : "off"}`}>{!d.license.has ? tx("Geen licentie") : d.license.expired ? tx("Verlopen") : tx("Geldig")}</span></td></tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card"><p className="muted" style={{ margin: 0 }}>{tx("Geen licentie gevonden.")}</p></div>
          )}
          {d.license && (
            <>
              <h3 style={{ margin: "1.25rem 0 .5rem" }}>{tx("Reseller")}</h3>
              <div className="card table-wrap">
                {d.license.reseller?.name || d.license.reseller?.email || d.license.reseller?.url ? (
                  <table>
                    <tbody>
                      <tr><th style={{ textTransform: "none", fontSize: ".9rem", width: "40%" }}>{tx("Naam")}</th><td style={{ whiteSpace: "normal" }}>{d.license.reseller.name || "—"}</td></tr>
                      <tr><th style={{ textTransform: "none", fontSize: ".9rem" }}>{tx("E-mailadres")}</th><td style={{ whiteSpace: "normal" }}>{d.license.reseller.email ? <a href={`mailto:${d.license.reseller.email}`}>{d.license.reseller.email}</a> : "—"}</td></tr>
                      <tr><th style={{ textTransform: "none", fontSize: ".9rem" }}>{tx("Website")}</th><td style={{ whiteSpace: "normal" }}>{/^https?:\/\//.test(d.license.reseller.url || "") ? <a href={d.license.reseller.url} target="_blank" rel="noopener noreferrer">{d.license.reseller.url}</a> : "—"}</td></tr>
                    </tbody>
                  </table>
                ) : (
                  <p className="muted" style={{ margin: 0, padding: "1rem" }}>{tx("Er is geen reseller ingesteld voor deze licentie.")}</p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "admins" && (
        <div style={{ marginTop: "1.25rem" }}>
          {d.admins?.length ? (
            <div className="card table-wrap">
              <table>
                <thead><tr><th>{tx("E-mailadres")}</th><th>{tx("Naam")}</th><th>{tx("Niveau")}</th><th style={{ textAlign: "right" }}>{tx("Status")}</th></tr></thead>
                <tbody>
                  {d.admins.map((a) => (
                    <tr key={a.email}>
                      <td>{a.email}</td>
                      <td>{a.name || <span className="muted">—</span>}</td>
                      <td>{a.superadmin_plus ? "Superadmin+" : "Superadmin"}</td>
                      <td className="actions"><span className={`badge ${a.active ? "ok" : "off"}`}>{a.active ? tx("Actief") : tx("Uitgeschakeld")}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card"><p className="muted" style={{ margin: 0 }}>{tx("Geen beheerders gevonden.")}</p></div>
          )}
        </div>
      )}
      </div>
    </main>
  );
}
