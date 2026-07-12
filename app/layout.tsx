import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = "https://gauravgandhi.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Gaurav Gandhi — Senior Applied AI Scientist",
  description:
    "Senior Data Scientist building production GenAI systems at Uber scale (Indium/Uber AI) and shipping independent AI products and research under his own name.",
  openGraph: {
    title: "Gaurav Gandhi — Senior Applied AI Scientist",
    description:
      "Production GenAI systems at Uber scale, plus independent AI products and research.",
    url: siteUrl,
    siteName: "Gaurav Gandhi",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Gaurav Gandhi — Senior Applied AI Scientist",
    description:
      "Production GenAI systems at Uber scale, plus independent AI products and research.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
