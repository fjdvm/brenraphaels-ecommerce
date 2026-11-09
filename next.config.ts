import type { NextConfig } from "next";
import { withBotId } from "botid/next/config";

import { productImageOrigin } from "./lib/catalog/product-image-host";

const imageOrigin = productImageOrigin();

const nextConfig: NextConfig = {
  output: "standalone",
  // Support attachments and payment screenshots still use Server Actions.
  // Careers Documents upload bytes directly from the browser to file-storage.
  experimental: {
    serverActions: {
      bodySizeLimit: "11mb",
    },
  },
  images: {
    remotePatterns: [
      ...(imageOrigin ? [new URL("/**", imageOrigin)] : []),
    ],
  },
};

export default withBotId(nextConfig);
