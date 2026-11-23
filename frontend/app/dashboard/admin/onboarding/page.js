// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { api, errorText } from "../../../../lib/api";
import { money } from "../../../../lib/format";
import { tx } from "../../../../lib/t";
import Loading from "../../../../components/Loading";
import { IconBolt, IconBriefcase, IconCheck, IconRefresh, IconRocket } from "../../../../components/Icons";

const PERIODS = [[1, "per maand"], [3, "per kwartaal"], [12, "per jaar"]];
const PANEL = { background: "color-mix(in srgb, var(--blue) 7%, var(--card))", border: "1px solid color-mix(in srgb, var(--blue) 16%, var(--line))", borderRadius: "calc(var(--radius) + 4px)", padding: "1.1rem 1.3rem" };

// Admin -> Systeem -> Onboarding: always there (no module to switch on). Starts the onboarding with what is known: check and change the name and address (they change on the easy2edit
// server too, the id and the easy2edit id stay the same), upgrade the licence to what is in use, change the hosting and the period.
export default function OnboardingPage() {
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState("");
  const [host, setHost] = useState("");
  const [months, setMonths] = useState(12);
  const load = () => api("/system/setup/").then((r) => { setD(r); setHost(r.hosting_current || ""); setMonths(Number(r.renew_months) || 12); }).catch((e) => setMsg({ ok: false, text: errorText(e) }));
  useEffect(() => { load(); const f = () => load(); window.addEventListener("setup-saved", f); return () => window.removeEventListener("setup-saved", f); }, []);
  if (!d) return msg ? <div className="alert">{msg.text}</div> : <Loading compact />;
  const lic = d.license, has = !!lic;
  const open = (detail) => window.dispatchEvent(new CustomEvent("open-setup-wizard", { detail }));
  const checkPrice = async (prev) => {  // does the price differ from what the licence was made for? Then the update screen (agreement and payment) opens
    setBusy("price"); setMsg(null);
    try {
      const r = await api("/system/license/change/");
      if (r?.changed) open({ mode: "update", change: { ...r, hosting_prev: prev || null } });
      else setMsg({ ok: true, text: tx("Je licentie is al berekend op wat je gebruikt: er is niets te upgraden.") });
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy("");
  };
  const changeHosting = async () => {
    setBusy("host"); setMsg(null);
    try {
      const r = await api("/system/license/hosting/", { method: "POST", body: { hosting: host, renew_months: months } });
      if (r.prev.hosting === r.now.hosting && Number(r.prev.renew_months) === Number(r.now.renew_months)) setMsg({ ok: true, text: tx("Er is niets veranderd.") });
      else await checkPrice(r.prev);
      await load();
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy("");
  };
  const Card = ({ icon, title, children }) => <section className="card" style={{ display: "grid", gap: ".7rem", alignContent: "start" }}><h2 style={{ margin: 0, fontSize: "1.05rem", display: "flex", alignItems: "center", gap: ".5rem" }}>{icon}{title}</h2>{children}</section>;
  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div style={{ ...PANEL, display: "flex", gap: "1rem", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0 }}>{tx("Onboarding")}</h1>
          <p className="muted" style={{ margin: ".3rem 0 0", maxWidth: "46rem" }}>{tx("Start de onboarding opnieuw met de gegevens die er zijn. Zo kun je je licentie upgraden, de hosting wijzigen, of je naam en adres bijwerken. Wat verandert gaat ook naar de easy2edit server; je id en easy2edit id blijven hetzelfde.")}</p>
        </div>
        <button type="button" className="btn primary" onClick={() => open()}><IconRocket /> {tx("Onboarding starten")}</button>
      </div>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} role="status">{msg.text}</div>}
      {has ? (
        <div style={{ ...PANEL, display: "grid", gap: ".3rem" }}>
          <strong>{tx("Je licentie")}</strong>
          <span>{lic.number} · {lic.client}</span>
          <span className="muted">{lic.main_url}{lic.valid_until ? ` · ${tx("tot")} ${new Date(lic.valid_until).toLocaleDateString()}` : ""}{d.license_server?.mode === "linked" ? ` · ${tx("gekoppeld aan easy2edit")}` : ""}</span>
        </div>
      ) : <div className="alert">{tx("Er is nog geen licentie. De onboarding maakt hem aan.")}</div>}
      <div className="cards" style={{ marginTop: 0 }}>
        <Card icon={<IconBriefcase />} title={tx("Gegevens controleren en bijwerken")}>
          <p className="muted" style={{ margin: 0 }}>{tx("Naam, adres en contactpersoon. Veranderingen gaan ook naar de easy2edit server.")}</p>
          <div><button type="button" className="btn" onClick={() => open()}>{tx("Gegevens openen")}</button></div>
        </Card>
        {has && (
          <Card icon={<IconBolt />} title={tx("Licentie upgraden")}>
            <p className="muted" style={{ margin: 0 }}>{tx("Gebruik je meer modules of plugins dan waar je licentie op is berekend? Controleer de prijs en werk de licentie bij.")}</p>
            <div><button type="button" className="btn" disabled={busy === "price"} onClick={() => checkPrice()}>{busy === "price" ? tx("Bezig…") : tx("Prijs controleren")}</button></div>
          </Card>
        )}
        {has && (
          <Card icon={<IconRefresh />} title={tx("Hosting en looptijd")}>
            <label style={{ display: "grid", gap: ".25rem", fontWeight: 600 }}>{tx("Hosting")}
              <select value={host} onChange={(e) => setHost(e.target.value)}>
                <option value="">{tx("Geen")}</option>
                {(d.hosting_options || []).map((o) => <option key={o.key} value={o.key}>{o.label}{Number(o.price) > 0 ? ` · ${money(o.price)} ${tx("per maand")}` : ""}</option>)}
              </select>
            </label>
            <label style={{ display: "grid", gap: ".25rem", fontWeight: 600 }}>{tx("Betalen")}
              <select value={months} onChange={(e) => setMonths(Number(e.target.value))}>{PERIODS.map(([m, l]) => <option key={m} value={m}>{tx(l)}</option>)}</select>
            </label>
            <div><button type="button" className="btn" disabled={busy === "host"} onClick={changeHosting}>{busy === "host" ? tx("Bezig…") : tx("Wijzigen")}</button></div>
            <small className="muted"><IconCheck /> {tx("De nieuwe prijs zie je eerst. Je gaat pas akkoord met een code.")}</small>
          </Card>
        )}
      </div>
    </div>
  );
}
