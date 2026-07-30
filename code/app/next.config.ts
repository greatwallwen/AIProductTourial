import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@course-ai-product/design-system",
    "@course-ai-product/case-runtime",
  ],
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
