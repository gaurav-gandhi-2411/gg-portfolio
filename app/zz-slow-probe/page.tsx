import { Slow } from "./slow";

export const metadata = { title: "zz slow probe", robots: { index: false, follow: false } };

// Inline script busy-waits 800ms during parse (blocks rendering) — throwaway probe only.
const BLOCK = "var e=Date.now()+800;while(Date.now()<e){}";

export default function Page() {
  return (
    <main>
      <script dangerouslySetInnerHTML={{ __html: BLOCK }} />
      <h1>slow probe</h1>
      <Slow />
    </main>
  );
}
