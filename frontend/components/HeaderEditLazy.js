// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import dynamic from "next/dynamic";
import { useSession } from "./Session";

const HeaderEdit = dynamic(() => import("./HeaderEdit"), { ssr: false });

// The edit panel of the header: its code (about 35 KB) is only loaded when somebody is in edit mode, so visitors never download it.
export default function HeaderEditLazy() {
  const { editing } = useSession();
  return editing ? <HeaderEdit /> : null;
}
