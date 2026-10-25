import type { NextConfig } from "next";
import { withBotId } from "botid/next/config";

import { productImageOrigin } from "./lib/catalog/product-image-host";

const imageOrigin = productImageOrigin();

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
      ...(imageOrigin ? [new URL("/**", imageOrigin)] : []),
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
};

export default withBotId(nextConfig);
