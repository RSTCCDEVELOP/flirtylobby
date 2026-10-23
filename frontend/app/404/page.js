// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

import NotFoundView from "../../components/NotFoundView";

export const metadata = { title: "404", robots: "noindex, nofollow" };

// Same page as the automatic 404, reachable on purpose at /404 so it can be opened and edited from Admin -> Pagina's
export default function NotFoundPreview() {
  return <NotFoundView />;
}
