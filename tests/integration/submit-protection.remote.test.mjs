import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
assert.ok(url && key, "Set the Supabase variables in .env.local.");

async function actor(label) {
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { data: auth, error } = await client.auth.signInAnonymously();
  assert.ifError(error);
  const accessToken = auth.session?.access_token;
  assert.ok(accessToken);
  const created = await client.functions.invoke("identity", { body: {
    action: "create", nickname: `${label}-${crypto.randomUUID().slice(0, 8)}`,
    requestId: crypto.randomUUID(),
  } });
  if (created.error) {
    const detail = await created.error.context.json();
    throw new Error(`${label} identity setup failed: ${detail.error?.code}: ${detail.error?.message}`);
  }
  return { client, accessToken };
}

async function game(accessToken, body) {
  const response = await fetch(`${url}/functions/v1/game`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

test("2.4 and 2.5 keep submissions immutable and private before reveal", { timeout: 60_000 }, async () => {
  // Keep setup sequential so the project-level anonymous-auth rate limit does
  // not obscure the game and RLS assertions this test is meant to exercise.
  const host = await actor("submit-h");
  const guest = await actor("submit-g");
  const outsider = await actor("submit-o");
  const created = await game(host.accessToken, { action: "create", requestId: crypto.randomUUID() });
  const roomId = created.body.data.roomId;
  await game(guest.accessToken, { action: "join", joinCode: created.body.data.joinCode, requestId: crypto.randomUUID() });
  await game(host.accessToken, { action: "start", roomId, requestId: crypto.randomUUID() });

  const first = await game(host.accessToken, {
    action: "submit", roomId, roundIndex: 1, answer: "A quiet lighthouse.", requestId: crypto.randomUUID(),
  });
  assert.equal(first.status, 200);
  assert.equal(first.body.data.ownAnswer, "A quiet lighthouse.");
  assert.deepEqual(first.body.data.submitted, { a: true, b: false });

  const guestBefore = await game(guest.accessToken, { action: "snapshot", roomId });
  assert.equal(guestBefore.body.data.ownAnswer, null);
  assert.equal(JSON.stringify(guestBefore.body.data).includes("A quiet lighthouse."), false);

  const conflict = await game(host.accessToken, {
    action: "submit", roomId, roundIndex: 1, answer: "A different answer.", requestId: crypto.randomUUID(),
  });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.error.code, "CONFLICT");

  const second = await game(guest.accessToken, {
    action: "submit", roomId, roundIndex: 1, answer: "A lantern in the snow.", requestId: crypto.randomUUID(),
  });
  assert.equal(second.status, 200);
  assert.equal(second.body.data.phase, "evaluating");
  assert.deepEqual(second.body.data.submitted, { a: true, b: true });

  const replay = await game(host.accessToken, {
    action: "submit", roomId, roundIndex: 1, answer: "A quiet lighthouse.", requestId: crypto.randomUUID(),
  });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.data.phase, "evaluating");

  const { data: memberRows, error: memberError } = await host.client
    .from("rooms").select("id,phase,current_round,revision,expires_at").eq("id", roomId);
  assert.ifError(memberError);
  assert.equal(memberRows.length, 1);
  const { data: outsiderRows, error: outsiderError } = await outsider.client
    .from("rooms").select("id,phase,current_round,revision,expires_at").eq("id", roomId);
  assert.ifError(outsiderError);
  assert.equal(outsiderRows.length, 0);

  const privateRoomRead = await host.client.from("rooms").select("join_code").eq("id", roomId);
  assert.ok(privateRoomRead.error);
  const submissionRead = await host.client.from("submissions").select("body").limit(1);
  assert.ok(submissionRead.error);
  const roundRead = await host.client.from("rounds").select("prompt_json").limit(1);
  assert.ok(roundRead.error);
});
