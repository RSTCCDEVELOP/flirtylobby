"use client";

import { tx } from "../../../lib/t";
import Link from "next/link";
import AdminTiles from "../../../components/AdminTiles";
import Collapsible from "../../../components/Collapsible";
import LicenseAdmin from "../../../components/LicenseAdmin";
import SaveDefaults from "../../../components/SaveDefaults";
import PresetPicker from "../../../components/PresetPicker";
import ProfileThemeSwitches from "../../../components/ProfileThemeSwitches";
import SettingsBackup from "../../../components/SettingsBackup";
import SystemReset from "../../../components/SystemReset";

export default function SuperAdminHome() {
  return (
    <>
      <h1>{tx("Super admin")}</h1>
      <p className="muted">{tx("Alles op één plek, inclusief het aan- en uitzetten van modules en wie ze mag gebruiken.")}</p>
      <Collapsible id="super-system" title={tx("Systeem")}>
        <div className="cards" style={{ marginTop: 0 }}>
          <Link href="/dashboard/superadmin/modules" className="card stat link-card">
            <span>{tx("Modules")}</span>
            <strong style={{ fontSize: "1.25rem" }}>{tx("Aan en uit zetten")}</strong>
            <small>{tx("En bepaal wie ze mag gebruiken")}</small>
          </Link>
          <Link href="/dashboard/superadmin/vernieuwen" className="card stat link-card">
            <span>{tx("Vernieuwen")}</span>
            <strong style={{ fontSize: "1.25rem" }}>{tx("Verversing en oproepsignalen")}</strong>
            <small>{tx("Hoe vaak de pagina's bij de server vragen (seconden)")}</small>
          </Link>
          <Link href="/dashboard/superadmin/wizard" className="card stat link-card">
            <span>{tx("Installatie")}</span>
            <strong style={{ fontSize: "1.25rem" }}>{tx("Wizard: installatie en licentie")}</strong>
            <small>{tx("Naam, vragen, modules, plugins en prijs")}</small>
          </Link>
          <Link href="/dashboard/superadmin/prijzen" className="card stat link-card">
            <span>{tx("Prijzen")}</span>
            <strong style={{ fontSize: "1.25rem" }}>{tx("Prijslijst bewerken")}</strong>
            <small>{tx("Per maand, kwartaal en jaar, ex btw")}</small>
          </Link>
          <SaveDefaults />
        </div>
      </Collapsible>
      <Collapsible id="super-license" title={tx("Licentie")}>
        <LicenseAdmin />
      </Collapsible>
      <Collapsible id="super-themes" title={tx("Profielthema's (community)")}>
        <ProfileThemeSwitches />
      </Collapsible>
      <Collapsible id="super-backup" title={tx("Instellingen back-up")}>
        <SettingsBackup />
      </Collapsible>
      <Collapsible id="super-presets" title={tx("Standaard installaties")}>
        <PresetPicker manage />
      </Collapsible>
      <Collapsible id="super-reset" title={tx("Systeem resetten")}>
        <SystemReset />
      </Collapsible>
      <Collapsible id="super-all" title={tx("Alle beheeronderdelen")}>
        <AdminTiles all />
      </Collapsible>
    </>
  );
}
