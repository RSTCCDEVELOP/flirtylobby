import { apiBase, getToken } from "./api";

// A picture from the media library as a File, so every upload screen can use it like a file from the computer.
export async function mediaToFile(item) {
  const res = await fetch(`${apiBase()}/api/media/${item.id}/file/`, { headers: { Authorization: `Token ${getToken()}` } });
  if (!res.ok) throw new Error("Het bestand uit de mediabibliotheek kon niet worden opgehaald.");
  const blob = await res.blob();
  const ext = (blob.type.split("/")[1] || "png").replace("jpeg", "jpg").replace("x-icon", "ico");
  const name = /\.[a-z0-9]{2,4}$/i.test(item.name || "") ? item.name : `${(item.name || "afbeelding").replace(/\.[^.]+$/, "")}.${ext}`;
  return new File([blob], name, { type: blob.type });
}
