import { requirePage } from "../../lib/pages-server";
import Members from "./Members";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requirePage("members");
  return <Members />;
}
