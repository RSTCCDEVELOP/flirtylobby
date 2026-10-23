// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { tx } from "../lib/t";
import { useState } from "react";

export default function HealthButton() {
  const [result, setResult] = useState(null);

  async function check() {
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    try {
      const res = await fetch(`${base}/api/health/`);
      setResult(await res.json());
    } catch (err) {
      console.error("Client health check failed:", err);
      setResult({ status: "unreachable" });
    }
  }

  return (
    <div>
      <button onClick={check}>{tx("Check API")}</button>
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}
