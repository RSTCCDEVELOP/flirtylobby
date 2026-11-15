// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

// The step plan popup of Website ontwerpen ("how do I fill my website?") opens by itself on an empty installation and after a reset.
// markPlan(): a reset or a new installation asks for it (the next time Website ontwerpen opens); the popup puts "off" when it was closed, so it does not keep coming back.
export const markPlan = () => { try { localStorage.setItem("si:plan", "1"); localStorage.removeItem("si:plan-off"); } catch {} };
export const planAsked = () => { try { return { flag: localStorage.getItem("si:plan") === "1", off: localStorage.getItem("si:plan-off") === "1" }; } catch { return { flag: false, off: false }; } };
export const planDone = () => { try { localStorage.removeItem("si:plan"); localStorage.setItem("si:plan-off", "1"); } catch {} };
