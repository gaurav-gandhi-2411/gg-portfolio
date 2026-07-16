import { Contact, Footer } from "@/components/sections/contact";
import { Experience } from "@/components/sections/experience";
import { Hero } from "@/components/sections/hero";
import { Research } from "@/components/sections/research";
import { Work } from "@/components/sections/work";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <Hero />
      <Work />
      <Research />
      <Experience />
      <Contact />
      <Footer />
    </main>
  );
}
