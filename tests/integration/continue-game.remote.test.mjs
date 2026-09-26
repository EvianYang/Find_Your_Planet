import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
assert.ok(url && key, "Set the Supabase variables in .env.local.");

async function invoke(accessToken, functionName, body) {
  const response = await fetch(`${url}/functions/v1/${functionName}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function actor(label) {
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInAnonymously();
  assert.ifError(error);
  const accessToken = data.session?.access_token;
  assert.ok(accessToken);
  const created = await invoke(accessToken, "identity", {
    action: "create",
    nickname: `${label}-${crypto.randomUUID().slice(0, 8)}`,
    requestId: crypto.randomUUID(),
  });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  return { accessToken };
}

async function evaluate(accessToken, roomId, roundIndex) {
  const response = await invoke(accessToken, "evaluate", { action: "run", roomId, roundIndex });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.data.status, "ready", JSON.stringify(response.body));
  return response.body.data.result;
}

test("2.8 advances only after both players continue and finishes exactly once", { timeout: 240_000 }, async () => {
  const host = await actor("continue-h");
  const guest = await actor("continue-g");
  const created = await invoke(host.accessToken, "game", {
    action: "create", requestId: crypto.randomUUID(),
  });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const { roomId, joinCode } = created.body.data;
  assert.equal((await invoke(guest.accessToken, "game", {
    action: "join", joinCode, requestId: crypto.randomUUID(),
  })).status, 200);
  assert.equal((await invoke(host.accessToken, "game", {
    action: "start", roomId, requestId: crypto.randomUUID(),
  })).status, 200);

  const distances = [];
  for (const roundIndex of [1, 2, 3]) {
    const hostAnswer = `Round ${roundIndex}: I would build a small observatory for lost constellations.`;
    const guestAnswer = `Round ${roundIndex}: I would make a quiet map for stars that forgot their names.`;
    assert.equal((await invoke(host.accessToken, "game", {
      action: "submit", roomId, roundIndex, answer: hostAnswer, requestId: crypto.randomUUID(),
    })).status, 200);
    assert.equal((await invoke(guest.accessToken, "game", {
      action: "submit", roomId, roundIndex, answer: guestAnswer, requestId: crypto.randomUUID(),
    })).status, 200);
    distances.push((await evaluate(host.accessToken, roomId, roundIndex)).distance);

    const hostContinueId = crypto.randomUUID();
    const hostContinued = await invoke(host.accessToken, "game", {
      action: "continue", roomId, roundIndex, requestId: hostContinueId,
    });
    assert.equal(hostContinued.status, 200, JSON.stringify(hostContinued.body));
    assert.equal(hostContinued.body.data.phase, "reveal");
    assert.deepEqual(hostContinued.body.data.continued, { a: true, b: false });
    const replayed = await invoke(host.accessToken, "game", {
      action: "continue", roomId, roundIndex, requestId: hostContinueId,
    });
    assert.equal(replayed.status, 200, JSON.stringify(replayed.body));
    assert.equal(replayed.body.data.revision, hostContinued.body.data.revision);

    const guestContinued = await invoke(guest.accessToken, "game", {
      action: "continue", roomId, roundIndex, requestId: crypto.randomUUID(),
    });
    assert.equal(guestContinued.status, 200, JSON.stringify(guestContinued.body));
    if (roundIndex < 3) {
      assert.equal(guestContinued.body.data.phase, "answering");
      assert.equal(guestContinued.body.data.currentRound, roundIndex + 1);
    } else {
      assert.equal(guestContinued.body.data.phase, "finished");
      const valid = distances.filter((distance) => distance !== null);
      const expected = valid.length >= 2
        ? Math.round(valid.reduce((sum, distance) => sum + distance, 0) / valid.length)
        : null;
      assert.deepEqual(guestContinued.body.data.overall, {
        overallDistance: expected,
        validRounds: valid.length,
        totalRounds: 3,
      });
    }
  }

  const finishedReplay = await invoke(host.accessToken, "game", {
    action: "continue", roomId, roundIndex: 3, requestId: crypto.randomUUID(),
  });
  assert.equal(finishedReplay.status, 200, JSON.stringify(finishedReplay.body));
  assert.equal(finishedReplay.body.data.phase, "finished");
  assert.equal(finishedReplay.body.data.revealedRounds.length, 3);
});
