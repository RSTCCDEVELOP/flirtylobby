// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

import { Suspense } from "react";
import ForbiddenView from "../../components/ForbiddenView";

export const metadata = { title: "Content niet beschikbaar", robots: "noindex, nofollow" };

// Always there (Admin -> Pagina's -> Content niet beschikbaar): shown for a protected address when the visitor has no access.
export default function ForbiddenPage() {
  return <Suspense fallback={null}><ForbiddenView /></Suspense>;
}
