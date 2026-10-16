/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // dev only: open the dev server from another device on the local network
  allowedDevOrigins: ["10.*.*.*", "192.168.*.*", "172.16.*.*"],
};

export default nextConfig;
