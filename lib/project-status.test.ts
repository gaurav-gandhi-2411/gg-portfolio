import assert from "node:assert/strict";
import { test } from "node:test";

import { projectStatus } from "./project-status.ts";

/**
 * Intent, written before the implementation: a card's status pill reads
 * "Offline" for a product whose live surface a health check found down,
 * whatever else it has; otherwise "Live" for a public liveUrl, "PyPI" for an
 * installable package, and "Research" for everything else.
 */
const offline = { checkedAt: "2026-11-01", evidence: "backend /health 500" };

test("an offline product reads Offline", () => {
  assert.equal(projectStatus({ offline }), "Offline");
});

test("offline beats PyPI", () => {
  assert.equal(
    projectStatus({ offline, pypi: { packageName: "x", installCommand: "pip install x", badgeUrl: "" } }),
    "Offline"
  );
});

test("a live URL reads Live, and beats PyPI", () => {
  assert.equal(
    projectStatus({
      liveUrl: "https://example.com",
      pypi: { packageName: "x", installCommand: "pip install x", badgeUrl: "" },
    }),
    "Live"
  );
});

test("PyPI only reads PyPI", () => {
  assert.equal(projectStatus({ pypi: { packageName: "x", installCommand: "pip install x", badgeUrl: "" } }), "PyPI");
});

test("repo only reads Research", () => {
  assert.equal(projectStatus({}), "Research");
});

/**
 * Intent (owner decision 2026-11-02): a product the owner chose to stop
 * running reads "Archived", whatever else it has, and is not "Live"; the
 * health-check "Offline" state stays distinct.
 */
const archived = { decidedAt: "2026-11-02", note: "owner stopped running it" };

test("an archived product reads Archived", () => {
  assert.equal(projectStatus({ archived }), "Archived");
});

test("archived beats PyPI", () => {
  assert.equal(
    projectStatus({ archived, pypi: { packageName: "x", installCommand: "pip install x", badgeUrl: "" } }),
    "Archived"
  );
});

test("archived is distinct from offline", () => {
  assert.notEqual(projectStatus({ archived }), projectStatus({ offline }));
});
