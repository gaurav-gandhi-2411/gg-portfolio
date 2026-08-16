import { About } from "@/components/sections/about";
import { Contact, Footer } from "@/components/sections/contact";
import { Experience } from "@/components/sections/experience";
import { Hero } from "@/components/sections/hero";
import { Research } from "@/components/sections/research";
import { Work } from "@/components/sections/work";

/**
 * Section order, at GG's direction: hero, about, professional experience,
 * the projects, contact, and research last.
 *
 * Research moved below Contact in this pass. It sat between the work and
 * the way to get in touch, which put a page of papers in front of the one
 * thing a visitor who has just been convinced actually wants. It reads as a
 * closing note now rather than an obstacle, and anyone who wants it will
 * scroll for it.
 */
export default function Home() {
  return (
    <main id="main" className="flex flex-1 flex-col">
      <Hero />
      <About />
      <Experience />
      <Work />
      <Contact />
      <Research />
      <Footer />
    </main>
  );
}
