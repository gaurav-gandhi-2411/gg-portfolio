import type { MetadataRoute } from "next";
import { caseStudies } from "@/content/case-studies";
import { CATEGORIES } from "@/content/types";

const siteUrl = "https://gaurav-gandhi.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${siteUrl}/projects`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    // Wave 15 — progressive-disclosure category pages, one per category.
    ...CATEGORIES.map((c) => ({
      url: `${siteUrl}/projects/${c.id}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...Object.keys(caseStudies).map((slug) => ({
      url: `${siteUrl}/work/${slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
