import { requirePage } from "../../lib/pages-server";
import Register from "./Register";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requirePage("register");
  return <Register />;
}
