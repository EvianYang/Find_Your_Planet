/** Curated English bank: 13 directions x 3 questions. A/C playtesting is still required.
 * UUIDs stay with their questions; increment version when changing wording.
 * Directions are comments only; PromptSchema does not carry a direction field.
 */
export const CURATED_PROMPT_VERSION = "curated-v2";
export const CURATED_PROMPTS = Object.freeze([
  // Weird Powers
  { id: "2273f93c-1208-4a48-a10b-9faa775b5f5c", text: "You can teleport anywhere, but only to places you've seen in a photo. Where do you go first?" },
  { id: "27e6d73d-e0d4-431d-a0b1-6a36c903b4e7", text: "The next animal you see can talk to you for one minute. What do you ask it?" },
  { id: "694cfb30-1af4-4b8d-834e-16b0a30d9c05", text: "You can hear the life story of anything you touch. What in your room do you avoid touching?" },
  // Would You Rather
  { id: "3ab48856-3071-4339-b0de-8233399a862d", text: "Would you rather your life had background music everyone can hear, or subtitles only you can read?" },
  { id: "92465a7c-8c38-46d4-936a-c5495323a1b1", text: "Would you rather your phone could talk but only to complain about you, or your mirror could talk but only to flatter you?" },
  { id: "19594b01-b46d-428d-8873-8c7e94c49e6b", text: "Would you rather be able to see ten minutes into the future, or 150 years into the future?" },
  // Dilemmas
  { id: "de128947-4f63-4800-aad3-082b8bcb0ee1", text: "You can live for 1,000 years, but you have to spend all of them in one place. Would you? If so, where?" },
  { id: "67aa06d0-be7e-48a1-ba25-66cf60eb437b", text: "A button skips the boring parts of your life, but it decides what counts as boring. What are you afraid it would skip?" },
  { id: "88491e20-8d24-4886-baa7-203470d48296", text: "You can learn what one person really thinks of you, but they learn what you think of them. Would you? If so, who?" },
  // What-If Worlds
  { id: "5a6efbf5-4353-4380-bb57-3270da9b0d3a", text: "Dinosaurs never went extinct and share the world with us. What's your job?" },
  { id: "b992a222-3e57-4055-ab25-f3a7540e5f98", text: "Overnight, compliments replace money as the only currency. How do you make a living?" },
  { id: "5936bdad-6393-4b57-839c-5ecdc39e4933", text: "Every human on Earth will fall asleep for 100 years, starting next week. How do you prepare?" },
  // Sensory Swap
  { id: "2984a093-f7c2-4bef-900d-306c88edb532", text: "If you could listen to any sound anywhere in the world right now, what would you hear?" },
  { id: "535cc34b-4bf1-4047-8679-034313115859", text: "If you had entrance music that played every time you walked into a room, what song would it be?" },
  { id: "2e2cc994-ce79-44c9-9951-a38e13945f7b", text: "How would you describe the color blue to someone who has never seen color?" },
  // Invent It
  { id: "abc3d05e-3ee5-49c8-830b-d4c39cb580fa", text: "You can give humans one new sense. What does it detect?" },
  { id: "9d4bd02d-4fa5-43a6-befd-9cbe9fe231f1", text: "You get to add one new law of nature. What is it?" },
  { id: "ef571267-2fde-4728-9d9f-9cfb0d2aa2d8", text: "You can add one new room to every home in the world. What's it for?" },
  // You're Suddenly…
  { id: "6c057c71-3363-47f0-a453-55daacbce95a", text: "You become a vending machine for a day. What do you refuse to sell?" },
  { id: "0243d13b-46d2-476e-bb8e-dbf29762a7cf", text: "You're sent 2,000 years into the past with only what's within arm's reach right now. What's your plan?" },
  { id: "9a822291-9824-4c88-b4ee-c7d22c09e78b", text: "You suddenly gain a superpower based on the last song you listened to. What is it?" },
  // One Message
  { id: "eee82752-bb91-4f01-a52e-05a971ff9fd0", text: "A letter arrives from someone who lived 100 years ago, and you can send one reply. What do you tell them?" },
  { id: "828838ec-4be5-4dfc-89d0-8c22e612b56b", text: "You can ask anyone who has ever lived one question, and they must answer honestly. What do you ask, and to whom?" },
  { id: "9e950df7-8dbf-44a6-aaa4-432650bb3d9f", text: "For one minute, you can write a message across the sky that the whole world can read. What does it say?" },
  // Perspective Flip
  { id: "156dd5a4-4238-4935-9e83-67052f26d928", text: "You're an alien sent to study humans for a year. What's the weirdest thing you report back?" },
  { id: "1281a9c6-1f2a-4dc5-a64a-e0cdb21fe15a", text: "Future you texts you three words, then blocks you. What did it say?" },
  { id: "705962da-f4fe-4789-8958-09504224dfab", text: "You swap bodies with the last person you talked to for 24 hours. What's the first thing you do?" },
  // Absurd Debates
  { id: "c0c1400e-ae94-4ef5-91ba-d058b2b4cf45", text: "Is soup a drink?" },
  { id: "39f88371-38ac-4abc-99ce-c348461e384e", text: "How many holes does a straw have?" },
  { id: "26db8ed4-2c27-42de-ae53-591baaca9e35", text: "Would you rather fight one horse-sized duck or a hundred duck-sized horses?" },
  // Fill the Story
  { id: "6cfd8c93-0dfb-47bd-a313-56e832d40789", text: "Five hundred years from now, history books mention you in exactly one sentence. What does it say?" },
  { id: "7fb25a96-2a97-43d4-abd7-c623e38b4b35", text: "Earth is shutting down for maintenance in three days, and anything unsaved will be deleted. What do you save?" },
  { id: "b1f47f99-ac66-4e38-8204-94d7c006823c", text: "Scientists prove one legendary creature was real all along. Which one, and where has it been hiding?" },
  // New Rules
  { id: "54af9477-eb9a-4930-9985-d895082b1d1a", text: "You can swap the lifespans of any two kinds of living things. Which two do you pick?" },
  { id: "419451ee-a9ed-442d-8d73-75ecd426e0be", text: "Everyone now gets one wish in their lifetime, but every wish is made public. What's yours?" },
  { id: "cca3c36f-2736-4458-8833-e74f8879d1b6", text: "For a whole year, you'll relive the same hour every day, and you get to pick it. Which hour of your life do you choose?" },
  // Hot Takes
  { id: "2572c29b-6c87-4a55-bbfc-ec98bf4a9f2b", text: "What's something everyone pretends to enjoy but secretly doesn't?" },
  { id: "1fc95962-4e3a-4497-9999-f2e3caa3ffce", text: "What normal thing today will people in 200 years find completely ridiculous?" },
  { id: "5ecb35f7-103a-4de0-b0fe-1c77ca9af9c8", text: "What invention would humanity be better off without?" },
].map((prompt) => Object.freeze({
  ...prompt,
  source: "curated" as const,
  version: CURATED_PROMPT_VERSION,
})));
