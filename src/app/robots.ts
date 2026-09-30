import type { MetadataRoute } from "next";
import { SITE_URL } from "@/content/site";

// /robots.txt: pages are open to search engines. The API and the test URLs are not pages.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/h/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
