// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

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
