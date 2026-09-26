import assert from "node:assert/strict";
import test from "node:test";

import { chooseNewerSnapshot } from "../../src/hooks/useGameSession.ts";
import { GameSnapshotSchema } from "../../supabase/functions/_shared/contracts/game.ts";

const snapshot = (revision: number) => GameSnapshotSchema.parse({
  roomId: "a1111111-1111-4111-8111-111111111111",
  phase: "answering",
  currentRound: 1,
  revision,
  expiresAt: "2026-09-27T12:00:00.000Z",
  players: [
    { slot: "A", nickname: "Alex" },
    { slot: "B", nickname: "Sam" },
  ],
  currentPrompt: {
    id: "sync-test",
    text: "Where would a newly discovered road lead?",
    source: "curated",
    version: "test-v1",
  },
  ownAnswer: null,
  submitted: { a: false, b: false },
  continued: { a: false, b: false },
  evaluationState: "idle",
  revealedRounds: [],
  overall: null,
});

test("2.7 never replaces a newer snapshot with an older revision", () => {
  const newest = snapshot(12);
  assert.equal(chooseNewerSnapshot(newest, snapshot(11)), newest);
  assert.equal(chooseNewerSnapshot(null, newest), newest);
  assert.equal(chooseNewerSnapshot(snapshot(11), newest), newest);
});
