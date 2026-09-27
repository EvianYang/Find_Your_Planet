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

function createMemoryStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function createTestClient(storage) {
  requireConfiguration();

  return createClient(supabaseUrl, publishableKey, {
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function signIn(client) {
  const { data, error } = await client.auth.signInAnonymously();
  assert.ifError(error);
  assert.ok(data.user?.is_anonymous, "Expected a Supabase anonymous user.");
  return data.user;
}

async function invokeIdentity(client, body) {
  const { data, error } = await client.functions.invoke("identity", { body });
  assert.ifError(error);
  assert.equal(data?.error, null);
  return data.data;
}

test(
  "2.1 keeps same-nickname identities separate and restores each mapping",
  { timeout: 30_000 },
  async () => {
    const nickname = `test-${crypto.randomUUID().slice(0, 8)}`;
    const storageA = createMemoryStorage();
    const storageB = createMemoryStorage();
    const clientA = createTestClient(storageA);
    const clientB = createTestClient(storageB);

    const [userA, userB] = await Promise.all([
      signIn(clientA),
      signIn(clientB),
    ]);
    assert.notEqual(userA.id, userB.id);

    const [identityA, identityB] = await Promise.all([
      invokeIdentity(clientA, {
        action: "create",
        nickname,
        requestId: crypto.randomUUID(),
      }),
      invokeIdentity(clientB, {
        action: "create",
        nickname,
        requestId: crypto.randomUUID(),
      }),
    ]);

    assert.equal(identityA.profile.nickname, nickname);
    assert.equal(identityB.profile.nickname, nickname);
    assert.notEqual(identityA.profile.id, identityB.profile.id);
    assert.equal(typeof identityA.recoveryCode, "string");
    assert.equal(typeof identityB.recoveryCode, "string");

    const restoredClientA = createTestClient(storageA);
    const {
      data: { session: restoredSession },
      error: sessionError,
    } = await restoredClientA.auth.getSession();
    assert.ifError(sessionError);
    assert.equal(restoredSession?.user.id, userA.id);

    const restoredA = await invokeIdentity(restoredClientA, { action: "me" });
    const currentB = await invokeIdentity(clientB, { action: "me" });
    assert.equal(restoredA.profile.id, identityA.profile.id);
    assert.equal(currentB.profile.id, identityB.profile.id);

    const repeatedA = await invokeIdentity(restoredClientA, {
      action: "create",
      nickname,
      requestId: crypto.randomUUID(),
    });
    assert.equal(repeatedA.profile.id, identityA.profile.id);
    assert.equal(repeatedA.recoveryCode, undefined);

    const { error: directReadError } = await restoredClientA
      .from("profiles")
      .select("id")
      .limit(1);
    assert.ok(directReadError, "Browser-equivalent profile reads must fail.");
  },
);
