"use client";

import Link from "next/link";
import AdminTiles from "../../../components/AdminTiles";
import Collapsible from "../../../components/Collapsible";

export default function SuperAdminHome() {
  return (
    <>
      <h1>Super admin</h1>
      <p className="muted">Alles op één plek, inclusief het aan- en uitzetten van modules en wie ze mag gebruiken.</p>
      <Collapsible id="super-system" title="Systeem">
        <div className="cards" style={{ marginTop: 0 }}>
          <Link href="/dashboard/superadmin/modules" className="card stat link-card">
            <span>Modules</span>
            <strong style={{ fontSize: "1.25rem" }}>Aan en uit zetten</strong>
            <small>En bepaal wie ze mag gebruiken</small>
          </Link>
        </div>
      </Collapsible>
      <Collapsible id="super-all" title="Alle beheeronderdelen">
        <AdminTiles all />
      </Collapsible>
    </>
  );
}
