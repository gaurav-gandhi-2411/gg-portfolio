import { Badge } from "@/components/ui/badge";
import { aboutParagraphs, skillChips } from "@/content/about";

export function About() {
  return (
    <section id="about" className="mx-auto w-full max-w-4xl px-6 py-16">
      <h2 className="font-heading text-sm font-semibold tracking-widest text-accent uppercase">
        About
      </h2>
      <div className="mt-4 flex flex-col gap-4">
        {aboutParagraphs.map((paragraph) => (
          <p key={paragraph} className="max-w-3xl text-lg leading-relaxed text-foreground">
            {paragraph}
          </p>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        {skillChips.map((skill) => (
          <Badge key={skill} variant="secondary" className="font-mono text-xs">
            {skill}
          </Badge>
        ))}
      </div>
    </section>
  );
}
