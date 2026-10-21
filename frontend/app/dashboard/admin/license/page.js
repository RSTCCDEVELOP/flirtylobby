"use client";

import LicenseOverview from "../../../../components/LicenseOverview";

// The licence for administrators; reachable when the licence has run out (the website then shows the maintenance page to everybody else).
export default function License() {
  return <LicenseOverview />;
}
