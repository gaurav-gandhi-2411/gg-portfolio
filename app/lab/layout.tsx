import type { Metadata } from "next";

/**
 * Wave 8 — throwaway prototype shell. NOT part of the production site;
 * this whole /lab tree lives on explore/wave8-lab only and is never
 * intended to merge as-is. noindex/nofollow so an accidental preview
 * deploy is never indexed.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Wave 8 lab — prototypes",
};

export default function LabLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="border-border/40 flex flex-wrap gap-4 border-b px-6 py-4 text-sm">
        <a href="/lab" className="font-heading font-semibold hover:text-accent">
          Wave 8 lab
        </a>
        <span className="text-muted-foreground">·</span>
        {[1, 2, 3, 4, 5].map((n) => (
          <a key={n} href={`/lab/${n}`} className="text-muted-foreground hover:text-accent">
            {n}
          </a>
        ))}
      </nav>
      {children}
    </div>
  );
}
