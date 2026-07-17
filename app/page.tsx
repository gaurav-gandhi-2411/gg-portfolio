import { About } from "@/components/sections/about";
import { Contact, Footer } from "@/components/sections/contact";
import { Experience } from "@/components/sections/experience";
import { Hero } from "@/components/sections/hero";
import { Research } from "@/components/sections/research";
import { Work } from "@/components/sections/work";

// Wave 12 order (GG's explicit sequence): hero → about → professional
// experience FIRST → showcase projects → research → contact.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
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
