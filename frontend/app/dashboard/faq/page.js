"use client";

import { useFaqSettings } from "../../../lib/faq-settings";
import UserFaq from "../../../components/UserFaq";

// The FAQ of the website as a private page (behind the login): when Admin → FAQ → Instellingen puts the page on private
export default function DashFaq() {
  const fs = useFaqSettings();
  if (fs.page_scope !== "private") return <p className="muted">De FAQ is publiek: <a href="/faq">/faq</a></p>;
  return <UserFaq />;
}
