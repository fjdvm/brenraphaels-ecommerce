import type { NextConfig } from "next";
import { withBotId } from "botid/next/config";

import { productImageOrigin } from "./lib/catalog/product-image-host";

const imageOrigin = productImageOrigin();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      ...(imageOrigin ? [new URL("/**", imageOrigin)] : []),
    ],
  },
};

export default withBotId(nextConfig);
