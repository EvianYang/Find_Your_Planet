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
  {
    id: "premise-is-not-an-insight",
    input: {
      prompt: "For one minute, you can write a message across the sky that the whole world can read. What does it say?",
      answers: { a: "Good morning, everyone!", b: "Look up and breathe for a second." },
    },
    review: "The reading is about minds, not messages: commonality starts with 'You both' and is not 'you both wrote a sky message'; divergence contrasts thinking style or value (reaching out to connect versus pulling people into the present). The summary is one headline under 60 characters. No type codes or framework names.",
  },
  {
    id: "bare-choices-light-reading",
    input: {
      prompt: "You can teleport anywhere, but only to places you've seen in a photo. Where do you go first?",
      answers: { a: "My grandmother's kitchen.", b: "The library." },
    },
    review: "Association and orientation stay null in the scores. The reading still offers a brief, playful take on the choices (belonging and warmth versus quiet focus, for example) without building a story or restating 'you both chose a place'. The summary is one headline.",
  },
  {
    id: "non-english-answer",
    input: {
      prompt: "Scientists prove one legendary creature was real all along. Which one, and where has it been hiding?",
      answers: {
        a: "A dragon, sleeping under a quiet lake in Scotland.",
        b: "凤凰，一直躲在火山口里，等下一次日出才出来。",
      },
    },
    review: "Every interpretation field is English, with the Chinese idea translated; only evidence quotes may contain Chinese, copied exactly.",
  },
  {
    id: "rich-answers-fit-the-limit",
    input: {
      prompt: "Scientists prove one legendary creature was real all along. Which one, and where has it been hiding?",
      answers: {
        a: "A ghost. It was never in old castles; it hides in the shadows of your own room and only moves when you stop looking.",
        b: "A phoenix. It stays inside a mountain and only appears once a century, when a child who is meant to find it is born.",
      },
    },
    review: "The summary is one headline under 60 characters, never cut off. The reading contrasts minds (the uncanny in everyday life versus fate and rare meaning), not the creatures, with no type codes or stereotypes.",
  },
] as const;
