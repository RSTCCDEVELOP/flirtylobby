// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import dynamic from "next/dynamic";
import { useSession } from "./Session";

// The tools of the root layout that most visitors never use are loaded when they are needed, not in the first bundle:
// the editing tools only in edit mode; the licence prompt, the device preview and the speed test after the first paint.
const AiImprove = dynamic(() => import("./AiImprove"), { ssr: false });
const EditHelp = dynamic(() => import("./EditHelp"), { ssr: false });
const SavePresetButton = dynamic(() => import("./SavePresetButton"), { ssr: false });
const LicensePrompt = dynamic(() => import("./LicensePrompt"), { ssr: false });
const DevicePreview = dynamic(() => import("./DevicePreview"), { ssr: false });
const SpeedTestHost = dynamic(() => import("./SpeedTest").then((m) => m.SpeedTestHost), { ssr: false });

export function EditTools() {
  const { editing } = useSession();
  return editing ? <><EditHelp /><AiImprove /><SavePresetButton /></> : null;
}
export { LicensePrompt as LazyLicensePrompt, DevicePreview as LazyDevicePreview, SpeedTestHost as LazySpeedTestHost };
