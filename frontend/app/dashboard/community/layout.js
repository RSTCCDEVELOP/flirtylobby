"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useModules } from "../../../components/Modules";

// The user pages of a community module only exist while that module is on (Super admin -> Modules)
const NEEDS = { profile: "profiles", blocked: "profiles", requests: "profiles", discover: "discover", messages: "messages", chat: "chat", direct: "chat" };

export default function CommunityLayout({ children }) {
  const mods = useModules();
  const path = usePathname();
  const router = useRouter();
  const needed = NEEDS[path.split("/")[3]];
  const off = needed && mods[needed] === false;
  const none = !path.split("/")[3] && ["profiles", "discover", "messages", "chat"].every((m) => mods[m] === false);
  useEffect(() => { if (off) router.replace("/dashboard/community"); }, [off, router]);
  if (none) return <p className="muted">Er zijn geen community-onderdelen ingeschakeld.</p>;
  return off ? null : children;
}
