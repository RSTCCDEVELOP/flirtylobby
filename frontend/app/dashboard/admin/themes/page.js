import { redirect } from "next/navigation";

// moved: everything about the look of the website is on one page now
export default function Moved() {
  redirect("/dashboard/admin/theme?tab=packs");
}
