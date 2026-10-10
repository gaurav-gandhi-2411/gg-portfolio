import { Suspense } from "react";
import { About } from "@/components/sections/about";
import { Contact, Footer } from "@/components/sections/contact";
import { Experience } from "@/components/sections/experience";
import { Hero } from "@/components/sections/hero";
import { OpenSource } from "@/components/sections/open-source";
import { Research } from "@/components/sections/research";
import { Work } from "@/components/sections/work";

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
 */
export default function Home() {
  return (
    <main id="main" className="flex flex-1 flex-col">
      <Hero />
      {/* Each section below the hero gets its own Suspense boundary with no
          fallback. Nothing suspends, so the HTML is unchanged apart from
          React's boundary comments; what changes is hydration. React hydrates
          each boundary as its own task instead of one root-wide pass, which
          is what blocking time counts. The hero stays outside any boundary
          because it is above the fold and has to hydrate first. */}
      <Suspense>
        <About />
      </Suspense>
      <Suspense>
        <Experience />
      </Suspense>
      <Suspense>
        <Work />
      </Suspense>
      <Suspense>
        <OpenSource />
      </Suspense>
      <Suspense>
        <Research />
      </Suspense>
      <Suspense>
        <Contact />
      </Suspense>
      <Footer />
    </main>
  );
}
