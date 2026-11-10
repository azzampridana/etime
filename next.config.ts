import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pango/PDFKit load local fonts and branding at runtime, including standalone deployments.
  outputFileTracingIncludes: { "/*": ["./assets/fonts/*.ttf", "./assets/fonts/OFL.txt", "./assets/images/company-logo-1.png"] },
  // Installed Next supports this limit; allow multipart overhead above the 10 MiB file cap.
  experimental: { cpus: 2, serverActions: { bodySizeLimit: "12mb" } },
};

export default nextConfig;
