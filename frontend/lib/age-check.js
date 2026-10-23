// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

// Month and year the visitor gave in the 18+ check (kept in this browser): the sign-up forms start from it. Returns "YYYY-MM-01" or "".
export function checkedBirthMonth() {
  try {
    const v = JSON.parse(localStorage.getItem("age:birth") || "null");
    if (v?.y >= 1900 && v?.m >= 1 && v?.m <= 12) return `${v.y}-${String(v.m).padStart(2, "0")}-01`;
  } catch {}
  return "";
}
