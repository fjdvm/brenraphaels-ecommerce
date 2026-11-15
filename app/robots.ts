import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site/site-url";

// Read at request time: the site URL is a runtime secret, not present at build.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/profile", "/cart", "/support", "/complete-profile"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
