import { getBuildId } from "../../lib/version-server";

export const dynamic = "force-dynamic";

// The visitor's browser asks this once in a while: is there a newer version of the website than the one it loaded?
export async function GET() {
  return Response.json({ id: getBuildId() }, { headers: { "Cache-Control": "no-store" } });
}
