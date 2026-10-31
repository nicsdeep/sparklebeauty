import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets checkout and POS send larger cart payloads to server actions.
  experimental: { serverActions: { bodySizeLimit: "1mb" } },
  // The invoice PDF library loads its own files at runtime; keep it out of the bundle.
  serverExternalPackages: ["@react-pdf/renderer"],
  // The PDF routes read the font and logo files from disk.
  outputFileTracingIncludes: {
    "/admin/invoices/[id]/pdf": ["./public/fonts/**", "./public/brand/sparkle-logo-invoice.png"],
    "/order/[number]/invoice/pdf": ["./public/fonts/**", "./public/brand/sparkle-logo-invoice.png"],
  },
};

export default nextConfig;
