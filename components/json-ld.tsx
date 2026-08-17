import { site } from "@/content/site";
import type { CaseStudy, Product } from "@/content/types";

const siteUrl = site.url;

export function PersonJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: site.name,
    url: siteUrl,
    jobTitle: site.role,
    email: `mailto:${site.email}`,
    sameAs: [site.githubUrl, site.linkedinUrl],
    address: {
      "@type": "PostalAddress",
      addressLocality: "Bengaluru",
      addressCountry: "IN",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/**
 * Wave 15 — per-case-study structured data (SoftwareApplication, since every
 * one of these is a real shipped product or tool, not a blog post). Lets a
 * case-study page rank for its own topic instead of only the homepage
 * competing for "Gaurav Gandhi". Introduces no new claims — every field
 * mirrors content already sourced and rendered on the page itself.
 */
export function CaseStudyJsonLd({
  study,
  product,
}: {
  study: CaseStudy;
  product: Product | undefined;
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: study.title,
    description: study.dek,
    url: `${siteUrl}/work/${study.slug}`,
    applicationCategory: "DeveloperApplication",
    author: { "@type": "Person", name: site.name, url: siteUrl },
    ...(product?.liveUrl && { installUrl: product.liveUrl }),
    ...(product?.repoUrl && { codeRepository: product.repoUrl }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
