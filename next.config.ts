import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native Pango loads these at runtime; include them in traced/standalone deployments.
  outputFileTracingIncludes: { "/*": ["./assets/fonts/*.ttf", "./assets/fonts/OFL.txt"] },
  // Installed Next supports this limit; allow multipart overhead above the 10 MiB file cap.
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
};

export default nextConfig;
