import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@neuromove/contracts", "@neuromove/ui"],
  reactStrictMode: true,
};

export default nextConfig;
