export function TechChips({ chips }: { chips: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <span
          key={chip}
          className="rounded-sm border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
        >
          [{chip}]
        </span>
      ))}
    </div>
  );
}
