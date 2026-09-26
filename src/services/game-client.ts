import { FunctionsHttpError } from "@supabase/supabase-js";

import {
  GameSnapshotResponseSchema,
  RoomCreatedResponseSchema,
  RoomJoinedResponseSchema,
  type GameSnapshot,
  type RoomCreated,
  type RoomJoined,
} from "@contracts/game.ts";

import { getSupabaseClient } from "./supabase-client.ts";

async function readFunctionError(error: unknown): Promise<unknown> {
  if (error instanceof FunctionsHttpError) {
    return error.context.json();
  }
  throw error;
}

export async function createRoom(requestId = crypto.randomUUID()): Promise<RoomCreated> {
  const { data, error } = await getSupabaseClient().functions.invoke("game", {
    body: { action: "create", requestId },
  });
  const response = RoomCreatedResponseSchema.parse(
    error ? await readFunctionError(error) : data,
  );

  if (response.error) {
    throw new Error(`${response.error.code}: ${response.error.message}`);
  }
  return response.data;
}

export async function joinRoom(
  joinCode: string,
  requestId = crypto.randomUUID(),
): Promise<RoomJoined> {
  const { data, error } = await getSupabaseClient().functions.invoke("game", {
    body: { action: "join", joinCode, requestId },
  });
  const response = RoomJoinedResponseSchema.parse(
    error ? await readFunctionError(error) : data,
  );

  if (response.error) {
    throw new Error(`${response.error.code}: ${response.error.message}`);
  }
  return response.data;
}

export async function startGame(
  roomId: string,
  requestId = crypto.randomUUID(),
): Promise<GameSnapshot> {
  const { data, error } = await getSupabaseClient().functions.invoke("game", {
    body: { action: "start", roomId, requestId },
  });
  const response = GameSnapshotResponseSchema.parse(
    error ? await readFunctionError(error) : data,
  );

  if (response.error) {
    throw new Error(`${response.error.code}: ${response.error.message}`);
  }
  return response.data;
}

export async function getGameSnapshot(roomId: string): Promise<GameSnapshot> {
  const { data, error } = await getSupabaseClient().functions.invoke("game", {
    body: { action: "snapshot", roomId },
  });
  const response = GameSnapshotResponseSchema.parse(
    error ? await readFunctionError(error) : data,
  );

  if (response.error) {
    throw new Error(`${response.error.code}: ${response.error.message}`);
  }
  return response.data;
}

export async function submitAnswer(
  roomId: string,
  roundIndex: 1 | 2 | 3,
  answer: string,
  requestId = crypto.randomUUID(),
): Promise<GameSnapshot> {
  const { data, error } = await getSupabaseClient().functions.invoke("game", {
    body: { action: "submit", roomId, roundIndex, answer, requestId },
  });
  const response = GameSnapshotResponseSchema.parse(
    error ? await readFunctionError(error) : data,
  );

  if (response.error) {
    throw new Error(`${response.error.code}: ${response.error.message}`);
  }
  return response.data;
}
