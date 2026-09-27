import { z } from "zod";

/**
 * Hard limits in Unicode code points. They only stop runaway output; the comparison prompt asks for
 * shorter text (summary under 60, reading items under 160). Evidence quotes stay short.
 */
export const INTERPRETATION_MAX = 200;
export const LIST_ITEM_MAX = 240;
export const EVIDENCE_MAX = 60;

const boundedText = (max: number) => z.string().refine(
  (value) => Array.from(value).length <= max,
  { message: `Must contain at most ${max} Unicode code points` },
);
const EvidenceSchema = z.array(boundedText(EVIDENCE_MAX).refine((v) => v.trim().length > 0)).max(2);
const SimilaritySchema = z.union([
  z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.null(),
]);
export const DistanceSchema = z.number().int().min(0).max(1000).nullable();
const StatusSchema = z.enum(["ok", "insufficient"]);
const explanation = boundedText(INTERPRETATION_MAX);
const shortTextArray = z.array(boundedText(LIST_ITEM_MAX)).max(2);
const readingFields = {
  summary: explanation,
  commonality: shortTextArray,
  divergence: shortTextArray,
  unknowns: shortTextArray,
};
const ModelIdSchema = z.string().trim().min(1).max(100);

/** A letter outside the Latin script, e.g. Chinese. Accents (café) and emoji pass; evidence quotes are not checked. */
const NON_LATIN_LETTER = /(?=\p{L})\P{Script=Latin}/u;
const readingIsEnglish = (value: { summary: string; commonality: string[]; divergence: string[]; unknowns: string[] }) =>
  ![value.summary, ...value.commonality, ...value.divergence, ...value.unknowns].some((text) => NON_LATIN_LETTER.test(text));

// ---------------------------------------------------------------------------
// fmp-v1 (stored results only): three pairwise similarities. New evaluations use fmp-v2.
// ---------------------------------------------------------------------------
export const DimensionResultSchema = z.object({
  similarity: SimilaritySchema,
  aEvidence: EvidenceSchema,
  bEvidence: EvidenceSchema,
  explanation,
}).strict().refine(
  (d) => d.similarity === null || (d.aEvidence.length > 0 && d.bEvidence.length > 0),
  { message: "Scored dimensions require evidence from both players" },
);

export const RoundResultV1Schema = z.object({
  status: StatusSchema,
  ...readingFields,
  dimensions: z.object({
    imagery: DimensionResultSchema,
    association: DimensionResultSchema,
    orientation: DimensionResultSchema,
  }).strict(),
  coverage: z.number().min(0).max(1),
  distance: DistanceSchema,
  rubricVersion: z.literal("fmp-v1"),
  modelId: ModelIdSchema,
}).strict().superRefine((value, ctx) => {
  // Validate the server's fmp-v1 result; never generate a replacement UI score.
  const weights = { imagery: 0.25, association: 0.5, orientation: 0.25 } as const;
  let coverage = 0;
  let weighted = 0;
  for (const key of ["imagery", "association", "orientation"] as const) {
    const similarity = value.dimensions[key].similarity;
    if (similarity !== null) {
      coverage += weights[key];
      weighted += weights[key] * similarity / 4;
    }
  }
  if ((value.status === "ok") !== (coverage > 0)) {
    ctx.addIssue({ code: "custom", path: ["status"], message: "Status must match assessable dimensions" });
  }
  if (value.coverage !== coverage) {
    ctx.addIssue({ code: "custom", path: ["coverage"], message: "Coverage does not match dimensions" });
  }
  const expected = coverage < 0.5 ? null : Math.round(1000 * (1 - weighted / coverage));
  if (value.distance !== expected) {
    ctx.addIssue({ code: "custom", path: ["distance"], message: "Distance does not match fmp-v1 (unknown must be null)" });
  }
});

// ---------------------------------------------------------------------------
// fmp-v2: the model profiles each answer on its own and scores two pairwise overlaps;
// the distance is computed here from the gaps, so it is symmetric by construction.
// ---------------------------------------------------------------------------
/** Bipolar thinking-style axes, -2 (first pole) to +2 (second pole); 0 is balanced or mixed, null is no signal. */
const AxisSchema = z.union([z.literal(-2), z.literal(-1), z.literal(0), z.literal(1), z.literal(2), z.null()]);
/** Emphasis on one value group: 0 absent, 1 hinted, 2 clear, 3 central; null is no signal. */
const EmphasisSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.null()]);

export const OverlapSchema = z.object({
  imagery: SimilaritySchema,
  focus: SimilaritySchema,
}).strict();

export const AnswerProfileSchema = z.object({
  leap: SimilaritySchema,
  thinking: z.object({ scope: AxisSchema, basis: AxisSchema, direction: AxisSchema, closure: AxisSchema }).strict(),
  values: z.object({
    openness: EmphasisSchema,
    enhancement: EmphasisSchema,
    conservation: EmphasisSchema,
    transcendence: EmphasisSchema,
  }).strict(),
}).strict();

export type Overlap = z.infer<typeof OverlapSchema>;
export type AnswerProfile = z.infer<typeof AnswerProfileSchema>;

export const FMP_V2_WEIGHTS = { association: 0.3, thinking: 0.35, values: 0.35 } as const;
const THINKING_AXES = ["scope", "basis", "direction", "closure"] as const;
const VALUE_GROUPS = ["openness", "enhancement", "conservation", "transcendence"] as const;

/**
 * fmp-v2. Association (imagery overlap, focus overlap, leap gap), thinking (four axis gaps) and values
 * (four emphasis gaps) each split their weight evenly across their items. Every known item adds
 * weight x difference (0 same .. 1 opposite); unknown items are left out. Coverage below 0.5 has no distance.
 */
export function calculateFmpV2(overlap: Overlap, a: AnswerProfile, b: AnswerProfile): { coverage: number; distance: number | null } {
  const gap = (x: number | null, y: number | null, span: number) => (x === null || y === null ? null : Math.abs(x - y) / span);
  const items: Array<[number, number | null]> = [
    [FMP_V2_WEIGHTS.association / 3, overlap.imagery === null ? null : 1 - overlap.imagery / 4],
    [FMP_V2_WEIGHTS.association / 3, overlap.focus === null ? null : 1 - overlap.focus / 4],
    [FMP_V2_WEIGHTS.association / 3, gap(a.leap, b.leap, 4)],
    ...THINKING_AXES.map((axis) => [FMP_V2_WEIGHTS.thinking / 4, gap(a.thinking[axis], b.thinking[axis], 4)] as [number, number | null]),
    ...VALUE_GROUPS.map((group) => [FMP_V2_WEIGHTS.values / 4, gap(a.values[group], b.values[group], 3)] as [number, number | null]),
  ];
  let covered = 0;
  let weighted = 0;
  for (const [weight, difference] of items) {
    if (difference === null) continue;
    covered += weight;
    weighted += weight * difference;
  }
  const coverage = Math.round(covered * 10_000) / 10_000;
  return { coverage, distance: coverage < 0.5 ? null : Math.round(1000 * weighted / covered) };
}

/** Current model output (fmp-v2). Profiles and evidence use canonical left/right order; see evaluate-pair. */
export const ModelComparisonSchema = z.object({
  status: StatusSchema,
  overlap: OverlapSchema,
  leftProfile: AnswerProfileSchema,
  rightProfile: AnswerProfileSchema,
  leftEvidence: EvidenceSchema,
  rightEvidence: EvidenceSchema,
  ...readingFields,
}).strict()
  .refine((v) => (v.status === "ok") === (calculateFmpV2(v.overlap, v.leftProfile, v.rightProfile).coverage > 0), {
    message: "Status must match what could be scored",
  })
  .refine((v) => v.status === "insufficient" || (v.leftEvidence.length > 0 && v.rightEvidence.length > 0), {
    message: "Scored comparisons require evidence from both answers",
  })
  // Model output only: the English check is not part of RoundResultSchema, so results stored earlier still parse.
  .refine(readingIsEnglish, { message: "Reading fields must be written in English" });

/** Input-dependent evidence validation: call after canonical left/right ordering. */
export function createModelComparisonSchema(left: string, right: string) {
  return ModelComparisonSchema.superRefine((value, ctx) => {
    for (const [field, answer] of [["leftEvidence", left], ["rightEvidence", right]] as const) {
      value[field].forEach((quote, index) => {
        if (!answer.includes(quote)) ctx.addIssue({
          code: "custom", path: [field, index],
          message: "Evidence must be an exact substring of its own answer",
        });
      });
    }
  });
}

export const RoundResultV2Schema = z.object({
  status: StatusSchema,
  overlap: OverlapSchema,
  a: AnswerProfileSchema,
  b: AnswerProfileSchema,
  aEvidence: EvidenceSchema,
  bEvidence: EvidenceSchema,
  ...readingFields,
  coverage: z.number().min(0).max(1),
  distance: DistanceSchema,
  rubricVersion: z.literal("fmp-v2"),
  modelId: ModelIdSchema,
}).strict().superRefine((value, ctx) => {
  // Validate the server's fmp-v2 result; never generate a replacement UI score.
  const expected = calculateFmpV2(value.overlap, value.a, value.b);
  if ((value.status === "ok") !== (expected.coverage > 0)) {
    ctx.addIssue({ code: "custom", path: ["status"], message: "Status must match what could be scored" });
  }
  if (value.status === "ok" && (value.aEvidence.length === 0 || value.bEvidence.length === 0)) {
    ctx.addIssue({ code: "custom", path: ["aEvidence"], message: "Scored comparisons require evidence from both players" });
  }
  if (value.coverage !== expected.coverage) {
    ctx.addIssue({ code: "custom", path: ["coverage"], message: "Coverage does not match fmp-v2" });
  }
  if (value.distance !== expected.distance) {
    ctx.addIssue({ code: "custom", path: ["distance"], message: "Distance does not match fmp-v2 (unknown must be null)" });
  }
});

/** Stored and published results: fmp-v1 (earlier games) or fmp-v2. The UI reads only the shared fields. */
export const RoundResultSchema = z.union([RoundResultV1Schema, RoundResultV2Schema]);
export const RubricVersionSchema = z.enum(["fmp-v1", "fmp-v2"]);

export type DimensionResult = z.infer<typeof DimensionResultSchema>;
export type RoundResultV1 = z.infer<typeof RoundResultV1Schema>;
export type RoundResultV2 = z.infer<typeof RoundResultV2Schema>;
export type ModelComparison = z.infer<typeof ModelComparisonSchema>;
export type RoundResult = z.infer<typeof RoundResultSchema>;
