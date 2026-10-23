// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { Busy } from "../../../../components/PageLoader";
import { useEffect, useState } from "react";
import ProfileView from "../../../leden/[slug]/ProfileView";
import { tx } from "../../../../lib/t";
import { api } from "../../../../lib/api";

// Your own profile page the way others see it, inside the dashboard (menu, header and footer stay).
export default function MyPage() {
  const [slug, setSlug] = useState(null);
  useEffect(() => { api("/profile/me/").then((d) => setSlug(d.slug)).catch(() => setSlug("")); }, []);
  if (slug === null) return <Busy />;
  if (!slug) return <p className="muted">{tx("Je hebt nog geen profielpagina.")}</p>;
  return <ProfileView slug={slug} initial={null} embedded />;
}
