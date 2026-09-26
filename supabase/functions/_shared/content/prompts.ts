/** Draft bank from PROJECT.md. A/C playtesting is still required.
 * UUIDs stay with their questions; increment version when changing wording.
 */
export const CURATED_PROMPT_VERSION = "curated-v1";
export const CURATED_PROMPTS = Object.freeze([
  { id: "91b264f0-6e12-4df4-9b2a-000000000001", text: "如果世界上可以多一种颜色，你希望它出现在什么地方？" },
  { id: "91b264f0-6e12-4df4-9b2a-000000000002", text: "你能让任何东西向左移动两厘米，每天一次。你准备先做什么？" },
  { id: "91b264f0-6e12-4df4-9b2a-000000000003", text: "一段沉默可以装进行李箱。你会把它带去哪里？" },
  { id: "91b264f0-6e12-4df4-9b2a-000000000004", text: "月亮突然显示“存储空间不足”。你觉得里面存了什么？" },
  { id: "91b264f0-6e12-4df4-9b2a-000000000005", text: "你家门外多出一条昨天不存在的路。它通向哪里？" },
  { id: "91b264f0-6e12-4df4-9b2a-000000000006", text: "如果能给宇宙补上一条说明书，你会写什么？" },
  { id: "91b264f0-6e12-4df4-9b2a-000000000007", text: "明天醒来，所有人的影子都可以请一天假。你的影子会去哪里？" },
  { id: "91b264f0-6e12-4df4-9b2a-000000000008", text: "你收到一张来自未来的收据，上面只有一件商品。是什么？" },
  { id: "91b264f0-6e12-4df4-9b2a-000000000009", text: "如果某一种声音可以长成植物，你想种什么？" },
  { id: "91b264f0-6e12-4df4-9b2a-000000000010", text: "世界忽然多出一个只属于你的节日。人们在那天会做什么？" },
  { id: "91b264f0-6e12-4df4-9b2a-000000000011", text: "你能把一扇窗开在任何东西上。你会开在哪里？" },
  { id: "91b264f0-6e12-4df4-9b2a-000000000012", text: "一只从未见过人类的小动物误把你当作一种天气。它会怎样描述你？" },
].map((prompt) => Object.freeze({
  ...prompt,
  source: "curated" as const,
  version: CURATED_PROMPT_VERSION,
})));
