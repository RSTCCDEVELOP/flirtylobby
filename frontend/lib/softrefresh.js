// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

// Refresh what a page shows without loading the whole page again: the texts are asked again and every plugin frame reloads itself.
export const softRefresh = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event("soft-refresh")); };
