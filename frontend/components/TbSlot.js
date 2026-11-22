// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// The place in the top bar of the editor (EditorShell) where the tools go: save, undo, help and the list of blocks. Without the bar (no panel) they stay where they were: floating at the right.
export function useToolbarHost(id = "pb-tb-tools") {
  const [host, setHost] = useState(null);
  useEffect(() => {
    const find = () => setHost(document.getElementById(id));
    find();
    window.addEventListener("pb-bar-ready", find);
    return () => window.removeEventListener("pb-bar-ready", find);
  }, [id]);
  return host;
}

export default function TbSlot({ children, host: hostId = "pb-tb-tools" }) {
  const host = useToolbarHost(hostId);
  return host ? createPortal(children, host) : children;
}
