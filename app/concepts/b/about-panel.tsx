export function AboutPanel({ paragraphs, skills }: { paragraphs: string[]; skills: string[] }) {
  return (
    <div className="flex flex-col gap-4">
      {paragraphs.map((paragraph) => (
        <p key={paragraph} className="max-w-3xl font-mono text-sm leading-relaxed text-foreground">
          {paragraph}
        </p>
      ))}
      <div className="flex flex-wrap gap-2">
        {skills.map((skill) => (
          <span
            key={skill}
            className="rounded-sm border border-border bg-background px-2 py-1 font-mono text-[11px] text-muted-foreground"
          >
            [{skill}]
          </span>
        ))}
      </div>
    </div>
  );
}
