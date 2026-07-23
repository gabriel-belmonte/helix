import { describe, it } from "node:test";
import assert from "node:assert";
import { rtkCompress } from "../src/rtk.js";

describe("rtkCompress", () => {
  it("passes through short text unchanged", () => {
    const s = "hello world";
    assert.strictEqual(rtkCompress(s), s);
  });

  it("collapses multiple blank lines", () => {
    const out = rtkCompress("a\n\n\n\nb");
    assert.strictEqual(out, "a\n\nb");
  });

  it("truncates overlong lines", () => {
    const long = "x".repeat(500);
    const out = rtkCompress(long, { maxLine: 50 });
    assert.ok(out.length < 200);
    assert.ok(out.includes("more chars"));
  });

  it("condenses long outputs with head+tail", () => {
    const lines: string[] = [];
    for (let i = 0; i < 100; i++) lines.push(`line ${i}`);
    const out = rtkCompress(lines.join("\n"), { maxLines: 20, headTail: 5 });
    assert.ok(out.includes("line 0"));
    assert.ok(out.includes("line 99"));
    assert.ok(out.includes("lines omitted"));
  });

  it("handles empty input", () => {
    assert.strictEqual(rtkCompress(""), "");
    assert.strictEqual(rtkCompress("  "), "");
  });
});
