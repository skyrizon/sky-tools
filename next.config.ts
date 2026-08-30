import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "skyrizon.online" }],
        destination: "https://tools.skyrizon.online/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.skyrizon.online" }],
        destination: "https://tools.skyrizon.online/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
