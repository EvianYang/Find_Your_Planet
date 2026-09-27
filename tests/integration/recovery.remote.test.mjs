import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
assert.ok(url && key, "Set the Supabase variables in .env.local.");

async function anonymous() {
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInAnonymously();
  assert.ifError(error);
  const accessToken = data.session?.access_token;
  assert.ok(accessToken);
  return { client, accessToken };
}

async function invoke(accessToken, functionName, body) {
  const response = await fetch(`${url}/functions/v1/${functionName}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function createProfile(label) {
  const actor = await anonymous();
  const nickname = `${label.slice(0, 10)}-${crypto.randomUUID().slice(0, 8)}`;
  const response = await invoke(actor.accessToken, "identity", {
    action: "create",
    nickname,
    requestId: crypto.randomUUID(),
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return { ...actor, identity: response.body.data };
}

test("2.9 transfers identity, rotates codes and invalidates old sessions safely", { timeout: 90_000 }, async () => {
  const original = await createProfile("recover-original");
  assert.ok(original.identity.recoveryCode);
  const originalProfileId = original.identity.profile.id;

  const replacement = await anonymous();
  const recoverRequestId = crypto.randomUUID();
  const recovered = await invoke(replacement.accessToken, "identity", {
    action: "recover",
    recoveryCode: original.identity.recoveryCode,
    requestId: recoverRequestId,
  });
  assert.equal(recovered.status, 200, JSON.stringify(recovered.body));
  assert.equal(recovered.body.data.profile.id, originalProfileId);
  assert.ok(recovered.body.data.recoveryCode);
  const secondCode = recovered.body.data.recoveryCode;

  const replay = await invoke(replacement.accessToken, "identity", {
    action: "recover",
    recoveryCode: original.identity.recoveryCode,
    requestId: recoverRequestId,
  });
  assert.equal(replay.status, 200, JSON.stringify(replay.body));
  assert.equal(replay.body.data.profile.id, originalProfileId);
  assert.equal(replay.body.data.recoveryCode, undefined);

  const oldMe = await invoke(original.accessToken, "identity", { action: "me" });
  assert.equal(oldMe.status, 200, JSON.stringify(oldMe.body));
  assert.equal(oldMe.body.data.profile, null);
  const oldGameAccess = await invoke(original.accessToken, "game", {
    action: "create", requestId: crypto.randomUUID(),
  });
  assert.equal(oldGameAccess.status, 401, JSON.stringify(oldGameAccess.body));

  const attacker = await anonymous();
  const oldCode = await invoke(attacker.accessToken, "identity", {
    action: "recover",
    recoveryCode: original.identity.recoveryCode,
    requestId: crypto.randomUUID(),
  });
  assert.equal(oldCode.status, 400, JSON.stringify(oldCode.body));
  assert.equal(oldCode.body.error.code, "RECOVERY_FAILED");

  const finalOwner = await anonymous();
  const secondRecovery = await invoke(finalOwner.accessToken, "identity", {
    action: "recover", recoveryCode: secondCode, requestId: crypto.randomUUID(),
  });
  assert.equal(secondRecovery.status, 200, JSON.stringify(secondRecovery.body));
  assert.equal(secondRecovery.body.data.profile.id, originalProfileId);
  assert.ok(secondRecovery.body.data.recoveryCode);

  const rotationRequestId = crypto.randomUUID();
  const rotated = await invoke(finalOwner.accessToken, "identity", {
    action: "rotate_recovery", requestId: rotationRequestId,
  });
  assert.equal(rotated.status, 200, JSON.stringify(rotated.body));
  assert.ok(rotated.body.data.recoveryCode);
  const rotationReplay = await invoke(finalOwner.accessToken, "identity", {
    action: "rotate_recovery", requestId: rotationRequestId,
  });
  assert.equal(rotationReplay.status, 200, JSON.stringify(rotationReplay.body));
  assert.equal(rotationReplay.body.data.recoveryCode, undefined);
  assert.equal(
    rotationReplay.body.data.profile.credentialVersion,
    rotated.body.data.profile.credentialVersion,
  );

  const occupied = await createProfile("recover-occupied");
  const room = await invoke(occupied.accessToken, "game", {
    action: "create", requestId: crypto.randomUUID(),
  });
  assert.equal(room.status, 200, JSON.stringify(room.body));
  const blocked = await invoke(occupied.accessToken, "identity", {
    action: "recover",
    recoveryCode: rotated.body.data.recoveryCode,
    requestId: crypto.randomUUID(),
  });
  assert.equal(blocked.status, 409, JSON.stringify(blocked.body));
  assert.equal(blocked.body.error.code, "RECOVERY_TARGET_NOT_EMPTY");
});
