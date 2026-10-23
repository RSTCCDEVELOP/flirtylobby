// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../../../../lib/t";
import { useEffect, useState } from "react";
import { IconFolder, IconLock } from "../../../../components/Icons";
import { api, errorText } from "../../../../lib/api";
import { confirmDialog } from "../../../../lib/dialog";
import { useAutoSave } from "../../../../lib/autosave";
import SaveStatus from "../../../../components/SaveStatus";

const HINT = {
  users: "Foto's, chatbestanden en alles wat leden uploaden. Per lid een eigen submap, zodat alles van één lid bij elkaar staat en bij verwijderen in één keer weg is.",
  site: "Bibliotheek, logo's, homepagina-foto's en geïmporteerde thema's. Leeg = in de hoofdmap.",
  other: "Alle overige bestanden.",
};

export default function StoragePage() {
  const [s, setS] = useState(null);
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState("");

  const load = (d) => { setS(d); setForm(Object.fromEntries(d.areas.map((a) => [a.key, { folder: a.folder, storage: a.storage, encrypt: a.encrypt }]))); };
  useEffect(() => { api("/storage/").then(load).catch((e) => setMsg({ ok: false, text: errorText(e) })); }, []);
  const set = (k, patch) => setForm({ ...form, [k]: { ...form[k], ...patch } });

  async function run(label, fn) {
    setBusy(label); setMsg(null);
    try { await fn(); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy("");
  }
  const save = async () => { try { load(await api("/storage/", { method: "PUT", body: { areas: form } })); setMsg(null); } catch (e) { setMsg({ ok: false, text: errorText(e) }); return false; } };
  const auto = useAutoSave(form, save, { ready: !!s, delay: 1500 }); // saves by itself, no Save button
  const apply = () => run("apply", async () => {
    if (!(await confirmDialog(tx("Alle bestaande bestanden aanpassen aan deze instellingen (versleutelen, ontsleutelen, verplaatsen)? Dit kan even duren."), {}))) return;
    const r = await api("/storage/apply/", { method: "POST" });
    load(r);
    setMsg(r.failed.length ? { ok: false, text: `${r.changed} ${tx("aangepast")}, ${r.failed.length} ${tx("mislukt")}: ${r.failed.map((f) => f.key).join(", ")}` } : { ok: true, text: `${r.changed} ${tx("bestanden aangepast.")}` });
  });

  if (!s) return <p className="muted">{msg?.text || tx("Laden…")}</p>;
  const label = { users: "Gebruikers", site: "Website", other: "Overig" };
  return (
    <>
      <div className="page-head"><h1>{tx("Mappenstructuur")}</h1></div>
      <p className="muted">{tx("Bepaal per onderdeel in welke map bestanden komen, of ze lokaal of op S3 staan en of ze versleuteld worden.")}</p>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}
      <div className="st-areas">
        {s.areas.map((a) => {
          const f = form[a.key] || {};
          return (
            <div className="card st-area" key={a.key}>
              <h3><IconFolder /> {tx(label[a.key])} <span className="st-stats">{a.files} {tx("bestanden")} · {a.encrypted} {tx("versleuteld")} · {a.s3} S3</span></h3>
              <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>{tx(HINT[a.key])}</p>
              <div className="st-row">
                <label>{tx("Map")}<input value={f.folder ?? ""} onChange={(e) => set(a.key, { folder: e.target.value })} placeholder={a.key === "users" ? "users" : tx("(hoofdmap)")} /></label>
                <label>{tx("Opslag")}
                  <select value={f.storage} onChange={(e) => set(a.key, { storage: e.target.value })}>
                    <option value="local">{tx("Lokaal")}</option>
                    <option value="s3" disabled={!s.s3_available}>S3{s.s3_available ? "" : ` (${tx("niet gekoppeld")})`}</option>
                  </select>
                </label>
                <label className="check"><input type="checkbox" checked={!!f.encrypt} onChange={(e) => set(a.key, { encrypt: e.target.checked })} /> {tx("Versleutelen")}</label>
              </div>
              <div className="st-path">{a.key === "users" ? `${f.folder || "users"}/42/photos/…` : a.key === "site" ? `${f.folder ? f.folder + "/" : ""}library/2026/05/…` : tx("overige bestanden")}</div>
            </div>
          );
        })}
      </div>
      <div className="row" style={{ marginTop: "1rem", display: "flex", gap: ".6rem", flexWrap: "wrap" }}>
        <SaveStatus auto={auto} />
        <button className="btn" disabled={!!busy} onClick={apply}>{tx("Bestaande bestanden aanpassen")}</button>
        <small className="muted" style={{ flexBasis: "100%" }}>{tx("Nieuwe bestanden volgen deze instellingen; bestaande bestanden pas je met de knop aan.")}</small>
      </div>
      <div className="card" style={{ marginTop: "1.25rem" }}>
        <h3 style={{ margin: 0, display: "flex", gap: ".5rem", alignItems: "center" }}><IconLock /> {tx("Hoe de versleuteling werkt")}</h3>
        <ul className="muted" style={{ fontSize: ".88rem", paddingLeft: "1.1rem" }}>
          <li>{tx("Elk lid krijgt een eigen willekeurige sleutel (AES-256-GCM). Bestanden van verschillende leden zijn dus met verschillende sleutels versleuteld.")}</li>
          <li>{tx("Die sleutels staan zelf versleuteld in de database, met een hoofdsleutel uit de omgeving (FILE_ENCRYPTION_KEY).")} <strong>{s.master === "environment" ? tx("Nu: hoofdsleutel uit de omgeving.") : s.master === "database" ? tx("Nu: hoofdsleutel uit API keys (S3).") : tx("Nu: afgeleid van SECRET_KEY. Zet FILE_ENCRYPTION_KEY voor productie.")}</strong></li>
          <li>{tx("Website- en overige bestanden delen één sleutel per onderdeel.")}</li>
          <li>{tx("Bestanden worden bij het tonen ontsleuteld via een tijdelijke, ondertekende link.")}</li>
          <li>{tx("Verwijdert een lid zijn account, dan gaan bestanden, gegevens, groepen en rechten weg én de sleutel: ook een eventuele back-up is dan onleesbaar.")}</li>
          <li>{tx("Bewaar de hoofdsleutel goed: zonder die sleutel zijn versleutelde bestanden niet meer te openen.")} ({s.keys} {tx("sleutels in gebruik")})</li>
        </ul>
      </div>
    </>
  );
}
