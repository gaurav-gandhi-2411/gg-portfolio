import { About } from "@/components/sections/about";
import { Contact } from "@/components/sections/contact";
import { Experience } from "@/components/sections/experience";
import { Hero } from "@/components/sections/hero";
import { NowStrip } from "@/components/sections/now-strip";
import { Products } from "@/components/sections/products";
import { Research } from "@/components/sections/research";
import { ShippingLog } from "@/components/sections/shipping-log";
import { Reveal } from "@/components/reveal";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <Hero />
      <NowStrip />
      <Reveal>
        <About />
      </Reveal>
      <Reveal>
        <Products />
      </Reveal>
      <Reveal>
        <ShippingLog />
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
    </main>
  );
}
