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
  "2.3 lets only a ready room's host start and preserves prompt snapshots",
  { timeout: 60_000 },
  async () => {
    const [host, guest] = await Promise.all([
      createActor("start-host"),
      createActor("start-guest"),
    ]);
    const created = await gameRequest(host.accessToken, {
      action: "create",
      requestId: crypto.randomUUID(),
    });
    assert.equal(created.status, 200);

    const tooEarly = await gameRequest(host.accessToken, {
      action: "start",
      roomId: created.body.data.roomId,
      requestId: crypto.randomUUID(),
    });
    assert.equal(tooEarly.status, 409);
    assert.equal(tooEarly.body.error.code, "CONFLICT");

    const joined = await gameRequest(guest.accessToken, {
      action: "join",
      joinCode: created.body.data.joinCode,
      requestId: crypto.randomUUID(),
    });
    assert.equal(joined.status, 200);

    const guestStart = await gameRequest(guest.accessToken, {
      action: "start",
      roomId: created.body.data.roomId,
      requestId: crypto.randomUUID(),
    });
    assert.equal(guestStart.status, 403);
    assert.equal(guestStart.body.error.code, "UNAUTHORIZED");

    const started = await gameRequest(host.accessToken, {
      action: "start",
      roomId: created.body.data.roomId,
      requestId: crypto.randomUUID(),
    });
    assert.equal(started.status, 200);
    assert.equal(started.body.data.phase, "answering");
    assert.equal(started.body.data.currentRound, 1);
    assert.equal(started.body.data.players.length, 2);
    assert.equal(started.body.data.currentPrompt.source, "curated");
    assert.equal(started.body.data.currentPrompt.version, "curated-v3");

    const guestSnapshot = await gameRequest(guest.accessToken, {
      action: "snapshot",
      roomId: created.body.data.roomId,
    });
    assert.equal(guestSnapshot.status, 200);
    assert.deepEqual(
      guestSnapshot.body.data.currentPrompt,
      started.body.data.currentPrompt,
    );
    assert.equal(guestSnapshot.body.data.revision, started.body.data.revision);

    const repeatedStart = await gameRequest(host.accessToken, {
      action: "start",
      roomId: created.body.data.roomId,
      requestId: crypto.randomUUID(),
    });
    assert.equal(repeatedStart.status, 200);
    assert.deepEqual(
      repeatedStart.body.data.currentPrompt,
      started.body.data.currentPrompt,
    );
    assert.equal(repeatedStart.body.data.revision, started.body.data.revision);

    const { error: directReadError } = await host.client
      .from("rounds")
      .select("prompt_json")
      .limit(1);
    assert.ok(directReadError, "Browser-equivalent round reads must fail.");
  },
);
