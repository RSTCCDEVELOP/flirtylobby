"use client";

import { useAuth } from "../../../../components/AuthContext";
import PresetPicker, { usePresets } from "../../../../components/PresetPicker";
import { lvl } from "../../../../lib/perms";
import { tx } from "../../../../lib/t";

// Standard installations for administrators: the superadmin chooses which ones are shown here (Super admin → Standaard installaties).
export default function InstallationsPage() {
  const { user } = useAuth();
  const list = usePresets(true);
  const allowed = user?.is_staff || lvl(user, "system") >= 3;
  return (
    <>
      <h1>{tx("Standaard installaties")}</h1>
      {!allowed ? <p className="muted">{tx("Je hebt hier geen rechten voor.")}</p>
        : list && !list.length ? <p className="muted">{tx("De superadmin heeft nog geen standaard installaties voor de admin vrijgegeven.")}</p>
        : <PresetPicker adminOnly demo={!!user?.is_staff} />}
    </>
  );
}
