import { EVIDENCE_MAX } from "../contracts/evaluation.ts";

/**
 * Loose comparison key for one code point: compatibility-decomposed (full-width to half-width),
 * accents and case removed; whitespace and punctuation (commas, quotes, dashes, ellipses) dropped.
 */
function looseKey(codePoint: string): string {
  if (/[\s\p{P}]/u.test(codePoint)) return "";
  return codePoint.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
}

/**
 * Finds a model's quote in the answer while ignoring case, spacing, width, accents and punctuation,
 * and returns the answer's own text for that span. Returns null when the words are not there as one
 * contiguous run (invented, paraphrased, elided or from the other answer), or when the span is too long.
 */
export function alignQuote(quote: string, answer: string): string | null {
  let haystack = "";
  const spans: Array<{ start: number; end: number }> = [];
  let offset = 0;
  for (const codePoint of answer) {
    const key = looseKey(codePoint);
    for (let i = 0; i < key.length; i++) spans.push({ start: offset, end: offset + codePoint.length });
    haystack += key;
    offset += codePoint.length;
  }
  const needle = Array.from(quote, looseKey).join("");
  if (!needle) return null;
  const at = haystack.indexOf(needle);
  if (at === -1) return null;
  const text = answer.slice(spans[at].start, spans[at + needle.length - 1].end);
  return Array.from(text).length <= EVIDENCE_MAX ? text : null;
}

/** Aligns each quote to its own answer; unmatched quotes are dropped and duplicates removed. */
export function alignEvidence(quotes: readonly string[], answer: string): { kept: string[]; total: number } {
  const kept: string[] = [];
  for (const quote of quotes) {
    const text = alignQuote(quote, answer);
    if (text !== null && !kept.includes(text)) kept.push(text);
  }
  return { kept, total: quotes.length };
}
