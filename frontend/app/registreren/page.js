// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

import { requirePage } from "../../lib/pages-server";
import Register from "./Register";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requirePage("register");
  return <Register />;
}
