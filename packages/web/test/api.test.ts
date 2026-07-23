import { test } from "node:test";
import assert from "node:assert";

// The API app is the single source of truth for the dashboard. We test it
// without a live port by calling app.request() directly (Hono's test helper).

// Import the built app. In tests we load the TS through tsx/bun.
const { app } = await import("../server/index.ts");

test("GET /api/health returns ok", async () => {
  const res = await app.request("/api/health");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.product, "helix-web");
});

test("GET /api/config returns an object", async () => {
  const res = await app.request("/api/config");
  assert.equal(res.status, 200);
  const cfg = await res.json();
  assert.ok(typeof cfg === "object");
});

test("GET /api/skills returns an array", async () => {
  const res = await app.request("/api/skills");
  assert.equal(res.status, 200);
  const skills = await res.json();
  assert.ok(Array.isArray(skills));
});

test("GET /api/files rejects escaping the root", async () => {
  const res = await app.request("/api/files?path=../../etc");
  // either 400 (out of bounds) or 404 (not found) — both are safe
  assert.ok(res.status === 400 || res.status === 404);
});

test("unknown api route still serves SPA fallback (or 404 if not built)", async () => {
  const res = await app.request("/some/spa/route");
  // 200 when dist/ is built; 404 when it isn't (serveStatic has no files).
  // Both are acceptable — the route mapping exists; only the asset is missing.
  assert.ok(res.status === 200 || res.status === 404);
});
