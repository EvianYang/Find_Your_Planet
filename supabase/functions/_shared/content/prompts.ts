/** Curated English bank, grouped by direction (group sizes vary). A/C playtesting is still required.
 * UUIDs stay with their questions; increment version when changing wording.
 * Directions are comments only; PromptSchema does not carry a direction field.
 */
export const CURATED_PROMPT_VERSION = "curated-v3";
export const CURATED_PROMPTS = Object.freeze([
  // Weird Powers
  { id: "27e6d73d-e0d4-431d-a0b1-6a36c903b4e7", text: "The next animal you see can talk to you for one minute. What do you ask it?" },
  { id: "ead46d83-a234-49d7-8a84-0ee56582e714", text: "You get one superpower, but it only works when nobody is watching. What do you want it to be?" },
  { id: "863f8892-fc55-4498-8268-389f7bf3bbe5", text: "You wake up tomorrow with one new ability, but you have to give up one you already have. What's the trade?" },
  // Would You Rather
  { id: "92465a7c-8c38-46d4-936a-c5495323a1b1", text: "Would you rather your phone could talk but only to complain about you, or your mirror could talk but only to flatter you?" },
  { id: "19594b01-b46d-428d-8873-8c7e94c49e6b", text: "Would you rather be able to see ten minutes into the future, or 150 years into the future?" },
  { id: "e2c68c77-c7ab-4f6f-9f64-a73cf07621b8", text: "Would you rather be able to talk to animals, or speak every human language?" },
  // Dilemmas
  { id: "de128947-4f63-4800-aad3-082b8bcb0ee1", text: "You can live for 1,000 years, but you have to spend all of them in one place. Would you? If so, where?" },
  { id: "67aa06d0-be7e-48a1-ba25-66cf60eb437b", text: "A button skips the boring parts of your life, but it decides what counts as boring. Would you press it, and why?" },
  { id: "88491e20-8d24-4886-baa7-203470d48296", text: "You can learn what one person really thinks of you, but they learn what you think of them. Would you? If so, who?" },
  // What-If Worlds
  { id: "5a6efbf5-4353-4380-bb57-3270da9b0d3a", text: "Dinosaurs never went extinct and share the world with us. What's your job?" },
  { id: "5936bdad-6393-4b57-839c-5ecdc39e4933", text: "Every human on Earth will fall asleep for 100 years, starting next week. How do you prepare?" },
  { id: "d9a6a8c3-1b2a-474b-91c9-9ac815e8ae91", text: "Money disappears tomorrow, and everything you need is free. What would you still work hard at?" },
  // Sensory Swap
  { id: "2984a093-f7c2-4bef-900d-306c88edb532", text: "If you could listen to any sound anywhere in the world right now, what would you hear?" },
  { id: "2e2cc994-ce79-44c9-9951-a38e13945f7b", text: "How would you describe the color blue to someone who has never seen color?" },
  // Invent It
  { id: "abc3d05e-3ee5-49c8-830b-d4c39cb580fa", text: "You can give humans one new sense. What does it detect?" },
  { id: "ef571267-2fde-4728-9d9f-9cfb0d2aa2d8", text: "You can add one new room to every home in the world. What's it for?" },
  { id: "1e1d783d-4717-4203-8eab-56374541e2d5", text: "You can add one holiday that the whole world celebrates. What is it for?" },
  // You're Suddenly…
  { id: "6c057c71-3363-47f0-a453-55daacbce95a", text: "You become a vending machine for a day. What do you refuse to sell?" },
  { id: "832fe007-5e5f-4bb4-93fe-f65499b994e5", text: "You wake up 30 years older, with no memory of how you got there. What's the first thing you check?" },
  { id: "4b8dabef-804b-4120-9553-7c2dcfe8c27b", text: "You're suddenly the most famous person in the world for one day. What do you do with it?" },
  // One Message
  { id: "eee82752-bb91-4f01-a52e-05a971ff9fd0", text: "A letter arrives from someone who lived 100 years ago, and you can send one reply. What do you tell them?" },
  { id: "828838ec-4be5-4dfc-89d0-8c22e612b56b", text: "You can ask anyone who has ever lived one question, and they must answer honestly. What do you ask, and to whom?" },
  { id: "9e950df7-8dbf-44a6-aaa4-432650bb3d9f", text: "For one minute, you can write a message across the sky that the whole world can read. What does it say?" },
  // Perspective Flip
  { id: "156dd5a4-4238-4935-9e83-67052f26d928", text: "You're an alien sent to study humans for a year. What's the weirdest thing you report back?" },
  { id: "1281a9c6-1f2a-4dc5-a64a-e0cdb21fe15a", text: "Future you texts you three words, then blocks you. What did it say?" },
  { id: "23b6d513-5a47-480d-8ed5-0b9a3b65c3fc", text: "A stranger watches one ordinary day of your life. What do they get completely wrong about you?" },
  // Absurd Debates
  { id: "c0c1400e-ae94-4ef5-91ba-d058b2b4cf45", text: "Is soup a drink?" },
  { id: "94a282de-b652-4675-9609-9b285bcc91db", text: "Is a story still the same story if you read it backwards?" },
  // Fill the Story
  { id: "6cfd8c93-0dfb-47bd-a313-56e832d40789", text: "Five hundred years from now, history books mention you in exactly one sentence. What does it say?" },
  { id: "b1f47f99-ac66-4e38-8204-94d7c006823c", text: "Scientists prove one legendary creature was real all along. Which one, and where has it been hiding?" },
  { id: "c56de182-6a79-4dc1-83b9-84440100aab5", text: "A stranger stops you on the street and says, \"It's you. I've been waiting.\" What do you think they are waiting for?" },
  // New Rules
  { id: "54af9477-eb9a-4930-9985-d895082b1d1a", text: "You can swap the lifespans of any two kinds of living things. Which two do you pick?" },
  { id: "3be87825-9e92-4129-99b7-5c84456965c1", text: "Starting tomorrow, every lie you tell comes true. Would you still lie? About what?" },
  // Hot Takes
  { id: "2572c29b-6c87-4a55-bbfc-ec98bf4a9f2b", text: "What's something everyone pretends to enjoy but secretly doesn't?" },
  { id: "1fc95962-4e3a-4497-9999-f2e3caa3ffce", text: "What normal thing today will people in 200 years find completely ridiculous?" },
  { id: "5ecb35f7-103a-4de0-b0fe-1c77ca9af9c8", text: "What invention would humanity be better off without?" },
  // Big Debates
  { id: "4e7a8f35-965d-40f9-bf22-80ded2b145d3", text: "Do opposites attract, or do birds of a feather flock together?" },
  { id: "ac90cbf8-1f47-479f-a44b-895282decb48", text: "Can people really change, or do they just get better at hiding who they are?" },
  { id: "25d5e75e-f8da-474d-a3f5-837efd0a2d5f", text: "Is it better to be right or to be kind?" },
  { id: "85fdc8d2-fe66-4b6e-9bb2-9ad8e1e244fd", text: "Should you follow your heart or your head?" },
  { id: "572c5d41-9096-4f10-b35d-87b0fbab135e", text: "Is there such a thing as \"meant to be,\" or is it all luck?" },
  // Would You, Really?
  { id: "b4cb2356-8470-44d5-9e3f-deb41380bfd4", text: "Would you rather be deeply understood by one person, or liked by everyone?" },
  { id: "33bf3bba-d95f-4478-abb1-f5a0bd310ab0", text: "A machine can tell you how compatible you are with anyone. Would you use it on someone you already love?" },
  { id: "6c3276dc-8614-43dc-ad74-d6adc78e3535", text: "Would you rather be remembered forever, or be truly happy and forgotten?" },
  { id: "64aee67b-6714-4cf5-ae33-2e8e4c3c3a22", text: "Which matters more in a best friend: always being honest with you, or always being on your side?" },
].map((prompt) => Object.freeze({
  ...prompt,
  source: "curated" as const,
  version: CURATED_PROMPT_VERSION,
})));
