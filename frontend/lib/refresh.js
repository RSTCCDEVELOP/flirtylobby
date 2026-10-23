// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

// How often the pages ask the server for news (messages, notifications, chat ...). Set by the administrator (Admin -> Systeem -> Vernieuwen, in seconds):
// 0 = every part keeps its own pace. Real-time parts (a video call) are not changed.
let seconds = 0;
export const setRefreshSeconds = (n) => { const v = Number(n); seconds = Number.isFinite(v) && v > 0 ? Math.max(2, Math.min(600, v)) : 0; };
export const refreshMs = (own) => (seconds ? seconds * 1000 : own);

// the call signals (/chat/signals/: who is calling me): fast by default so a call starts quickly; the administrator can slow it down (seconds, 0 = the default)
let signalSeconds = 0;
export const setSignalSeconds = (n) => { const v = Number(n); signalSeconds = Number.isFinite(v) && v > 0 ? Math.max(1, Math.min(30, v)) : 0; };
export const signalMs = (own) => (signalSeconds ? signalSeconds * 1000 : own);
