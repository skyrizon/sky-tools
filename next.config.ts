import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // skyrizon.online is not redirected: AdSense reviews the root domain and reads
      // its ads.txt there, so it must serve the site itself. Canonical URLs still
      // point at tools.skyrizon.online, so search engines don't see duplicates.
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
