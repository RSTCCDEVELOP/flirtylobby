"use client";

import { tx } from "../../../../lib/t";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../../components/AuthContext";
import SysButton from "../../../../components/SysButton";
import ViewBar from "../../../../components/ViewBar";
import { api, errorText } from "../../../../lib/api";
import { useView } from "../../../../lib/useView";
import { lvl } from "../../../../lib/perms";

const PAGE_PATH = (k) => (k === "home" ? "/" : `/p/${k}`);

// Overview of everything that can be put on a page in edit mode. Items appear here when their own screen has the "Systeemobject" tick.
export default function SysObjectsAdmin() {
  const { user } = useAuth();
  const L = lvl(user, "sysobjects");
  const [items, setItems] = useState(null);
  const [msg, setMsg] = useState(null);
  const view = useView("sysobjects");
  const load = useCallback(() => api("/sysobjects/admin/").then(setItems).catch((e) => setMsg({ ok: false, text: errorText(e) })), []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (o) => {
    try { await api(`/sysobjects/admin/${o.id}/`, { method: "PATCH", body: { enabled: !o.enabled } }); load(); }
    catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  };

  if (!items) return msg ? <div className="alert">{msg.text}</div> : <p className="muted">{tx("Laden…")}</p>;
  const lang = (() => { try { return localStorage.getItem("lang") || "nl"; } catch { return "nl"; } })();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{tx("Systeemobjecten")}</h1>
          <p className="muted" style={{ margin: 0 }}>{tx("Onderdelen van andere modules die je in bewerkmodus op een pagina kunt zetten, via de knop Systeemobject in de uitgebreide tekstbewerker. Een object komt hier vanzelf bij als je bij een donatie-actie of abonnement het vinkje Systeemobject aanzet.")}</p>
        </div>
      </div>
      {msg && <div className={msg.ok ? "alert ok" : "alert"} style={{ marginBottom: "1rem" }}>{msg.text}</div>}
      <ViewBar view={view} count={`${items.length}`} placeholder={tx("Zoek een object…")} />
      <div className={`sub-plans${view.cls}`}>
        {items.filter((o) => view.match(o.slug, o.kind_label, Object.values(o.names || {}).join(" "))).map((o) => {
          const name = o.names?.[lang] || o.names?.nl || Object.values(o.names || {})[0] || o.data?.name || o.slug;
          return (
            <div className={`card sub-plan${o.enabled ? "" : " off"}`} key={o.id}>
              <div className="sub-plan-top"><strong>{name}</strong><span className="badge ok">{tx(o.kind_label)}</span>{!o.enabled && <span className="badge off">{tx("Uit")}</span>}</div>
              <code style={{ fontSize: ".75rem" }}>{o.slug}</code>
              {o.kind === "donation" && o.button?.as_button && (
                <div className="sys-demo"><SysButton button={o.button} label={o.button.labels?.[lang] || o.button.labels?.nl || Object.values(o.button.labels || {})[0] || tx("Doneer")} onClick={() => {}} /></div>
              )}
              <div className="muted" style={{ fontSize: ".85rem" }}>
                {o.used_on.length ? <>{tx("Staat op")}: {o.used_on.map((k, i) => <span key={k}>{i ? ", " : ""}<Link href={PAGE_PATH(k)}>{k === "home" ? tx("Homepage") : k}</Link></span>)}</> : tx("Staat nog op geen enkele pagina.")}
              </div>
              <div className="sub-actions">
                <Link className="btn sm" href={o.edit_url}>{tx("Bewerken")}</Link>
                {L >= 2 && <button className="btn sm" onClick={() => toggle(o)}>{o.enabled ? tx("Uitzetten") : tx("Aanzetten")}</button>}
              </div>
            </div>
          );
        })}
        {!items.length && <p className="muted">{tx("Nog geen systeemobjecten. Zet bij een donatie-actie of abonnement het vinkje Systeemobject aan.")}</p>}
      </div>
    </>
  );
}
