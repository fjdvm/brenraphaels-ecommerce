import type { NextConfig } from "next";
import { withBotId } from "botid/next/config";

const nextConfig: NextConfig = {
  // Documents are limited to 10 MB in the Careers domain. Leave room for
  // multipart form metadata so a valid maximum-size Document reaches its
  // Server Action instead of Next.js rejecting it first.
  experimental: {
    serverActions: {
      bodySizeLimit: "11mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
};

export default withBotId(nextConfig);
