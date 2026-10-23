// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

"use client";

import { setRefreshSeconds, setSignalSeconds } from "../lib/refresh";

// Gives the refresh rate of the site settings to the parts that ask the server regularly (set while rendering, so it is known before they start).
export default function RefreshConfig({ seconds, signals }) {
  setRefreshSeconds(seconds);
  setSignalSeconds(signals);
  return null;
}
