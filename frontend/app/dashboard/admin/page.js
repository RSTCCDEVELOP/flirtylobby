"use client";

import { tx } from "../../../lib/t";
import AdminTiles from "../../../components/AdminTiles";
import Collapsible from "../../../components/Collapsible";

// Admin dashboard: only the modules this user has access to (with their access level)
export default function AdminHome() {
  return (
    <>
      <h1>{tx("Admin")}</h1>
      <p className="muted">{tx("Alleen de onderdelen waar jij toegang toe hebt. Het niveau (gebruik, bewerken of beheer) staat op de tegel.")}</p>
      <Collapsible id="admin-overview" title={tx("Mijn beheeronderdelen")}>
        <AdminTiles />
      </Collapsible>
    </>
  );
}
