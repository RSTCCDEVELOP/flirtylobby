// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect } from "react";

// A system page (404, no access ...) marks itself: it is never a place to come back to after logging in (see PrefsSync and lib/levelHome.js).
export default function SystemPageMark() {
  useEffect(() => {
    document.documentElement.dataset.sysPage = "1";
    return () => { delete document.documentElement.dataset.sysPage; };
  }, []);
  return null;
}
