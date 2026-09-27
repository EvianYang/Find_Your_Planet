import { test } from "node:test";
import assert from "node:assert/strict";
import { alignEvidence, alignQuote } from "../../supabase/functions/_shared/ai/evidence.ts";

const mixed = "那肯定是mirror啊，天天听phone飙一堆垃圾话，难道还要我给它提供情绪价值吗？";
const english = "Apple  pie keeps a family tradition alive. I don't want it “lost”.";

test("loose copies are aligned back to the answer's own text", () => {
  // Spaces added between Chinese and English, half-width comma, surrounding quotes.
  assert.equal(alignQuote("phone 飙一堆垃圾话", mixed), "phone飙一堆垃圾话");
  assert.equal(alignQuote("天天听phone飙,", mixed), "天天听phone飙");
  assert.equal(alignQuote("“提供情绪价值”", mixed), "提供情绪价值");
  // Case, single vs double space, non-breaking space, straight vs curly apostrophe and quotes.
  assert.equal(alignQuote("apple pie", english), "Apple  pie");
  assert.equal(alignQuote("Apple pie keeps", english), "Apple  pie keeps");
  assert.equal(alignQuote("I don’t want it \"lost\"", english), "I don't want it “lost");
  // Full-width letters and accents.
  assert.equal(alignQuote("ＡＰＰＬＥ pie", english), "Apple  pie");
  assert.equal(alignQuote("cafe", "A café at dawn"), "café");
});

test("invented, paraphrased, elided or wrong-answer quotes are not aligned", () => {
  for (const quote of ["fabricated", "Apple…tradition", "Apple pie keeps the tradition", "family traditions", "Zebra soup", "", " ,。 "]) {
    assert.equal(alignQuote(quote, english), null, JSON.stringify(quote));
  }
  assert.equal(alignQuote("mirror phone", mixed), null);
});

test("aligned spans still respect the evidence length limit", () => {
  const long = "word ".repeat(20).trim();
  assert.equal(alignQuote("word ".repeat(13).trim(), long), null);
  assert.equal(alignQuote("word word", long), "word word");
});

test("evidence keeps matched quotes, drops the rest and removes duplicates", () => {
  assert.deepEqual(alignEvidence(["apple pie", "made up", "Apple  pie"], english), { kept: ["Apple  pie"], total: 3 });
  assert.deepEqual(alignEvidence([], english), { kept: [], total: 0 });
});
