// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

import fs from "node:fs";
import path from "node:path";

// Identifier of the running build: APP_VERSION (e.g. a git commit, set at deploy time) or the id Next.js writes at build time.
// In development there is none ("dev"), so no "new version" notice is ever shown while developing.
export function getBuildId() {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  try {
    const dir = process.env.NEXT_DIST_DIR || ".next";
    return fs.readFileSync(path.join(process.cwd(), dir, "BUILD_ID"), "utf8").trim();
  } catch {
    return "dev";
  }
}
