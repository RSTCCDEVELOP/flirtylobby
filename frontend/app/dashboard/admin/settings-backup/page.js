// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../../../../lib/t";
import SettingsBackup from "../../../../components/SettingsBackup";

// Admin > System > Settings backup: export all settings to one file and load such a file again. Always available (it does not depend on a module).
export default function SettingsBackupPage() {
  return (
    <div>
      <h1>{tx("Instellingen back-up")}</h1>
      <p className="muted">{tx("Bewaar alle instellingen in één bestand en laad dat bestand later weer in.")}</p>
      <SettingsBackup />
    </div>
  );
}
