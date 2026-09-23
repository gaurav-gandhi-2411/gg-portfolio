import { HeroA } from "@/components/directions/a/hero-a";
import { OpenSourceLedgerA } from "@/components/directions/a/open-source-ledger-a";
import { WorkLedgerA } from "@/components/directions/a/work-ledger-a";
import { About } from "@/components/sections/about";
import { Contact, Footer } from "@/components/sections/contact";
import { Experience } from "@/components/sections/experience";
import { Research } from "@/components/sections/research";

/**
 * Section order, at GG's direction: hero, about, professional experience,
 * the projects, research, contact.
 *
 * Research moves back above Contact, reversing the previous pass. That pass
 * argued papers should not stand between the work and the way to get in
 * touch, and put Research after Contact so it read as a closing note. What it
 * actually produced was a page that asks for the reply before it has finished
 * making the case, and then keeps going afterwards, so Contact stopped being
 * the end of anything. Research is part of the argument, not an appendix to
 * it, and Contact is the last thing on the page because that is what a last
 * thing is for.
 *
 * refresh-2026-09, owner decision D2: Open source slots in between Work and
 * Research. It carries the same kind of evidence Research does (proof
 * someone else's project accepted the change), but it is proof about the
 * work already shown, not a separate body of writing — so it sits right
 * after Work, still ahead of Research and still short of Contact for the
 * same reason Research is: it is part of the case being made, not a coda
 * after the reader has already been asked to get in touch.
 *
 * explore/refresh-d-direction-a — proposal only, never merged: Hero, Work
 * and OpenSource swap for their Direction A ("editorial / credibility-
 * first") counterparts (components/directions/a/*). About, Experience,
 * Research and Contact are the shipped components, unchanged — the section
 * order above (Research below Work and Open source) is unchanged too.
 */
export default function Home() {
  return (
    <main id="main" className="flex flex-1 flex-col">
      <HeroA />
      <About />
      <Experience />
      <WorkLedgerA />
      <OpenSourceLedgerA />
      <Research />
      <Contact />
      <Footer />
    </main>
  );
}
