import { RevealGroup } from "@/components/reveal-group";
import { Section } from "@/components/section";
import { aboutParagraphs, skillChips } from "@/content/about";

/**
 * Wave 12 — About Me (GG's explicit ask). Three short first-person
 * paragraphs — who, what I build, how I work — plus the skill line that
 * used to close Experience (it describes me, not a job). Prose stays
 * left-aligned inside the centered column: three paragraphs of
 * center-justified text is harder to read, and the section header
 * carries the centered rhythm.
 */
export function About() {
  return (
    <Section id="about" label="About me">
      <RevealGroup mode="onview" className="flex flex-col items-center gap-5">
        {aboutParagraphs.map((paragraph) => (
          <p
            key={paragraph.slice(0, 32)}
            className="text-muted-foreground max-w-measure text-base leading-relaxed"
          >
            {paragraph}
          </p>
        ))}
        <p className="border-border/40 text-muted-foreground max-w-measure border-t pt-5 text-sm leading-relaxed">
          Working across {skillChips.join(" · ")}.
        </p>
      </RevealGroup>
    </Section>
  );
}
