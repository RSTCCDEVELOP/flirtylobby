// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { ResourceAdmin } from "../../../components/ResourceLibrary";
import { tx } from "../../../lib/t";
import Link from "next/link";
import { alertDialog } from "../../../lib/dialog";
import { useEcologiOn } from "../../../lib/ecologi";
import { IconTree, IconBolt, IconGlobe, IconGlobe2, IconGrid, IconReceipt, IconRefresh, IconRocket, IconSliders } from "../../../components/Icons";
import PlusLock from "../../../components/PlusLock";
import SuperTile from "../../../components/SuperTile";
import { useAuth } from "../../../components/AuthContext";
import AdminTiles from "../../../components/AdminTiles";
import EcologiBlock from "../../../components/EcologiBlock";
import Collapsible from "../../../components/Collapsible";
import LicenseAdmin from "../../../components/LicenseAdmin";
import GlobalSettings from "../../../components/GlobalSettings";
import ResellerManagement from "../../../components/ResellerManagement";
import SaveDefaults from "../../../components/SaveDefaults";
import PresetPicker from "../../../components/PresetPicker";
import ProfileThemeSwitches from "../../../components/ProfileThemeSwitches";
import SettingsBackup from "../../../components/SettingsBackup";
import TermsAdmin from "../../../components/TermsAdmin";
import SystemReset from "../../../components/SystemReset";
import StandardAdmin from "../../../components/StandardAdmin";

export default function SuperAdminHome() {
  const { user } = useAuth();
  const ecoOn = useEcologiOn();  // the Ecologi tile is only there while the API (Admin → API keys → Ecologi) is on
  const plus = !!user?.is_superadmin_plus;  // superadmin+: the price list, the site manager and the data of the easy2edit server
  const deny = (e) => { if (!plus) { e.preventDefault(); alertDialog(tx("Dit onderdeel is alleen voor een superadmin+.")); } };
  return (
    <>
      <h1>{tx("Super admin")}</h1>
      <p className="muted">{tx("Alles op één plek, inclusief het aan- en uitzetten van modules en wie ze mag gebruiken.")}</p>
      <Collapsible id="super-system" title={tx("Systeem")}>
        <div className="cards" style={{ marginTop: 0 }}>
          <SuperTile href="/dashboard/superadmin/modules" icon={IconGrid} label={tx("Modules")} title={tx("Aan en uit zetten")} text={tx("En bepaal wie ze mag gebruiken")} />
          <SuperTile href="/dashboard/superadmin/vernieuwen" icon={IconRefresh} label={tx("Vernieuwen")} title={tx("Verversing en oproepsignalen")} text={tx("Hoe vaak de pagina's bij de server vragen (seconden)")} />
          <SuperTile href="/dashboard/superadmin/ai" icon={IconBolt} label={tx("AI")} title={tx("Gebruik, kosten en marge")} text={tx("Alle AI-verkeer per gebruiker, groep en onderdeel")} />
          <SuperTile href="/dashboard/superadmin/energy" icon={IconGlobe2} label={tx("Energie")} title={tx("Totaalbeeld van alle websites")} text={tx("Paginagewicht, verzoeken en uitstoot, verzameld via de API")} />
          <SuperTile href="/dashboard/superadmin/energy-instellingen" icon={IconSliders} label={tx("Green metingen")} title={tx("Instellingen voor energie en uitstoot")} text={tx("Rekenmodel, te meten pagina's, bewaartijd en API")} />
          {ecoOn && <SuperTile href="/dashboard/superadmin/ecologi" icon={IconTree} label={tx("easy2edit")} title={tx("Bomen planten")} text={tx("Plant bomen met easy2edit en bekijk de gevolgen")} />}
          <SuperTile href="/dashboard/superadmin/wizard" icon={IconRocket} label={tx("Installatie")} title={tx("Wizard: installatie en licentie")} text={tx("Naam, vragen, modules, plugins en prijs")} />
          <SuperTile href="/dashboard/superadmin/prijzen" icon={IconReceipt} label={tx("Prijzen")} title={tx("Prijslijst bewerken")} text={tx("Per maand, kwartaal en jaar, ex btw")} lock onClick={deny} />
          <SuperTile href="/dashboard/superadmin/sites" icon={IconGlobe} label={tx("Site manager")} title={tx("Alle easy2edit-websites")} text={tx("Adressen, IP-adressen en inlogs van beheerders")} lock onClick={deny} />
          <GlobalSettings />
          <ResellerManagement />
          <SaveDefaults />
        </div>
      </Collapsible>
      <EcologiBlock />
      <Collapsible id="super-resource" title={tx("Bibliotheek: plugins, thema's en talen")}>
        <ResourceAdmin />
      </Collapsible>
      <div onClickCapture={plus ? undefined : (e) => { e.preventDefault(); e.stopPropagation(); alertDialog(tx("Dit onderdeel is alleen voor een superadmin+.")); }}>
        <Collapsible id="super-license" title={<>{tx("Licentie")}<PlusLock /></>}>
          {plus && <LicenseAdmin />}
        </Collapsible>
      </div>
      <Collapsible id="super-themes" title={tx("Profielthema's (community)")}>
        <ProfileThemeSwitches />
      </Collapsible>
      <Collapsible id="super-terms" title={tx("Algemene voorwaarden")}>
        <TermsAdmin />
      </Collapsible>
      <Collapsible id="super-backup" title={tx("Instellingen back-up")}>
        <SettingsBackup />
      </Collapsible>
      <Collapsible id="super-presets" title={tx("Standaard installaties")}>
        <PresetPicker manage />
      </Collapsible>
      <Collapsible id="super-all" title={tx("Alle beheeronderdelen")}>
        <AdminTiles all />
      </Collapsible>
      <Collapsible id="super-reset" title={tx("Systeem resetten")}>
        <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap", alignItems: "flex-start" }}><SystemReset /><StandardAdmin /></div>
      </Collapsible>
    </>
  );
}
