// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useFaqSettings } from "../../../lib/faq-settings";
import UserFaq from "../../../components/UserFaq";

// The FAQ of the website as a private page (behind the login): when Admin → FAQ → Instellingen puts the page on private
export default function DashFaq() {
  const fs = useFaqSettings();
  if (fs.page_scope !== "private") return <p className="muted">De FAQ is publiek: <a href="/faq">/faq</a></p>;
  return <UserFaq />;
}
