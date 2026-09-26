import assert from "node:assert/strict";
import test from "node:test";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function requireConfiguration() {
  assert.ok(
    supabaseUrl && publishableKey,
    "Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local.",
  );
}

function createTestClient() {
  requireConfiguration();
  return createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function createActor(label) {
  const client = createTestClient();
  const { data: authData, error: authError } =
    await client.auth.signInAnonymously();
  assert.ifError(authError);
  assert.ok(authData.session?.access_token);

  const { data, error } = await client.functions.invoke("identity", {
    body: {
      action: "create",
      nickname: `${label}-${crypto.randomUUID().slice(0, 8)}`,
      requestId: crypto.randomUUID(),
    },
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

test(
  "2.2 creates idempotently and serializes concurrent joins at two players",
  { timeout: 60_000 },
  async () => {
    const [host, contenderOne, contenderTwo] = await Promise.all([
      createActor("room-host"),
      createActor("room-guest"),
      createActor("room-guest"),
    ]);
    const createRequestId = crypto.randomUUID();
    const created = await gameRequest(host.accessToken, {
      action: "create",
      requestId: createRequestId,
    });
    assert.equal(created.status, 200);
    assert.equal(created.body.error, null);
    assert.match(created.body.data.joinCode, /^[A-Z2-9]{8}$/);

    const repeatedCreate = await gameRequest(host.accessToken, {
      action: "create",
      requestId: createRequestId,
    });
    assert.equal(repeatedCreate.status, 200);
    assert.equal(repeatedCreate.body.data.roomId, created.body.data.roomId);
    assert.equal(repeatedCreate.body.data.joinCode, created.body.data.joinCode);

    const joinBody = {
      action: "join",
      joinCode: created.body.data.joinCode.toLowerCase(),
      requestId: crypto.randomUUID(),
    };
    const joinResults = await Promise.all([
      gameRequest(contenderOne.accessToken, joinBody),
      gameRequest(contenderTwo.accessToken, {
        ...joinBody,
        requestId: crypto.randomUUID(),
      }),
    ]);
    assert.deepEqual(
      joinResults.map((result) => result.status).sort((a, b) => a - b),
      [200, 409],
    );

    const joined = joinResults.find((result) => result.status === 200);
    const rejected = joinResults.find((result) => result.status === 409);
    assert.equal(joined?.body.data.roomId, created.body.data.roomId);
    assert.equal(rejected?.body.error.code, "ROOM_FULL");

    const winningActor = joinResults[0].status === 200
      ? contenderOne
      : contenderTwo;
    const repeatedJoin = await gameRequest(winningActor.accessToken, {
      action: "join",
      joinCode: created.body.data.joinCode,
      requestId: crypto.randomUUID(),
    });
    assert.equal(repeatedJoin.status, 200);
    assert.equal(repeatedJoin.body.data.roomId, created.body.data.roomId);

    const { error: directReadError } = await host.client
      .from("participants")
      .select("room_id")
      .limit(1);
    assert.ok(directReadError, "Browser-equivalent participant reads must fail.");
  },
);
