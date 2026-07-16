import { Badge } from "@/components/ui/badge";
import { SectionMark } from "@/components/section-mark";
import { aboutParagraphs, skillChips } from "@/content/about";

export function About() {
  return (
    <section id="about" className="mx-auto w-full max-w-4xl px-6 py-16">
      <SectionMark index="01" label="About" />
      <div className="mt-8 flex flex-col gap-6 lg:max-w-3xl">
        {aboutParagraphs.map((paragraph, i) => (
          <p
            key={paragraph}
            className={
              i === 0
                ? "font-heading text-[clamp(1.5rem,2.6vw,2.25rem)] leading-snug font-normal text-foreground italic"
                : "text-lg leading-relaxed text-foreground"
            }
          >
            {paragraph}
          </p>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-2">
        {skillChips.map((skill) => (
          <Badge key={skill} variant="secondary" className="font-mono text-xs">
            {skill}
          </Badge>
        ))}
      </div>
    </section>
  );
}
