import { FunctionsHttpError } from "@supabase/supabase-js";

import {
  GameSnapshotResponseSchema,
  PromptGenerationResponseSchema,
  RoomCreatedResponseSchema,
  RoomJoinedResponseSchema,
  type GameSnapshot,
  type PromptGenerationStatus,
  type RoomCreated,
  type RoomJoined,
} from "@contracts/game.ts";

import { getSupabaseClient } from "./supabase-client.ts";
import { throwApiClientError } from "./api-client-error.ts";

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
    throwApiClientError(response.error);
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
    throwApiClientError(response.error);
  }
  return response.data;
}

/**
 * game/prepare_prompts: starts, or reads, the room's single AI question-generation attempt.
 * Optional: the start never waits for it, and a failure only means the curated questions are used.
 */
export async function preparePrompts(roomId: string): Promise<PromptGenerationStatus> {
  const { data, error } = await getSupabaseClient().functions.invoke("game", {
    body: { action: "prepare_prompts", roomId },
  });
  const response = PromptGenerationResponseSchema.parse(
    error ? await readFunctionError(error) : data,
  );
  if (response.error) {
    throwApiClientError(response.error);
  }
  return response.data.status;
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
    throwApiClientError(response.error);
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
    throwApiClientError(response.error);
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
    throwApiClientError(response.error);
  }
  return response.data;
}

export async function continueGame(
  roomId: string,
  roundIndex: 1 | 2 | 3,
  requestId = crypto.randomUUID(),
): Promise<GameSnapshot> {
  const { data, error } = await getSupabaseClient().functions.invoke("game", {
    body: { action: "continue", roomId, roundIndex, requestId },
  });
  const response = GameSnapshotResponseSchema.parse(
    error ? await readFunctionError(error) : data,
  );
  if (response.error) {
    throwApiClientError(response.error);
  }
  return response.data;
}
