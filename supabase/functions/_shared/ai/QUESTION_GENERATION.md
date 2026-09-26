# Question generation handoff — task 3.2

Runtime rules now match `generate-prompts.md`, version `question-generation-v2`.

- `generation-prompt.ts` contains the reviewed English system instructions, user-message template and 13 directions plus Unspecified. Code samples two distinct directions before each request.
- `generate-prompts.ts` exports `generatePromptCandidates(generate)`. The provider receives `{instructions, user, signal}`. Send instructions as the system message and user as the user message; disable SDK retries, honor the signal and return decoded JSON. The previous `curatedQuestions` argument has been removed.
- The curated bank is used only in local post-generation deduplication. No bank text, product name, example questions, answers or personal history enters the model request.
- One attempt returns 0–2 candidates within eight seconds. Invalid envelopes fail the attempt; blank or overlong individual texts are discarded. Normalized duplicates within the batch are removed. Accepted candidates use the shared PromptSchema with version `question-generation-v2`.
- The function checks structure, normalization and length, not full semantic quality. English, open-endedness and clear, imaginative premises and personal choices still need the 3.3 quality gate and real-model evaluation. A successful candidate list does not mean that gate has run.

B owns authenticated once-per-room claiming, room persistence, and synchronization with start. Start does not await generation; late completion must be discarded under the same room lock used by start. See `../../game/prepare_prompts/README.md`.

Verification: 24 repository tests, strict TypeScript checking of the generation test and dependencies, and project build passed. Tests cover Markdown/runtime prompt parity, all direction selections, no bank in the request, invalid sibling filtering, batch deduplication, failures and timeout. Tests use fake providers, not real model calls.

Pending: configured real provider, task 3.3 quality gate, and B's room integration. Do not mark full end-to-end acceptance from unit tests alone.
