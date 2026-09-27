/** Shared builders for fmp-v2 tests. Controlled scores, not model output. */
import { calculateFmpV2 } from "../../supabase/functions/_shared/contracts/evaluation.ts";
import type { AnswerProfile, ModelComparison, Overlap } from "../../supabase/functions/_shared/contracts/evaluation.ts";

type Axis = AnswerProfile["thinking"]["scope"];
type Emphasis = AnswerProfile["values"]["openness"];

export function profile(
  leap: AnswerProfile["leap"],
  [scope, basis, direction, closure]: readonly [Axis, Axis, Axis, Axis],
  [openness, enhancement, conservation, transcendence]: readonly [Emphasis, Emphasis, Emphasis, Emphasis],
): AnswerProfile {
  return { leap, thinking: { scope, basis, direction, closure }, values: { openness, enhancement, conservation, transcendence } };
}

export const blankProfile = (): AnswerProfile => profile(null, [null, null, null, null], [null, null, null, null]);

export function modelOutput(
  overlap: Overlap,
  left: AnswerProfile,
  right: AnswerProfile,
  evidence: { left: string[]; right: string[] },
): ModelComparison {
  const scored = calculateFmpV2(overlap, left, right).coverage > 0;
  return {
    status: scored ? "ok" : "insufficient",
    overlap,
    leftProfile: left,
    rightProfile: right,
    leftEvidence: evidence.left,
    rightEvidence: evidence.right,
    summary: "A controlled scoring sample.",
    commonality: [],
    divergence: [],
    unknowns: [],
  };
}
