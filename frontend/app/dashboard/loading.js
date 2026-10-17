import { tx } from "../../lib/t";

// Shown at once while the next dashboard page loads (instead of a screen that seems to do nothing).
export default function Loading() {
  return <p className="muted" style={{ padding: "1rem 0" }}>{tx("Laden…")}</p>;
}
