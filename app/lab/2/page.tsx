import { StaggerList } from "@/components/lab/stagger-reveal";
import { skillChips } from "@/content/about";
import { experience } from "@/content/experience";

const bulletSample = experience[0].subRoles?.[0]?.bullets.filter((b) => b.featured).map((b) => b.text) ?? [];

export default function Lab2() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-muted-foreground text-xs uppercase tracking-eyebrow">Lab 2</p>
      <h1 className="font-heading text-title mt-2 font-semibold">
        Staggered stream-in reveal
      </h1>
      <p className="text-muted-foreground mt-3 max-w-[62ch] text-sm leading-relaxed">
        The real skill-chip list and a real Experience bullet set, revealed two ways.
        Scroll this section back into view (or hit Replay) to compare. Both use the same
        real content — only the reveal choreography differs.
      </p>

      <div className="mt-10 flex flex-col gap-10">
        <div>
          <p className="text-muted-foreground mb-3 text-xs uppercase tracking-eyebrow">
            A — current production (whole-block, no per-element stagger)
          </p>
          <StaggerList items={skillChips} mode="section" />
        </div>
        <div>
          <p className="text-muted-foreground mb-3 text-xs uppercase tracking-eyebrow">
            B — per-element cascade, 50ms step
          </p>
          <StaggerList items={skillChips} mode="stagger" stepMs={50} />
        </div>
      </div>

      <div className="border-border/40 mt-14 border-t pt-8">
        <p className="text-muted-foreground mb-3 text-xs uppercase tracking-eyebrow">
          Same pattern on longer real text (Experience bullets)
        </p>
        <StaggerList items={bulletSample.map((t) => t.slice(0, 60) + "…")} mode="stagger" stepMs={60} />
      </div>
    </main>
  );
}
