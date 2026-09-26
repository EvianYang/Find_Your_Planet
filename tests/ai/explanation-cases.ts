/** Synthetic semantic checks, not player data or prompts sent as demonstrations. */
export const EXPLANATION_CASES = [
  {
    id: "different-objects-shared-mechanism",
    input: {
      prompt: "You can rescue one thing before it is lost. What do you do?",
      answers: {
        a: "I copy my grandmother's handwritten recipe so our family can keep making her bread.",
        b: "I record my grandfather's song so our family can keep singing it.",
      },
    },
    review: "Name recipes and songs as different objects, but recognize preserving family traditions by making a copy.",
  },
  {
    id: "same-place-different-purpose",
    input: {
      prompt: "You can spend a year anywhere without paying rent. Where would you go?",
      answers: {
        a: "A mountain cabin, so I can be alone and escape all conversations.",
        b: "A mountain cabin, so I can invite strangers and host lively conversations every night.",
      },
    },
    review: "Recognize the shared cabin and contrast avoiding conversation with hosting it, without personality labels.",
  },
  {
    id: "intent-not-expressed",
    input: {
      prompt: "You can spend a year anywhere without paying rent. Where would you go?",
      answers: { a: "A mountain cabin.", b: "A mountain cabin." },
    },
    review: "Recognize the shared location but do not invent solitude, sociability, or feelings; association and orientation must be null.",
  },
] as const;
