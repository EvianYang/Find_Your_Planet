/** Runtime copy of the reviewed Markdown prompt; parity is checked in tests. */
export const GENERATION_INSTRUCTIONS = "Write two original, imaginative, open-ended questions in English, one for each supplied direction, in the supplied order.\n\nQuestion-writing rules:\n- Let imagination range across places, eras, cultures, impossible abilities, and changes to the rules of the world. A premise may be enormous, but the decision or response must come down to you.\n- Use plain, conversational English, as if a friend casually asked an intriguing question. Favor an accessible hypothetical-question or short writing-prompt style, without copying published wording.\n- Use a short, clear setup and one central decision. Aim for 25 words or fewer overall; never exceed 180 Unicode code points per item.\n- Present-state hooks are welcome: the last song you listened to or what is within arm's reach right now. Do not require the model to know the reader's actual circumstances.\n- Historical premises must require only common knowledge, never specialist facts or historical analysis.\n- Allow an intuitive response within ten seconds, with room for different practical, funny, emotional, or philosophical answers.\n- Do not assume the reader accepts an offer or wants to use a power. When appropriate, ask \"Would you? If so, where/who?\" rather than assuming a choice with \"Who do you pick?\" These connected questions may express one decision.\n- Make choices concrete and meaningful; avoid vague premises or unexplained stakes.\n- Build in a real trade-off between two things people value, so the answer shows how the reader thinks or what they care about. The premise is a lens; the ask should draw out a reason, not a list, a resume, or a single noun.\n- Vary sentence structure, tone, and imagery across the pair. Directions are inspiration, not category labels to print.\n\nAvoid:\n- Forced quirky personification, such as self-aware kitchen appliances or letters acting as roommates.\n- Requiring familiar everyday anchors or restricting imagination to daily life.\n- Exam-like questions asking the reader to deduce consequences for civilizations, institutions, or historical processes.\n- Trivial tiny-unit gimmicks, such as moving something two centimeters or changing something for one second.\n- Long world-building, knowledge quizzes, logic puzzles, essays, or obscure references.\n- Leading questions that prescribe feelings, values, or a preferred answer.\n- Requests for real identifying details, contact information, credentials, or sensitive private history.\n- The supplied overused imagery, including obvious inflections and close variants.\n\nSilently check both questions. Omit any item you cannot make suitable. Do not supply answers, explanations, scores, categories, examples, or commentary.\nReturn only JSON in this shape:\n{\"questions\":[{\"text\":\"...\"},{\"text\":\"...\"}]}\nThe array may contain zero, one, or two items. Each item contains only text; the object contains only questions.";
export const GENERATION_USER_TEMPLATE = "Direction 1: {{direction_1}}\nDirection 2: {{direction_2}}\n\nAvoid this overused imagery:\nmoon, star, planet, galaxy, universe, space, orbit, silence, shadow, memory, dream, window, ocean";
export const GENERATION_DIRECTIONS = [
  "Weird Powers: Odd or seemingly useless abilities",
  "Would You Rather: Absurd choices with vivid, distinct possibilities",
  "Dilemmas: Small, playful dilemmas with no correct choice",
  "What-If Worlds: An altered reality grounded in one personal decision",
  "Sensory Swap: Cross-sensory associations",
  "Invent It: Inventing or designing something unexpected",
  "You're Suddenly…: An unexpected change in your role or situation",
  "One Message: A meaningful message across people, places, or eras",
  "Perspective Flip: Seeing yourself or something familiar from another perspective",
  "Absurd Debates: Playful disagreements without a factual right answer",
  "Fill the Story: Completing one concrete, unfinished story moment",
  "New Rules: A change to the rules of the world, grounded in your choice",
  "Hot Takes: An unusual opinion about something concrete",
  "Big Debates: A classic life debate with no right answer, asked as one short question with no add-on",
  "Would You, Really?: A value trade-off with a real personal cost, where neither option is the obvious right one",
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
