"use client";

import { useEffect, useState } from "react";
import ProfileView from "../../../leden/[slug]/ProfileView";
import { tx } from "../../../../lib/t";
import { api } from "../../../../lib/api";

// Your own profile page the way others see it, inside the dashboard (menu, header and footer stay).
export default function MyPage() {
  const [slug, setSlug] = useState(null);
  useEffect(() => { api("/profile/me/").then((d) => setSlug(d.slug)).catch(() => setSlug("")); }, []);
  if (slug === null) return <p className="muted">{tx("Laden…")}</p>;
  if (!slug) return <p className="muted">{tx("Je hebt nog geen profielpagina.")}</p>;
  return <ProfileView slug={slug} initial={null} embedded />;
}
