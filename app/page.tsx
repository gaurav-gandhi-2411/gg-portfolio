import { About } from "@/components/sections/about";
import { Contact } from "@/components/sections/contact";
import { Experience } from "@/components/sections/experience";
import { Hero } from "@/components/sections/hero";
import { Products } from "@/components/sections/products";
import { Research } from "@/components/sections/research";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <Hero />
      <About />
      <Experience />
      <Products />
      <Research />
      <Contact />
    </main>
  );
}
