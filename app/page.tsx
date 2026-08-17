import { About } from "@/components/sections/about";
import { Contact, Footer } from "@/components/sections/contact";
import { Experience } from "@/components/sections/experience";
import { Hero } from "@/components/sections/hero";
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
 */
export default function Home() {
  return (
    <main id="main" className="flex flex-1 flex-col">
      <Hero />
      <About />
      <Experience />
      <Work />
      <Research />
      <Contact />
      <Footer />
    </main>
  );
}
