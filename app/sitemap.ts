import type { MetadataRoute } from "next";
import { caseStudies } from "@/content/case-studies";

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
    ...Object.keys(caseStudies).map((slug) => ({
      url: `${siteUrl}/work/${slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
