import { z } from "zod";

/**
 * Hard limits in Unicode code points. They only stop runaway output; the comparison prompt asks for
 * shorter text (summary under 60, explanations under 80, reading items under 160). Evidence quotes stay short.
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
export const RubricVersionSchema = z.literal("fmp-v1");
const explanation = boundedText(INTERPRETATION_MAX);
const shortTextArray = z.array(boundedText(LIST_ITEM_MAX)).max(2);

export const ModelDimensionSchema = z.object({
  similarity: SimilaritySchema,
  leftEvidence: EvidenceSchema,
  rightEvidence: EvidenceSchema,
  explanation,
}).strict().refine(
  (d) => d.similarity === null || (d.leftEvidence.length > 0 && d.rightEvidence.length > 0),
  { message: "Scored dimensions require evidence from both answers" },
);
export const DimensionResultSchema = z.object({
  similarity: SimilaritySchema,
  aEvidence: EvidenceSchema,
  bEvidence: EvidenceSchema,
  explanation,
}).strict().refine(
  (d) => d.similarity === null || (d.aEvidence.length > 0 && d.bEvidence.length > 0),
  { message: "Scored dimensions require evidence from both players" },
);
const textFields = {
  status: z.enum(["ok", "insufficient"]),
  summary: explanation,
  commonality: shortTextArray,
  divergence: shortTextArray,
  unknowns: shortTextArray,
};
const hasConsistentStatus = (value: {
  status: "ok" | "insufficient";
  dimensions: Record<string, { similarity: number | null }>;
}) => (value.status === "ok") === Object.values(value.dimensions).some((d) => d.similarity !== null);

/** A letter outside the Latin script, e.g. Chinese. Accents (café) and emoji pass; evidence quotes are not checked. */
const NON_LATIN_LETTER = /(?=\p{L})\P{Script=Latin}/u;
const interpretationIsEnglish = (value: {
  summary: string;
  commonality: string[];
  divergence: string[];
  unknowns: string[];
  dimensions: Record<string, { explanation: string }>;
}) => ![
  value.summary,
  ...value.commonality,
  ...value.divergence,
  ...value.unknowns,
  ...Object.values(value.dimensions).map((d) => d.explanation),
].some((text) => NON_LATIN_LETTER.test(text));

// Model output only: the English check is not part of RoundResultSchema, so results stored earlier still parse.
export const ModelComparisonSchema = z.object({
  ...textFields,
  dimensions: z.object({
    imagery: ModelDimensionSchema,
    association: ModelDimensionSchema,
    orientation: ModelDimensionSchema,
  }).strict(),
}).strict().refine(hasConsistentStatus, { message: "Status must match assessable dimensions" })
  .refine(interpretationIsEnglish, { message: "Interpretation fields must be written in English" });

export const RoundResultSchema = z.object({
  ...textFields,
  dimensions: z.object({
    imagery: DimensionResultSchema,
    association: DimensionResultSchema,
    orientation: DimensionResultSchema,
  }).strict(),
  coverage: z.number().min(0).max(1),
  distance: DistanceSchema,
  rubricVersion: RubricVersionSchema,
  modelId: z.string().trim().min(1).max(100),
}).strict().refine(hasConsistentStatus, { message: "Status must match assessable dimensions" })
  .superRefine((value, ctx) => {
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
    if (value.coverage !== coverage) {
      ctx.addIssue({ code: "custom", path: ["coverage"], message: "Coverage does not match dimensions" });
    }
    const expected = coverage < 0.5 ? null : Math.round(1000 * (1 - weighted / coverage));
    if (value.distance !== expected) {
      ctx.addIssue({ code: "custom", path: ["distance"], message: "Distance does not match fmp-v1 (unknown must be null)" });
    }
  });

/** Input-dependent evidence validation: call after canonical left/right ordering. */
export function createModelComparisonSchema(left: string, right: string) {
  return ModelComparisonSchema.superRefine((value, ctx) => {
    for (const key of ["imagery", "association", "orientation"] as const) {
      for (const [field, answer] of [["leftEvidence", left], ["rightEvidence", right]] as const) {
        value.dimensions[key][field].forEach((quote, index) => {
          if (!answer.includes(quote)) ctx.addIssue({
            code: "custom", path: ["dimensions", key, field, index],
            message: "Evidence must be an exact substring of its own answer",
          });
        });
      }
    }
  });
}

export type ModelDimension = z.infer<typeof ModelDimensionSchema>;
export type DimensionResult = z.infer<typeof DimensionResultSchema>;
export type ModelComparison = z.infer<typeof ModelComparisonSchema>;
export type RoundResult = z.infer<typeof RoundResultSchema>;
