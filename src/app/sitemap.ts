import type { MetadataRoute } from "next";
import { SITE_URL } from "@/content/site";
import { tools } from "@/content/tools";

// /sitemap.xml: the pages search engines should index.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/tools`, changeFrequency: "monthly", priority: 0.8 },
    ...tools.map((tool) => ({ url: `${SITE_URL}/tools/${tool.slug}`, changeFrequency: "monthly" as const, priority: 0.8 })),
  ];
}
