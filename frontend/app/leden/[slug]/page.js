// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

import { tx } from "../../../lib/t";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { absoluteUrl } from "../../../lib/seo";
import { requireModule, shopGet } from "../../../lib/shop-server";
import ProfileView from "./ProfileView";

export const dynamic = "force-dynamic";

// Anonymous fetch: only profiles that are public show up here (and may be indexed). The rest is loaded in the browser with the member's login.
async function anonymous(slug) {
  const lang = ((await headers()).get("accept-language") || "").slice(0, 2);
  return shopGet(`/profiles/${slug}/${lang ? `?lang=${lang}` : ""}`);
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const p = await anonymous(slug);
  if (!p) return { title: tx("Profiel"), robots: "noindex, nofollow" };
  return {
    title: p.name, description: p.headline || undefined,
    robots: p.indexable ? undefined : "noindex, nofollow",
    openGraph: { title: p.name, description: p.headline || undefined, images: p.photos[0] ? [absoluteUrl(p.photos[0].url)] : undefined },
  };
}

export default async function ProfilePage({ params }) {
  await requireModule("profiles");
  const { slug } = await params;
  const p = await anonymous(slug);
  return <ProfileView slug={slug} initial={p} />;
}
