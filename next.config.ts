import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Plain files in desktop/out: `ucode app` serves them itself, with no Next.js server.
  output: "export",
  images: { unoptimized: true },
  // This folder is the project root, even if a stray lockfile sits in a folder above.
  turbopack: { root: process.cwd() },
  // The app is shown as it is: no Next.js badge in the corner.
  devIndicators: false,
};

export default nextConfig;
