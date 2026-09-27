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
  const created = await invoke(accessToken, "identity", {
    action: "create",
    nickname: `${label}-${crypto.randomUUID().slice(0, 8)}`,
    requestId: crypto.randomUUID(),
  });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  return { client, accessToken };
}

async function invoke(accessToken, functionName, body) {
  const response = await fetch(`${url}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

test("2.6 evaluates once, persists the result and reveals only the current claim", { timeout: 90_000 }, async () => {
  const host = await actor("evaluate-h");
  const guest = await actor("evaluate-g");
  const created = await invoke(host.accessToken, "game", {
    action: "create",
    requestId: crypto.randomUUID(),
  });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const { roomId, joinCode } = created.body.data;
  const joined = await invoke(guest.accessToken, "game", {
    action: "join",
    joinCode,
    requestId: crypto.randomUUID(),
  });
  assert.equal(joined.status, 200, JSON.stringify(joined.body));
  const started = await invoke(host.accessToken, "game", {
    action: "start",
    roomId,
    requestId: crypto.randomUUID(),
  });
  assert.equal(started.status, 200, JSON.stringify(started.body));

  const hostSubmission = await invoke(host.accessToken, "game", {
    action: "submit",
    roomId,
    roundIndex: 1,
    answer: "I would follow the new road to a library where forgotten dreams become books.",
    requestId: crypto.randomUUID(),
  });
  assert.equal(hostSubmission.status, 200, JSON.stringify(hostSubmission.body));
  const guestSubmission = await invoke(guest.accessToken, "game", {
    action: "submit",
    roomId,
    roundIndex: 1,
    answer: "I would take the road to an archive that turns lost memories into stories.",
    requestId: crypto.randomUUID(),
  });
  assert.equal(guestSubmission.status, 200, JSON.stringify(guestSubmission.body));
  assert.equal(guestSubmission.body.data.phase, "evaluating");

  const [first, concurrent] = await Promise.all([
    invoke(host.accessToken, "evaluate", { action: "run", roomId, roundIndex: 1 }),
    invoke(guest.accessToken, "evaluate", { action: "run", roomId, roundIndex: 1 }),
  ]);
  for (const response of [first, concurrent]) {
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.ok(["ready", "processing"].includes(response.body.data.status));
  }

  let ready = first.body.data.status === "ready" ? first : concurrent;
  for (let attempt = 0; ready.body.data.status !== "ready" && attempt < 10; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    ready = await invoke(host.accessToken, "evaluate", { action: "run", roomId, roundIndex: 1 });
  }
  assert.equal(ready.status, 200, JSON.stringify(ready.body));
  assert.equal(ready.body.data.status, "ready", JSON.stringify(ready.body));
  assert.equal(ready.body.data.result.rubricVersion, "fmp-v1");
  assert.ok(typeof ready.body.data.result.modelId === "string");
  assert.ok(ready.body.data.result.modelId.length > 0);

  const replay = await invoke(guest.accessToken, "evaluate", {
    action: "run",
    roomId,
    roundIndex: 1,
  });
  assert.equal(replay.status, 200, JSON.stringify(replay.body));
  assert.deepEqual(replay.body.data, ready.body.data);

  const snapshot = await invoke(host.accessToken, "game", { action: "snapshot", roomId });
  assert.equal(snapshot.status, 200, JSON.stringify(snapshot.body));
  assert.equal(snapshot.body.data.phase, "reveal");
  assert.equal(snapshot.body.data.evaluationState, "ready");
  assert.equal(snapshot.body.data.revealedRounds.length, 1);
  assert.deepEqual(snapshot.body.data.revealedRounds[0].result, ready.body.data.result);
  assert.equal(snapshot.body.data.revealedRounds[0].answers.a.includes("forgotten dreams"), true);
  assert.equal(snapshot.body.data.revealedRounds[0].answers.b.includes("lost memories"), true);
});
