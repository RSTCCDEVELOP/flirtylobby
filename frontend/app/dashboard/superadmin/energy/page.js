// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { Suspense } from "react";
import EnergyGreen from "../../../../components/EnergyGreen";

// Super admin → Energie: totaalbeeld (opens the tab with the other websites)
export default function EnergyNetworkPage() {
  return <Suspense fallback={null}><EnergyGreen initial="sites" /></Suspense>;
}
