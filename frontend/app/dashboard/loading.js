"use client";

import { Busy } from "../../components/PageLoader";

// Shown at once while the next dashboard page loads: the loader of the settings (Thema → Laden)
export default function Loading() {
  return <Busy />;
}
