import { expect, test } from "@playwright/test";

/** PNG IHDR: width at byte 16, height at byte 20, both big-endian uint32. */
test("/opengraph-image is a 1200x630 PNG", async ({ request }) => {
  const res = await request.get("/opengraph-image");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image/png");
  const body = await res.body();
  expect(body.subarray(1, 4).toString("ascii")).toBe("PNG");
  expect(body.readUInt32BE(16)).toBe(1200);
  expect(body.readUInt32BE(20)).toBe(630);
});
