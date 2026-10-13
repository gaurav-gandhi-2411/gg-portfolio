import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

/**
 * Intent: the visual-regression gate hides every live-data-dependent element
 * (`[data-live-value]{display:none!important}`) so that layout never depends on
 * whether a third-party lookup succeeded. For the PyPI line on the Open source
 * cards that has to hold in BOTH states: the version line when the lookup came
 * back, and the "Version unavailable right now." fallback when it did not.
 *
 * It did not hold for the fallback. On 2026-10-12 a CI build where one PyPI
 * lookup failed rendered the fallback, which the mask did not cover, so the
 * home page was +27px taller than the baseline at both 390px and 1440px, on
 * both attempts of the run (same build), and the next run passed.
 *
 * This renders the real component in both states and measures the card under
 * the same mask the screenshot test applies. The two heights must be equal.
 * No network and no build involved, so it is deterministic.
 *
 * Why the transpile step: Playwright compiles spec-imported JSX with its own
 * component-testing factory, which react-dom/server cannot render. The
 * component is compiled here with the repo's own tsconfig JSX setting instead,
 * so what is measured is the component's real markup.
 */

type Stats = Record<string, { version?: string; releaseCount?: number }>;
type Group = (props: { packages: unknown[]; pypiStats: Stats }) => React.ReactElement;

const root = path.resolve(__dirname, "..");
const nodeRequire = createRequire(path.join(root, "package.json"));

function loadOwnPackagesGroup(): Group {
  const source = readFileSync(path.join(root, "components/open-source-groups.tsx"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
  });
  const mod: { exports: Record<string, unknown> } = { exports: {} };
  // Only InlineLink is a runtime import (the rest are type-only and erased
  // above). A plain anchor is enough: its styling is irrelevant to this height.
  const react = nodeRequire("react");
  const shimRequire = (id: string): unknown =>
    id === "@/components/inline-link"
      ? {
          InlineLink: ({ href, children }: { href: string; children: unknown }) =>
            react.createElement("a", { href }, children),
        }
      : nodeRequire(id);
  new Function("module", "exports", "require", outputText)(mod, mod.exports, shimRequire);
  return mod.exports.OwnPackagesGroup as Group;
}

const packages = [
  {
    name: "agentgauge-harness",
    packageName: "agentgauge-harness",
    pypiUrl: "https://pypi.org/project/agentgauge-harness/",
    repoUrl: "https://github.com/example/agentgauge",
    sourceRef: "pkg:agentgauge-harness",
  },
];

async function maskedCardHeight(
  page: import("@playwright/test").Page,
  pypiStats: Stats,
): Promise<number> {
  const OwnPackagesGroup = loadOwnPackagesGroup();
  const html = renderToStaticMarkup(OwnPackagesGroup({ packages, pypiStats }));
  await page.setContent(`<body style="width:390px;font:14px sans-serif">${html}</body>`);
  await page.addStyleTag({ content: "[data-live-value]{display:none!important}" });
  return page.locator("article").evaluate((el) => el.getBoundingClientRect().height);
}

test("Open source package card height under the live-value mask does not depend on the PyPI lookup", async ({
  page,
}) => {
  const lookedUp = await maskedCardHeight(page, {
    "agentgauge-harness": { version: "1.2.3", releaseCount: 4 },
  });
  const lookupFailed = await maskedCardHeight(page, {});
  expect(lookupFailed).toBe(lookedUp);
});
