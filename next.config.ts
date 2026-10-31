import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets checkout and POS send larger cart payloads to server actions.
  experimental: { serverActions: { bodySizeLimit: "1mb" } },
};

export default nextConfig;
