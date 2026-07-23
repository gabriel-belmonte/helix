import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { makeProviderRouter } from "../src/router.js";
import type { ChatMessage, LLMProvider } from "helix-agent";

function fakeProvider(reply: string, fail = false): LLMProvider {
  return {
    complete: async (_msgs: ChatMessage[]) => {
      if (fail) throw new Error("simulated failure");
      return reply;
    },
  };
}

/** A mutable flag we can toggle mid-test. */
function toggleableProvider(
  label: string,
  initialFail = false
): LLMProvider & { shouldFail: boolean } {
  const p = { shouldFail: initialFail };
  return Object.assign(p, {
    complete: async (_msgs: ChatMessage[]) => {
      if (p.shouldFail) throw new Error(`fail:${label}`);
      return `ok:${label}`;
    },
  });
}

describe("makeProviderRouter", () => {
  it("returns the first provider's reply", async () => {
    const r = makeProviderRouter([
      { name: "a", provider: fakeProvider("from-a") },
      { name: "b", provider: fakeProvider("from-b") },
    ]);
    assert.strictEqual(
      await r.complete([{ role: "user", content: "hi" }]),
      "from-a"
    );
  });

  it("skips a failed provider and tries the next", async () => {
    const r = makeProviderRouter([
      { name: "fail", provider: fakeProvider("", true) },
      { name: "ok", provider: fakeProvider("from-ok") },
    ]);
    assert.strictEqual(
      await r.complete([{ role: "user", content: "hi" }]),
      "from-ok"
    );
  });

  it("throws when all providers fail", async () => {
    const r = makeProviderRouter([
      { name: "a", provider: fakeProvider("", true) },
      { name: "b", provider: fakeProvider("", true) },
    ]);
    await assert.rejects(
      () => r.complete([{ role: "user", content: "hi" }]),
      /all 2 providers failed/
    );
  });

  it("tracks stats per provider", async () => {
    const pA = toggleableProvider("A", true);
    const pB = toggleableProvider("B", false);
    const pC = toggleableProvider("C", true);
    const r = makeProviderRouter([
      { name: "A", provider: pA },
      { name: "B", provider: pB },
      { name: "C", provider: pC },
    ]);

    // Attempt 1: A fails, B succeeds.
    assert.strictEqual(await r.complete([{ role: "user", content: "hi" }]), "ok:B");
    assert.strictEqual(r.stats[0].err, 1);
    assert.strictEqual(r.stats[0].ok, 0);
    assert.strictEqual(r.stats[1].ok, 1);
    assert.strictEqual(r.stats[1].err, 0);

    // Attempt 2: A fails, B fails, C succeeds.
    pB.shouldFail = true;
    pC.shouldFail = false;
    assert.strictEqual(await r.complete([{ role: "user", content: "hi" }]), "ok:C");
    assert.strictEqual(r.stats[0].err, 2);
    assert.strictEqual(r.stats[1].ok, 1);
    assert.strictEqual(r.stats[1].err, 1);
    assert.strictEqual(r.stats[2].ok, 1);
    assert.strictEqual(r.stats[2].err, 0);
  });
});
