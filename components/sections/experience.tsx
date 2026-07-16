import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionMark } from "@/components/section-mark";
import { ExperienceBlock } from "@/components/experience-block";
import { experience } from "@/content/experience";
import { site } from "@/content/site";

export function Experience() {
  return (
    <section id="experience" className="mx-auto w-full max-w-4xl px-6 py-16 md:py-24">
      <SectionMark index="04" label="Experience" />

      <div className="mt-10">
        {experience.map((entry) => (
          <ExperienceBlock key={entry.company} entry={entry} />
        ))}
      </div>

      {/* Recruiter-conversion: resume is one click away again at the bottom
          of the track record, not just in the hero. */}
      <div className="border-border mt-4 flex items-center justify-between gap-4 border-t pt-10">
        <p className="text-muted-foreground max-w-[36ch] text-sm">
          The full history — dates, scope, and every metric above — is in the PDF.
        </p>
        <Button render={<a href={site.resumeUrl} download />} nativeButton={false} size="lg">
          <FileDown className="size-4" />
          Download resume
        </Button>
      </div>
    </section>
  );
}
