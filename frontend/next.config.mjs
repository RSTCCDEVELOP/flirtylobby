/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // lets a test build run next to the dev server without touching its .next folder (NEXT_DIST_DIR=.next-build)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // dev only: open the dev server from another device on the local network
  allowedDevOrigins: ["10.*.*.*", "192.168.*.*", "172.16.*.*"],
};

export default nextConfig;
