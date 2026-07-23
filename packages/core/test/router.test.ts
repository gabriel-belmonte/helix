import { describe, it, expect } from "bun:test";
import { makeProviderRouter } from "../src/router";
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
function toggleableProvider(label: string, initialFail = false): LLMProvider & { shouldFail: boolean } {
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
    expect(await r.complete([{ role: "user", content: "hi" }])).toBe("from-a");
  });

  it("skips a failed provider and tries the next", async () => {
    const r = makeProviderRouter([
      { name: "fail", provider: fakeProvider("", true) },
      { name: "ok", provider: fakeProvider("from-ok") },
    ]);
    expect(await r.complete([{ role: "user", content: "hi" }])).toBe("from-ok");
  });

  it("throws when all providers fail", async () => {
    const r = makeProviderRouter([
      { name: "a", provider: fakeProvider("", true) },
      { name: "b", provider: fakeProvider("", true) },
    ]);
    await expect(r.complete([{ role: "user", content: "hi" }])).rejects.toThrow(
      "all 2 providers failed"
    );
  });

  it("tracks stats per provider", async () => {
    const pA = toggleableProvider("A", true); // starts failing
    const pB = toggleableProvider("B", false); // starts OK
    const pC = toggleableProvider("C", true); // starts failing

    const r = makeProviderRouter([
      { name: "A", provider: pA },
      { name: "B", provider: pB },
      { name: "C", provider: pC },
    ]);

    // Attempt 1: A fails, B succeeds.
    expect(await r.complete([{ role: "user", content: "hi" }])).toBe("ok:B");
    expect(r.stats[0].err).toBe(1); // A failed
    expect(r.stats[0].ok).toBe(0);
    expect(r.stats[1].ok).toBe(1); // B succeeded
    expect(r.stats[1].err).toBe(0);

    // Attempt 2: A fails, B fails — but now C succeeds.
    pB.shouldFail = true;
    pC.shouldFail = false;
    expect(await r.complete([{ role: "user", content: "hi" }])).toBe("ok:C");
    expect(r.stats[0].err).toBe(2); // A failed twice
    expect(r.stats[1].ok).toBe(1); // B still has its 1 success
    expect(r.stats[1].err).toBe(1); // B failed once in attempt 2
    expect(r.stats[2].ok).toBe(1); // C succeeded
    expect(r.stats[2].err).toBe(0);
  });
});
