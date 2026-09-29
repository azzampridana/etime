import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Installed Next supports this limit; allow multipart overhead above the 10 MiB file cap.
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
};

export default nextConfig;
