import { FunctionsHttpError } from "@supabase/supabase-js";

import {
  RoomCreatedResponseSchema,
  RoomJoinedResponseSchema,
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
