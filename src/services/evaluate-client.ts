import { FunctionsHttpError } from "@supabase/supabase-js";

import {
  EvaluateResponseSchema,
  type EvaluateResponse,
} from "@contracts/evaluate.ts";

import { getSupabaseClient } from "./supabase-client.ts";

async function readFunctionError(error: unknown): Promise<unknown> {
  if (error instanceof FunctionsHttpError) {
    return error.context.json();
  }
  throw error;
}

export async function evaluateRound(
  roomId: string,
  roundIndex: 1 | 2 | 3,
): Promise<NonNullable<EvaluateResponse["data"]>> {
  const { data, error } = await getSupabaseClient().functions.invoke("evaluate", {
    body: { action: "run", roomId, roundIndex },
  });
  const response = EvaluateResponseSchema.parse(
    error ? await readFunctionError(error) : data,
  );
  if (response.error) {
    throw new Error(`${response.error.code}: ${response.error.message}`);
  }
  return response.data;
}
