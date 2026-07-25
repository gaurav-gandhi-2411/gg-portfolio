import { RevealGroup } from "@/components/reveal-group";
import { Section } from "@/components/section";
import { aboutParagraphs, skillChips } from "@/content/about";

/**
 * Wave 12 — About Me: three short first-person paragraphs. Prose stays
 * left-aligned inside the centered column (centered multi-paragraph text
 * is harder to read; the section header carries the centered rhythm).
 *
 * Wave 13 — desktop composition: at xl the skills move out of the closing
 * one-liner into a right-rail panel beside the prose, so the 1280–1600px
 * band holds two real columns instead of a narrow strand of text. The
 * mobile/tablet layout is byte-identical to wave 12's. (The two renderings
 * are display-toggled — display:none removes the hidden one from the
 * accessibility tree, so nothing announces twice.)
 */
export function About() {
  return (
    <Section id="about" label="About me" width="wide">
      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_17rem] xl:gap-x-14">
        <RevealGroup mode="onview" className="flex flex-col items-center gap-5 xl:items-start">
          {aboutParagraphs.map((paragraph) => (
            <p
              key={paragraph.slice(0, 32)}
              className="text-muted-foreground max-w-measure text-base leading-relaxed"
            >
              {paragraph}
            </p>
          ))}
          <p className="border-border/40 text-muted-foreground max-w-measure border-t pt-5 text-sm leading-relaxed xl:hidden">
            Working across {skillChips.join(" · ")}.
          </p>
        </RevealGroup>

        <aside className="hidden xl:block" aria-label="Core skills">
          <div className="border-border/40 rounded-xl border p-5">
            <h3 className="text-muted-foreground font-mono text-xs tracking-eyebrow uppercase">
              Working across
            </h3>
            <ul className="mt-4 flex flex-col gap-2.5">
              {skillChips.map((chip) => (
                <li key={chip} className="text-muted-foreground text-sm leading-snug">
                  {chip}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </Section>
  );
}
