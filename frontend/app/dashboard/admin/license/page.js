// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import LicenseOverview from "../../../../components/LicenseOverview";

// The licence for administrators; reachable when the licence has run out (the website then shows the maintenance page to everybody else).
export default function License() {
  return <LicenseOverview />;
}
