import { notFound } from "next/navigation";
import { getModules } from "./modules-server";

export async function shopGet(path) {
  try {
    const res = await fetch(`${process.env.API_URL_INTERNAL || "http://localhost:8000"}/api${path}`, { cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// 404 when the module is switched off
export async function requireModule(key) {
  if ((await getModules())[key] === false) notFound();
}
