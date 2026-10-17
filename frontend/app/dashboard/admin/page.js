"use client";

import { tx } from "../../../lib/t";
import { useEffect, useState } from "react";
import { useAuth } from "../../../components/AuthContext";
import { api } from "../../../lib/api";
import { lvl } from "../../../lib/perms";
import AdminTiles from "../../../components/AdminTiles";
import Collapsible from "../../../components/Collapsible";

// Admin dashboard: only the modules this user has access to (with their access level)
export default function AdminHome() {
  const { user } = useAuth();
  const canSet = lvl(user, "system") >= 3;
  const [credit, setCredit] = useState(null); // show "© Easy2edit <year>" at the bottom of every page
  useEffect(() => { if (canSet) api("/system/").then((d) => setCredit(d.settings.show_credit !== false)).catch(() => {}); }, [canSet]);
  async function toggle(on) {
    setCredit(on);
    try { await api("/system/", { method: "PUT", body: { show_credit: on } }); window.location.reload(); } catch { setCredit(!on); }
  }
  return (
    <>
      <h1>{tx("Admin")}</h1>
      <p className="muted">{tx("Alleen de onderdelen waar jij toegang toe hebt. Het niveau (gebruik, bewerken of beheer) staat op de tegel.")}</p>
      <Collapsible id="admin-overview" title={tx("Mijn beheeronderdelen")}>
        <AdminTiles />
      </Collapsible>

      <Collapsible id="admin-about" title={tx("Over Easy2edit")}>
        <div className="stack-sm" style={{ maxWidth: 760 }}>
          <p style={{ margin: 0 }}><strong>{tx("Easy2edit is een eenvoudig, modulair beheersysteem voor portals en data.")}</strong></p>
          <p style={{ margin: 0 }}>{tx("Je bouwt je website of portal uit blokken die je zelf aan- en uitzet: gebruikers en rollen, pagina's en menu, community, abonnementen, SEO en meer. Wat je niet nodig hebt, staat uit en komt niet in beeld.")}</p>
          <ul style={{ margin: 0, paddingLeft: "1.2rem", display: "grid", gap: ".3rem" }}>
            <li>{tx("Modulair: zet onderdelen aan of uit en geef elk onderdeel zijn eigen rechten.")}</li>
            <li>{tx("Thema's: de hele uitstraling, met logo's en e-mails, wissel je met één klik via themapakketten.")}</li>
            <li>{tx("Plugins: breid het systeem uit met ondertekende plugins, zoals de webshop of de marktplaats.")}</li>
            <li>{tx("Eenvoudig bewerken: pas teksten, afbeeldingen en pagina's direct op de website aan.")}</li>
            <li>{tx("Alles in een back-up: instellingen, thema's en plugins exporteer en importeer je in één bestand.")}</li>
          </ul>
          {credit !== null && (
            <label className="check sec-toggle" style={{ marginTop: ".6rem" }}>
              <span className="switch"><input type="checkbox" checked={credit} onChange={(e) => toggle(e.target.checked)} /><span /></span>
              <span>{tx("Easy2edit-vermelding onderaan elke pagina tonen")} <small className="muted">{tx("© Easy2edit {0} met een link naar easy2edit.com.", new Date().getFullYear())}</small></span>
            </label>
          )}
          <p style={{ margin: 0 }}>{tx("Meer informatie:")} <a href="https://easy2edit.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--blue)", fontWeight: 600 }}>easy2edit.com</a></p>
        </div>
      </Collapsible>
    </>
  );
}
