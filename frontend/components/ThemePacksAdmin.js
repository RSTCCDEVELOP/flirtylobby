"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import Collapsible from "./Collapsible";
import ThemePackEdit from "./ThemePackEdit";
import { api, apiBase, errorText, getToken } from "../lib/api";
import { confirmDialog, promptDialog } from "../lib/dialog";
import { lvl } from "../lib/perms";
import { tx } from "../lib/t";

// Theme packages: every theme besides the two house styles (RSTCC, Studio2) is a package in the themes folder; switched on = it shows in Vormgeving -> Thema's.
export default function ThemePacksAdmin() {
  const router = useRouter();
  const { user } = useAuth();
  const L = lvl(user, "theme");
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState(null);
  const input = useRef(null);
  const load = useCallback(() => api("/theme/packs/").then(setD).catch((e) => setMsg({ ok: false, text: errorText(e) })), []);
  useEffect(() => { load(); }, [load]);
  const set = (r) => setD((x) => ({ ...x, packs: r.packs }));

  async function toggle(p, on) {
    setMsg(null);
    try { set(await api(`/theme/packs/${p.key}/`, { method: "PATCH", body: { enabled: on } })); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  }
  async function remove(p) {
    if (!(await confirmDialog(tx("Themapakket {0} verwijderen? De map met het thema wordt gewist.", p.name), { title: tx("Themapakket verwijderen"), okLabel: tx("Verwijderen"), danger: true }))) return;
    try { set(await api(`/theme/packs/${p.key}/`, { method: "DELETE" })); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  }
  async function use(p) {
    const files = p.assets.length > 0 || p.home_count > 0;
    const withFiles = files && (await confirmDialog(tx("Het thema {0} heeft eigen logo's en afbeeldingen. Die worden nu ook ingesteld en vervangen de huidige logo's, favicon en homepagefoto's. Kies Annuleren om alleen de kleuren en vormen over te nemen.", p.name), { title: tx("Thema met logo's"), okLabel: tx("Logo's ook instellen") }));
    try { set(await api(`/theme/packs/${p.key}/use/`, { method: "POST", body: { files: withFiles } })); setMsg({ ok: true, text: tx("Het thema {0} is nu de vormgeving van de website.", p.name) }); router.refresh(); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  }
  async function download(p) {
    const res = await fetch(`${apiBase()}/api/theme/packs/${p.key}/download/`, { headers: { Authorization: `Token ${getToken()}` } });
    if (!res.ok) return setMsg({ ok: false, text: tx("Het pakket kon niet worden opgehaald.") });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await res.blob()); a.download = `theme-${p.key}.zip`; a.click();
  }
  async function upload(file) {
    if (!file) return;
    setBusy(true); setMsg(null);
    try {
      const fd = new FormData(); fd.append("file", file);
      set(await api("/theme/packs/upload/", { method: "POST", body: fd }));
      setMsg({ ok: true, text: tx("Themapakket geïnstalleerd. Zet het aan als je het wilt gebruiken.") });
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy(false);
  }
  async function create() {
    const name = await promptDialog(tx("Naam van het nieuwe thema"), "", { title: tx("Nieuw themapakket"), okLabel: tx("Maken") });
    if (!name) return;
    const cur = await confirmDialog(tx("De vormgeving, logo's, favicon en homepagefoto's van de website zoals ze nu zijn in het nieuwe pakket zetten? Kies Annuleren voor een leeg pakket."), { title: tx("Beginnen met de huidige website"), okLabel: tx("Ja, huidige website") });
    try { const r = await api("/theme/packs/create/", { method: "POST", body: { name, from_current: cur } }); set(r); setEdit(r.key); } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  }
  async function scan() { setBusy(true); await load(); setBusy(false); setMsg({ ok: true, text: tx("Map gescand.") }); }

  if (!d) return msg ? <div className="alert">{msg.text}</div> : <p className="muted">{tx("Laden…")}</p>;
  const packs = d.packs.filter((p) => !q || `${p.name} ${p.description}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <p className="muted" style={{ margin: "0 0 1rem" }}>{tx("Het systeem heeft zelf alleen RSTCC en Studio2. Alle andere thema's zijn pakketten in de themamap. Een pakket dat aan staat, kun je hier gebruiken voor de website; de logo's, het e-mailuiterlijk en de fijne instellingen pas je aan in de andere tabs.")}</p>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}

      {(
        <div>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: "1rem" }}>
            <input style={{ maxWidth: 300 }} placeholder={tx("Zoek een thema…")} value={q} onChange={(e) => setQ(e.target.value)} />
            {L >= 2 && <button className="btn primary" onClick={create}>{tx("+ Nieuw themapakket")}</button>}
          </div>
          <div className="preset-grid pack-grid">
            {packs.map((p) => (
              <div key={p.key} className={`preset pack ${p.active ? "active" : ""}`}>
                <span className="swatches">
                  <i style={{ background: p.colors.light_bg }} /><i style={{ background: p.colors.light_card, borderColor: p.colors.light_text }} />
                  <i style={{ background: p.colors.primary }} /><i style={{ background: p.colors.secondary }} />
                  <i style={{ background: p.colors.dark_card }} /><i style={{ background: p.colors.dark_bg }} />
                </span>
                <strong>{p.name} {p.builtin && <span className="badge ok" style={{ marginLeft: ".3rem" }}>{tx("Ingebouwd")}</span>}{p.active && <span className="badge ok" style={{ marginLeft: ".3rem" }}>{tx("In gebruik")}</span>}</strong>
                <small>{p.description}</small>
                {!p.builtin && <small className="muted">{p.assets.length || p.home_count ? tx("Met logo's en afbeeldingen: {0}", [...p.assets.map((a) => a.replace("_", " ")), p.home_count ? tx("{0} homepagefoto's", p.home_count) : null].filter(Boolean).join(", ")) : tx("Zonder logo's en afbeeldingen")}</small>}
                <small className="muted">{p.fonts[0]}{p.fonts[1] !== p.fonts[0] ? ` / ${p.fonts[1]}` : ""} · v{p.version}{["outdated", "incompatible", "newer"].includes(p.compat) ? ` · ⚠ ${tx("voor systeem")} ${p.built_for}` : ""}</small>
                <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
                  <label className="check sec-toggle"><span className="switch"><input type="checkbox" checked={p.enabled} disabled={p.builtin || L < 2} onChange={(e) => toggle(p, e.target.checked)} /><span /></span><span>{p.enabled ? tx("Aan") : tx("Uit")}</span></label>
                  <span className="row" style={{ gap: ".3rem", flexWrap: "nowrap" }}>
                    {L >= 2 && !p.active && <button className="btn sm primary" onClick={() => use(p)}>{tx("Gebruiken")}</button>}
                    {!p.builtin && L >= 2 && <button className="btn sm" onClick={() => setEdit(p.key)}>{tx("Bewerken")}</button>}
                    <button className="btn sm" onClick={() => download(p)}>{tx("Download")}</button>
                    {!p.builtin && L >= 3 && <button className="btn sm danger" onClick={() => remove(p)}>{tx("Verwijder")}</button>}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {!packs.length && <p className="muted">{tx("Geen thema's gevonden.")}</p>}
        </div>
      )}

      <Collapsible id="theme-pack-upload" title={tx("Pakket uploaden")}>
        <div>
          <p className="muted">{tx("Een themapakket is een zipbestand met één bestand: theme.json. Download een bestaand pakket als voorbeeld.")}</p>
          {L >= 2 ? (
            <div className={`dropzone ${over ? "over" : ""}`} role="button" tabIndex={0} onClick={() => input.current.click()} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current.click()}
              onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files[0]); }}>
              <span>{busy ? tx("Bezig…") : tx("Sleep een themapakket (.zip) hierheen of klik om te kiezen")}</span>
              <input ref={input} type="file" accept=".zip,application/zip" hidden onChange={(e) => { upload(e.target.files[0]); e.target.value = ""; }} />
            </div>
          ) : <p className="muted">{tx("Je hebt geen rechten om pakketten te uploaden.")}</p>}
        </div>
      </Collapsible>

      <Collapsible id="theme-pack-folder" title={tx("Themamap")}>
        <div className="stack-sm">
          <p>{tx("De themamap:")} <code>{d.folder}</code></p>
          <p className="muted">{tx("Elk thema is een map met een bestand theme.json (naam, omschrijving, versie en de instellingen van Vormgeving die het thema wijzigt). Zet een nieuwe map in de themamap en kies Map scannen.")}</p>
          <div><button className="btn" disabled={busy} onClick={scan}>{tx("Map scannen")}</button></div>
        </div>
      </Collapsible>
      {edit && d.packs.find((p) => p.key === edit) && <ThemePackEdit pack={d.packs.find((p) => p.key === edit)} onClose={() => setEdit(null)} onChanged={(packs) => setD((x) => ({ ...x, packs }))} />}
    </>
  );
}
