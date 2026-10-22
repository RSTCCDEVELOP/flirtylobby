import { apiBase } from "./api";

// Tell the statistics what a visitor chose in a pop-up (no personal data). Never throws.
export function statEvent(module, event) {
  try {
    fetch(`${apiBase()}/api/stats/event/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ module, event }), keepalive: true }).catch(() => {});
  } catch {}
}
