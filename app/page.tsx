import { About } from "@/components/sections/about";
import { Colophon } from "@/components/sections/colophon";
import { Contact } from "@/components/sections/contact";
import { Experience } from "@/components/sections/experience";
import { Hero } from "@/components/sections/hero";
import { Products } from "@/components/sections/products";
import { Research } from "@/components/sections/research";
import { Reveal } from "@/components/reveal";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <Hero />
      <Reveal>
        <About />
      </Reveal>
      <Reveal>
        <Products />
      </Reveal>
      <Reveal>
        <Research />
      </Reveal>
      <Reveal>
        <Experience />
      </Reveal>
      <Reveal>
        <Contact />
      </Reveal>
      <Colophon />
    </main>
  );
}
