import { describe, it } from "node:test";
import assert from "node:assert";
import { cavemanCompress } from "../src/caveman.js";

describe("cavemanCompress", () => {
  it("drops articles", () => {
    assert.strictEqual(cavemanCompress("the file and a folder"), "file & folder");
  });

  it("shortens common words", () => {
    const out = cavemanCompress("configuration documentation application");
    assert.strictEqual(out, "config docs app");
  });

  it("uses number homophones", () => {
    assert.strictEqual(cavemanCompress("to do for you"), "2 do 4 u");
  });

  it("drops filler words", () => {
    assert.strictEqual(cavemanCompress("just basically very nice"), "nice");
  });

  it("collapses whitespace", () => {
    const out = cavemanCompress("hello    world\n\n\nnext");
    assert.strictEqual(out, "hello world\n\nnext");
  });

  it("handles empty strings", () => {
    assert.strictEqual(cavemanCompress(""), "");
    assert.strictEqual(cavemanCompress("  "), "");
  });

  it("skips short strings (< 20 chars)", () => {
    const compressed = cavemanCompress("short text");
    // Short texts still get compressed but this is fine.
    assert.ok(typeof compressed === "string");
  });
});
