// Copyright & Ownership Notice
// easy2Edit is the exclusive legal property of RST Coaching & Consultancy B.V. (RSTCC),
// owned by Ronald Stolk. All rights reserved. Any unauthorized use, copying, modification,
// reproduction, distribution, or commercial exploitation of Easy2Edit, including its source code,
// is strictly prohibited without prior written permission from Ronald Stolk or RSTCC.
// website https://rstcc.net

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // lets a test build run next to the dev server without touching its .next folder (NEXT_DIST_DIR=.next-build)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // dev only: open the dev server from another device on the local network
  allowedDevOrigins: ["10.*.*.*", "192.168.*.*", "172.16.*.*", "*.easy2edit.com"],
};

export default nextConfig;
