import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/profile", "/cart", "/support", "/complete-profile"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
