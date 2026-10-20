"use client";

import { tx } from "../../lib/t";
import { useModule } from "../../components/Modules";
import MembersPage from "../../components/MembersPage";
import SiteHeader from "../../components/SiteHeader";

export default function Members() {
  const on = useModule("profiles");
  return (
    <div className="site">
      <SiteHeader />
      <main className="shop">
        {on && <h1>{tx("Leden")}</h1>}
        <MembersPage />
      </main>
    </div>
  );
}
