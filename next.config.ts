import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // output: "standalone",
  allowedDevOrigins: [
    "integral-lemming-lately.ngrok-free.app",
    "192.168.0.99",
    "pcerda",
  ],
};

export default nextConfig;
