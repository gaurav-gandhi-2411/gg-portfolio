import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WarmupClient } from "@/components/warmup-client";
import { getWarmupConfig, warmupConfigs } from "@/content/warmup";

export function generateStaticParams() {
  return Object.keys(warmupConfigs).map((service) => ({ service }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ service: string }>;
}): Promise<Metadata> {
  const { service } = await params;
  const config = getWarmupConfig(service);
  if (!config) return {};
  const title = `Waking ${config.name} — Gaurav Gandhi`;
  const description = `${config.name} scales to zero to keep idle cost at $0 — this page wakes it and takes you there once it's ready.`;
  return {
    title,
    description,
    robots: { index: false, follow: true },
    // F3 — canonical tag per warmup route.
    alternates: { canonical: `/warmup/${service}` },
    openGraph: { title, description, siteName: "Gaurav Gandhi", type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function WarmupPage({
  params,
}: {
  params: Promise<{ service: string }>;
}) {
  const { service } = await params;
  const config = getWarmupConfig(service);
  if (!config) notFound();
  return <WarmupClient config={config} />;
}
