# Question generation handoff — tasks 3.1 / 3.2

`../content/prompts.ts` exports `CURATED_PROMPTS`: the twelve PROJECT drafts, with fixed UUIDs, source and version. Keep each ID when editing its question and increment its version. A/C still need to try answering the questions before accepting 3.1.

`generate-prompts.ts` exports `generatePromptCandidates(generate)`. Supply a server-side `QuestionGenerator` adapter using the provider/model confirmed in 0.6. It receives only instructions, curated question text and an AbortSignal. Disable provider SDK retries, pass the signal to the network call, and return decoded JSON matching `{questions:[{text}]}`. Credentials stay inside that adapter. No provider is assumed or configured here.

One invocation makes one attempt, capped at eight seconds, and returns 0–2 candidates. Timeout, provider failure and invalid output return an empty list with a reason. Successful empty output or duplicate-only output returns `empty`. These are internal generation states, not new room phases or public API response formats. No logging, database writes, room updates or fallback model calls occur here.

Zod is imported through the bare `zod` specifier. B must configure the team's agreed dependency/version for the Edge runtime under 0.4; this change does not initialize a second project or fix a competing dependency version. The existing shared game schema remains B-owned and is still a placeholder.

## B integration: game / prepare_prompts

- Authenticate and check room membership and lobby phase using the existing contract.
- Claim generation once per room, then call the helper outside the database transaction. Repeated requests must not create repeated attempts.
- Apply task 3.3's content quality checks before accepting candidates. The helper validates structure, length and normalized exact duplicates; its prompt instructions are not a semantic quality validator.
- On completion, lock the same room used by start. Persist eligible candidates only if it is still in the lobby; otherwise discard the late result.
- Start must never await generation: draw three questions from the already stored eligible pool, using the manual bank when necessary, and freeze the snapshots.
- Map internal outcome to the team's existing response envelope. No HTTP handler or room state machine is introduced by C.

## Verification

`tests/ai/generate-prompts.test.ts` covers bank integrity, permitted request data, output validation, Unicode length, deduplication, provider failure, the eight-second deadline and ignored late completion. Tests use fake providers and do not verify live model access. Run with a TypeScript-capable Node test runner after the shared dependencies are configured.

Local check on 2026-09-26: all six tests passed, and strict TypeScript checking passed using an isolated temporary copy (Node 25.1.0, TypeScript 5.6.3, Zod 3.23.8). These temporary test versions do not establish the team's dependency baseline or verify the Supabase runtime.

Pending acceptance: A/C question playtest; 0.6 real provider call; B's authenticated once-per-room integration; task 3.3 semantic quality checks and start/write race verification. Do not mark either checklist item fully accepted based only on these files.
