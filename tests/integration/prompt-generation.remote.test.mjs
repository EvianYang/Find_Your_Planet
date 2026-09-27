// Remote acceptance for game/prepare_prompts (tasks 3.2 / 3.3). Billable: each room makes at most one
// real question-generation call. Run after migration 202609270010 and the game function are deployed
// with LLM_API_KEY and LLM_MODEL configured.
import assert from "node:assert/strict";
import test from "node:test";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const FINAL_STATES = ["ready", "empty", "failed", "discarded"];

function createTestClient() {
  assert.ok(
    supabaseUrl && publishableKey,
    "Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local.",
  );
  return createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function createActor(label) {
  const client = createTestClient();
  const { data: authData, error: authError } = await client.auth.signInAnonymously();
  assert.ifError(authError);
  assert.ok(authData.session?.access_token);
  const { data, error } = await client.functions.invoke("identity", {
    body: { action: "create", nickname: `${label}-${crypto.randomUUID().slice(0, 8)}`, requestId: crypto.randomUUID() },
  });
  assert.ifError(error);
  assert.equal(data?.error, null);
  return { client, accessToken: authData.session.access_token };
}

async function gameRequest(accessToken, body) {
  const response = await fetch(`${supabaseUrl}/functions/v1/game`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function readyRoom(host, guest) {
  const created = await gameRequest(host.accessToken, { action: "create", requestId: crypto.randomUUID() });
  assert.equal(created.status, 200);
  const joined = await gameRequest(guest.accessToken, {
    action: "join", joinCode: created.body.data.joinCode, requestId: crypto.randomUUID(),
  });
  assert.equal(joined.status, 200);
  return created.body.data.roomId;
}

function assertNoCandidates(body) {
  assert.deepEqual(Object.keys(body.data ?? {}), ["status"]);
  assert.doesNotMatch(JSON.stringify(body), /candidates|question-generation|"text"/);
}

test("3.2 one generation attempt per room; members share it and outsiders are rejected", { timeout: 90_000 }, async () => {
  const [host, guest, outsider] = await Promise.all([
    createActor("gen-host"), createActor("gen-guest"), createActor("gen-outsider"),
  ]);
  const roomId = await readyRoom(host, guest);

  const denied = await gameRequest(outsider.accessToken, { action: "prepare_prompts", roomId });
  assert.equal(denied.status, 404);
  assert.equal(denied.body.error.code, "NOT_FOUND");

  // Both members at once: exactly one claims the attempt; the other sees it in progress (or finished).
  const [first, second] = await Promise.all([
    gameRequest(host.accessToken, { action: "prepare_prompts", roomId }),
    gameRequest(guest.accessToken, { action: "prepare_prompts", roomId }),
  ]);
  for (const response of [first, second]) {
    assert.equal(response.status, 200);
    assertNoCandidates(response.body);
  }
  const statuses = [first.body.data.status, second.body.data.status];
  assert.ok(statuses.some((s) => FINAL_STATES.includes(s)), `one caller runs the attempt: ${statuses}`);

  // A repeat only reads the saved state. The real proof that the model was called once is a single
  // PROMPT_GENERATION log line for this room in the game function logs; the timing here is a heuristic.
  const finalStatus = statuses.find((s) => FINAL_STATES.includes(s));
  const started = Date.now();
  const repeat = await gameRequest(host.accessToken, { action: "prepare_prompts", roomId });
  assert.equal(repeat.status, 200);
  assert.equal(repeat.body.data.status, finalStatus);
  assert.ok(Date.now() - started < 3_000, "a repeated request should only read the saved state");

  const { error: directReadError } = await host.client.from("room_prompt_pools").select("candidates").limit(1);
  assert.equal(directReadError?.code, "42501", "Browser-equivalent reads of the candidate pool must be denied.");

  // The game starts normally and may include a saved generated question.
  const start = await gameRequest(host.accessToken, { action: "start", roomId, requestId: crypto.randomUUID() });
  assert.equal(start.status, 200);
  assert.equal(start.body.data.phase, "answering");
  const prompt = start.body.data.currentPrompt;
  assert.ok(prompt.source === "curated" || (prompt.source === "generated" && prompt.version === "question-generation-v2"));

  // Outside the lobby every request is refused, even though this room has a saved attempt.
  const afterStart = await gameRequest(guest.accessToken, { action: "prepare_prompts", roomId });
  assert.equal(afterStart.status, 409);
  assert.equal(afterStart.body.error.code, "INVALID_PHASE");
});

test("3.3 the start never waits for generation, and a late result cannot change the prompts", { timeout: 90_000 }, async () => {
  const [host, guest] = await Promise.all([createActor("late-host"), createActor("late-guest")]);
  const roomId = await readyRoom(host, guest);

  let generationDone = false;
  const pending = gameRequest(host.accessToken, { action: "prepare_prompts", roomId }).then((response) => {
    generationDone = true;
    return response;
  });
  await new Promise((resolve) => setTimeout(resolve, 300));
  const start = await gameRequest(host.accessToken, { action: "start", roomId, requestId: crypto.randomUUID() });
  assert.equal(start.status, 200);
  const startFinishedFirst = !generationDone;
  const prompts = start.body.data.currentPrompt;

  const generation = await pending;
  if (generation.status === 409) {
    // The start took the room lock before the claim, so no attempt was made at all.
    assert.equal(generation.body.error.code, "INVALID_PHASE");
  } else {
    assert.equal(generation.status, 200);
    assertNoCandidates(generation.body);
    // The claim won; the start landed while the model was running, so the write-back found the game
    // started and discarded the result. "failed" only if generation itself failed before the start.
    assert.ok(["discarded", "failed"].includes(generation.body.data.status), generation.body.data.status);
    if (generation.body.data.status === "discarded") {
      assert.ok(startFinishedFirst, "the start must not wait for the generation call");
    }
  }

  const after = await gameRequest(host.accessToken, { action: "snapshot", roomId });
  assert.deepEqual(after.body.data.currentPrompt, prompts, "a late generation result must not change the started game");
});

test("3.2 a room that never prepared cannot start an attempt after the game began", { timeout: 60_000 }, async () => {
  const [host, guest] = await Promise.all([createActor("phase-host"), createActor("phase-guest")]);
  const roomId = await readyRoom(host, guest);
  const start = await gameRequest(host.accessToken, { action: "start", roomId, requestId: crypto.randomUUID() });
  assert.equal(start.status, 200);
  const tooLate = await gameRequest(host.accessToken, { action: "prepare_prompts", roomId });
  assert.equal(tooLate.status, 409);
  assert.equal(tooLate.body.error.code, "INVALID_PHASE");
});
