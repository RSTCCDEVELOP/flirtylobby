"use client";

import { setRefreshSeconds, setSignalSeconds } from "../lib/refresh";

// Gives the refresh rate of the site settings to the parts that ask the server regularly (set while rendering, so it is known before they start).
export default function RefreshConfig({ seconds, signals }) {
  setRefreshSeconds(seconds);
  setSignalSeconds(signals);
  return null;
}
