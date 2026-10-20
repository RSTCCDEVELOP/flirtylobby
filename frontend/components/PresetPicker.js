"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorText } from "../lib/api";
import { confirmDialog } from "../lib/dialog";
import { tx } from "../lib/t";

// Standard installations: a kind of business with its modules, plugins and community theme. One click switches everything (Super admin).
export function usePresets() {
  const [list, setList] = useState(null);
  useEffect(() => { api("/system/presets/").then(setList).catch(() => setList([])); }, []);
  return list;
}

export default function PresetPicker() {
  const list = usePresets();
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  const [open, setOpen] = useState("");
  if (!list) return null;
  const apply = async (p) => {
    if (!(await confirmDialog(tx("De installatie \"{0}\" instellen? Alle modules, plugins en het community-thema worden zoals bij deze installatie aan of uit gezet. Je gegevens blijven bestaan.", p.name), { okLabel: tx("Instellen"), cancelLabel: tx("Annuleren") }))) return;
    setBusy(p.key); setMsg(null);
    try {
      const r = await api(`/system/presets/${p.key}/apply/`, { method: "POST", body: {} });
      setMsg({ ok: true, text: tx("{0} is ingesteld: {1} modules en {2} plugins staan aan.", p.name, r.modules_on.length, r.plugins_on.length) + (r.plugins_missing.length ? ` ${tx("Niet geïnstalleerd:")} ${r.plugins_missing.join(", ")}.` : "") });
      router.refresh();
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
    setBusy("");
  };
  return (
    <div style={{ display: "grid", gap: ".7rem" }}>
      <p className="muted" style={{ margin: 0 }}>{tx("Kies een standaard installatie en alles wordt voor je ingesteld: welke modules en plugins aan staan en het thema van de community. Teksten, gebruikers en andere gegevens blijven zoals ze zijn.")}</p>
      {msg && <div className={msg.ok ? "alert ok" : "alert"}>{msg.text}</div>}
      <div className="preset-grid">
        {list.map((p) => (
          <div key={p.key} className="card preset-card">
            <div className="preset-head"><span className="preset-ico">{p.icon}</span><strong>{tx(p.name)}</strong></div>
            <p className="muted" style={{ margin: 0 }}>{tx(p.desc)}</p>
            <div className="chips">
              {p.plugins.map((x) => <span key={x.name} className={`badge ${x.installed ? "ok" : "off"}`} title={x.installed ? "" : tx("Niet geïnstalleerd")}>{x.title}</span>)}
              <span className="badge">{tx("{0} modules", p.modules.length)}</span>
              {p.theme !== "normal" && <span className="badge">{tx("Thema")}: {p.theme}</span>}
            </div>
            <button type="button" className="btn-link" onClick={() => setOpen(open === p.key ? "" : p.key)}>{open === p.key ? tx("Verberg modules") : tx("Toon modules")}</button>
            {open === p.key && <small className="muted">{p.modules.map((m) => tx(m)).join(", ")}</small>}
            <button type="button" className="btn primary" disabled={!!busy} onClick={() => apply(p)}>{busy === p.key ? tx("Bezig…") : tx("Deze installatie instellen")}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
