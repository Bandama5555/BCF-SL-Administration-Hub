import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Allow images from Google's AIDA CDN (used by the existing HTML apps)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  // Expose the absolute path to the parent folder for the copy script
  env: {
    PARENT_FOLDER: path.resolve(__dirname, ".."),
  },
  async rewrites() {
    return [
      {
        source: "/api/express/:path*",
        destination: "http://localhost:5000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
