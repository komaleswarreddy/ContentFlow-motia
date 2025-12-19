import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone', // Optimize for production deployment
  // Ensure environment variables are available at build time
  env: {
    NEXT_PUBLIC_MOTIA_BACKEND_URL: process.env.NEXT_PUBLIC_MOTIA_BACKEND_URL,
  },
};

export default nextConfig;
