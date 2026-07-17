import Link from "next/link";

// Wave 12: the site has real routes now, so a wrong /work/ slug deserves a
// styled dead-end instead of the framework default.
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-32 text-center">
      <p className="text-muted-foreground font-mono text-xs tracking-eyebrow uppercase">404</p>
      <h1 className="font-heading text-heading mt-4 font-semibold text-foreground">
        Nothing lives here
      </h1>
      <p className="text-muted-foreground mt-4 max-w-measure text-base leading-relaxed">
        The page you&apos;re after doesn&apos;t exist — it may have moved when the site went
        multi-page.
      </p>
      <p className="mt-8 flex gap-6 text-sm">
        <Link
          href="/"
          className="text-accent focus-visible:outline-ring font-medium transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
        >
          ← Home
        </Link>
        <Link
          href="/projects"
          className="text-accent focus-visible:outline-ring font-medium transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
        >
          All projects →
        </Link>
      </p>
    </main>
  );
}
