/** Runtime copy of the reviewed Markdown prompt; parity is checked in tests. */
export const GENERATION_INSTRUCTIONS = "Write two original, imaginative, open-ended questions in English, one for each supplied direction, in the supplied order.\n\nQuestion-writing rules:\n- Each item must contain one short setup followed by one question asking about just one thing. Two sentences are allowed; do not add a second task.\n- Aim for no more than 25 words across the setup and question together; never exceed 180 Unicode code points per item.\n- Combine a familiar everyday anchor with one unexpected twist that makes the familiar feel strange. Use broadly shared daily experiences rather than a specific location, profession, or specialist situation.\n- Give enough concrete constraints to help the reader begin, while leaving several genuinely different directions open.\n- Invite a small story or a reason, not merely a noun, number, yes/no, or option letter. The same question should allow practical, funny, emotional, or philosophical responses without requiring a particular tone.\n- Invite an imaginative leap rather than recall of a real event or fact.\n- Make it possible to begin answering intuitively within ten seconds, without specialist knowledge.\n- Keep the scale personal and immediately answerable, even if the premise changes reality.\n- Allow different answers without making disagreement inevitable; there is no correct or superior answer.\n- The tone may be absurd, tender, strange, funny, ordinary, or surprising. Vary the two questions in wording, mood, and imagery.\n- Treat each supplied direction as inspiration, not a rigid template. Do not include category labels in the questions.\n- For a choice-based question, make the alternatives vivid enough to inspire a meaningful answer; avoid bare yes/no or A/B choices.\n- Let the single question naturally invite a small story or reason; do not append a separate mandatory \"why\" question or demand a long explanation.\n\nAvoid:\n- Knowledge quizzes, logic puzzles, essays, or predictions about institutions, civilizations, or historical consequences.\n- Long world-building followed by a second reasoning step.\n- Leading questions that assume the reader's feelings, values, or preferred answer.\n- Abstract concepts with no familiar everyday anchor and unexpected twist.\n- Unbounded choices supported only by phrases such as \"any object\", \"anything\", or \"any one thing\", with no other useful constraint.\n- Redundant scenery or multiple hooks that all funnel answers into the same narrow category.\n- Requests for real identifying information, contact details, credentials, or private personal history.\n- Repeated sentence templates, central objects, or emotional framing across the two questions.\n- The supplied overused imagery, including obvious inflections and close variants.\n\nBefore responding, silently check both questions against these rules. Omit any question you cannot make suitable. Do not provide a replacement request, commentary, explanation, score, answer, or category field.\n\nReturn only a JSON object in this exact shape:\n{\"questions\":[{\"text\":\"...\"},{\"text\":\"...\"}]}\n\nThe questions array may contain zero, one, or two items. Each item must contain only text. The object must contain only questions.";
export const GENERATION_USER_TEMPLATE = "Direction 1: {{direction_1}}\nDirection 2: {{direction_2}}\n\nAvoid this overused imagery:\nmoon, star, planet, galaxy, universe, space, orbit, silence, shadow, memory, dream, window, ocean";
export const GENERATION_DIRECTIONS = [
  "Weird Powers: Odd or seemingly useless abilities",
  "Would You Rather: Absurd choices with vivid, distinct possibilities",
  "Dilemmas: Small, playful dilemmas with no correct choice",
  "What-If Worlds: An altered reality grounded in one personal decision",
  "Sensory Swap: Cross-sensory associations",
  "Invent It: Inventing or designing something unexpected",
  "You're Suddenly…: An unexpected change in your role or situation",
  "Mundane Magic: Everyday objects behaving in impossible ways",
  "Perspective Flip: Seeing yourself or something familiar from another perspective",
  "Absurd Debates: Playful disagreements without a factual right answer",
  "Fill the Story: Completing one concrete, unfinished story moment",
  "Tiny Rules: A small change to an everyday rule",
  "Hot Takes: An unusual opinion about something concrete",
  "Unspecified: Choose any imaginative direction; avoid repeating the other question's approach"
] as const;

/** Uniform sampling without replacement; Unspecified can occur at most once. */
export function selectGenerationDirections(random: () => number = Math.random): [string, string] {
  const pool: string[] = [...GENERATION_DIRECTIONS];
  const take = () => {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error("Invalid random value");
    return pool.splice(Math.floor(value * pool.length), 1)[0];
  };
  return [take(), take()];
}

export function buildGenerationUserMessage(directions: [string, string]): string {
  return GENERATION_USER_TEMPLATE.replace("{{direction_1}}", directions[0])
    .replace("{{direction_2}}", directions[1]);
}
