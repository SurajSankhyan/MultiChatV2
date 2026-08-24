import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "puppeteer",
    "puppeteer-extra",
    "puppeteer-extra-plugin-stealth",
    "youtubei.js"
  ],
  async rewrites() {
    return [
      {
        source: '/ytproxy/:path*',
        destination: 'https://www.youtube.com/:path*',
      },
    ];
  },
};

export default nextConfig;
