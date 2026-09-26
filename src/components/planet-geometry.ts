import type { RoundResult } from "@contracts/evaluation.ts";

/** Fixed canvas; the SVG scales as a whole so a distance lands in the same relative place at any width. */
export const CANVAS = {
  width: 400,
  height: 190,
  radius: 26,
  centerX: 200,
  axisY: 98,
  measureY: 138,
} as const;

export type Point = { x: number; y: number };
export type PairPosition = { a: Point; b: Point };

/** Resting pose: used while waiting, analyzing, after a technical failure and for unknown results. Not a distance. */
export const REST_POSITION: PairPosition = {
  a: { x: 124, y: 78 },
  b: { x: 276, y: 120 },
};

/** Edge gap from CONTRACTS §7: gap = 48 + 192 × distance / 1000. Consumes the server distance only. */
export function edgeGap(distance: number): number {
  return 48 + (192 * distance) / 1000;
}

export function placedPosition(distance: number): PairPosition {
  const gap = edgeGap(distance);
  return {
    a: { x: CANVAS.centerX - gap / 2 - CANVAS.radius, y: CANVAS.axisY },
    b: { x: CANVAS.centerX + gap / 2 + CANVAS.radius, y: CANVAS.axisY },
  };
}

export type UnknownKind = "no-clues" | "partial";

/** Two unknowns, told apart only by existing fields: status "insufficient", or status "ok" with coverage below 0.5. */
export function unknownKind(result: Pick<RoundResult, "distance" | "status">): UnknownKind | null {
  if (result.distance !== null) return null;
  return result.status === "insufficient" ? "no-clues" : "partial";
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Closed hand-drawn blob through jittered points on an ellipse (Catmull-Rom to cubic Bézier). */
export function blobPath(
  radius: number,
  jitter: readonly number[],
  scaleX = 1,
  scaleY = 1,
  cx = 0,
  cy = 0,
): string {
  const count = jitter.length;
  const points = jitter.map((j, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    const r = radius * (1 + j);
    return [cx + Math.cos(angle) * r * scaleX, cy + Math.sin(angle) * r * scaleY] as const;
  });
  const fmt = (p: readonly [number, number]) => `${round1(p[0])} ${round1(p[1])}`;
  let d = `M${fmt(points[0])}`;
  for (let i = 0; i < count; i += 1) {
    const p0 = points[(i - 1 + count) % count];
    const p1 = points[i];
    const p2 = points[(i + 1) % count];
    const p3 = points[(i + 2) % count];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6] as const;
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6] as const;
    d += `C${fmt(c1)} ${fmt(c2)} ${fmt(p2)}`;
  }
  return `${d}Z`;
}

export const ASTEROID_A_PATH = blobPath(26, [0.03, -0.04, 0.06, 0.02, -0.05, 0.04, 0.06, -0.03, 0.05, -0.02, 0.02, -0.04]);
export const ASTEROID_B_PATH = blobPath(26, [0.08, -0.05, 0.03, 0.09, -0.06, 0.05, -0.08, 0.06, 0.02, -0.06, 0.07, -0.03]);
export const MOONLET_PATH = blobPath(6.5, [0.1, -0.08, 0.06, -0.1, 0.08, -0.04]);
export const UNCHARTED_PATH = blobPath(18, [0.05, -0.06, 0.08, -0.03, 0.06, -0.07, 0.04, -0.05, 0.07, -0.02], 1.62, 1.12, 200, 99);
