"use client";

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
      <button onClick={check}>Check API</button>
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}
