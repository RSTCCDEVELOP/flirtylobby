// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

import { getBuildId } from "../../lib/version-server";

export const dynamic = "force-dynamic";

// The visitor's browser asks this once in a while: is there a newer version of the website than the one it loaded?
export async function GET() {
  return Response.json({ id: getBuildId() }, { headers: { "Cache-Control": "no-store" } });
}
