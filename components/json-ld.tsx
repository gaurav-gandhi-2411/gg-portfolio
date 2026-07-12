import { site } from "@/content/site";

const siteUrl = "https://gaurav-gandhi.vercel.app";

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
