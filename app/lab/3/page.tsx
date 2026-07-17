import { MomentumSlider } from "@/components/lab/momentum-slider";
import { products } from "@/content/products";

export default function Lab3() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <p className="text-muted-foreground text-xs uppercase tracking-eyebrow">Lab 3</p>
        <h1 className="font-heading text-title mt-2 font-semibold">
          Modern momentum slider
        </h1>
        <p className="text-muted-foreground mt-3 max-w-[62ch] text-sm leading-relaxed">
          Native scroll-snap for real trackpad/touch momentum, peek-of-next on both
          sides, click-and-drag added for mouse users, and a thin progress bar +
          fraction counter instead of a dot row. Try trackpad two-finger scroll,
          touch swipe, mouse drag, and arrow keys.
        </p>
      </div>
      <div className="mt-10">
        <MomentumSlider products={products} />
      </div>
    </main>
  );
}
