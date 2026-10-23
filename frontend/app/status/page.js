// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

import { tx } from "../../lib/t";
import HealthButton from "../../components/HealthButton";

// Render on every request so SSR really hits the API
export const dynamic = "force-dynamic";

async function getHealth() {
  const base = process.env.API_URL_INTERNAL || "http://localhost:8000";
  try {
    const res = await fetch(`${base}/api/health/`, { cache: "no-store" });
    return await res.json();
  } catch (err) {
    console.error("SSR health check failed:", err.message);
    return { status: "unreachable" };
  }
}

export default async function Home() {
  const health = await getHealth();
  return (
    <main>
      <h1>{tx("Easy2edit")}</h1>
      <h2>{tx("Server-side (SSR)")}</h2>
      <pre>{JSON.stringify(health, null, 2)}</pre>
      <h2>{tx("Client-side (browser)")}</h2>
      <HealthButton />
    </main>
  );
}
