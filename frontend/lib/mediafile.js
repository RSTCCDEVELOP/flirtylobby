// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

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
