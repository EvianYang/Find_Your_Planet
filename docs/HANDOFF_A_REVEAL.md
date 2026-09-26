# A — 揭晓界面交接（1.5 / 1.6 / 1.7）

状态：代码已交付、待联调。本文是一次交接说明，不替代 Notion checklist 或 `CONTRACTS.md`；未通过真实接口验收前不勾选任务。设计依据是 repo 外的揭晓原型 v0.4（深蓝夜空、A 带环 / B 带小卫星、信封 / 信号 / 小旗三个状态符号）。

## 本次交付

| 文件 | 内容 |
| --- | --- |
| `src/styles/tokens.css`、`global.css` | 颜色、字体、间距、动效时长 token；全局基础样式与减少动态效果 |
| `src/components/planet-geometry.ts` | 固定画布几何、`edgeGap`（gap = 48 + 192 × distance / 1000）、休息位、两类未知的判断 |
| `src/components/Asteroid.tsx` | 小行星图形（扁平双色、暗面排线、手绘墨线）与昵称旁的小徽记 |
| `src/components/PlanetPair.tsx` | 只消费服务端 `distance` / `status`；有效距离落在测距轴，null 停在休息位并显示未测绘区；分析中信号交错；失败时信号变淡 |
| `src/components/AnswerCard.tsx` | 按槽位显示昵称与原文；本人密封、对方密封、对方未作答三种揭晓前状态 |
| `src/screens/RevealScreen.tsx` | 原文 → 摘要 → 双星落位（约 1.9 秒，可跳过、Esc 同效）；分析中、技术失败、重试中、重试耗尽、等待对方继续；第 3 轮按钮为 See the full game |
| `src/screens/RevealPreview.tsx` | 仅演示：用 C 的 fixture 切换样例、状态、查看者、轮次、宽度、是否首次揭晓 |

实现约束：动效只用 CSS，没有新增依赖；字体先回退到系统字体；页面不自动滚动，舞台已离开视口时星体直接落位；刷新后（`animate={false}`）直接渲染完成态；减少动态效果时无位移、180ms 淡入；每次换轮或换阶段都会重新挂载，旧计时器不会覆盖新状态。组件不计算距离、不生成解读。

## 验证

- `npm run typecheck`、`npm run build` 通过。
- 本地临时挂载预览入口，用 puppeteer 驱动 Chrome 检查 26 项，全部通过：
  - 0 / 500 / 1000 的星体位置与公式一致；null 停在休息位，没有测距线和数字，也不在最远处；
  - 技术失败不显示评语和距离；重试中按钮不可再点；Check again 只更新查询说明；
  - 分析中看不到对方原文；
  - 跳过后焦点落在摘要，完成后读屏播报摘要；播放中切换到失败，旧计时器不覆盖新状态；
  - 刷新态没有动画；本人继续后焦点在等待行；对方先继续有提示；第 3 轮文案正确；
  - B 视角下 You 标签归属正确；320 宽无横向溢出，按钮 ≥ 44px；
  - 减少动态效果时直接到终态；无 React 报错（只有缺 favicon 的 404）。
- 未验证：真机、读屏软件实际朗读、与真实 snapshot 联调。
- 预览入口没有提交：`App.tsx` 归 B，下文请 B 接入。

## 需要团队决定

**模型解读的输出语言。** 题库与界面是英文，但 `CONTRACTS.md` §7（“输出严格结构化中文”）和 `_shared/ai/prompt.ts`（“解释用简短中文”）要求中文。如果改为英文，需要 C 更新提示词与 fixture，并同步 CONTRACTS。在此之前，界面会出现英文题目配中文解读。

## 给 B 的请求

1. **snapshot 增加查看者槽位**（例如 `viewerSlot: SlotSchema`）。现在只有 `ownAnswer`，前端无法判断哪份答案是自己的、You 标签给谁。CONTRACTS §5 写了“以稳定 profile_id 识别原来的槽位”，但 snapshot 没有暴露。1.4、1.5 必需。
2. **snapshot 增加房间码**（例如 `joinCode`）。目前只有 create 的响应里有，房主刷新后大厅无法再显示房间码。1.2 需要。
3. **区分三种评估失败相关状态**。`evaluationState` 只有 `failed`，前端还需要知道：
   - 失败但可重试，剩余几次；
   - 重试次数已用完；
   - 失败后的重试正在进行（区别于首次分析）。
   字段形状由你定（例如 `manualRetriesLeft` 加上 `lastErrorCode`）。没有剩余次数字段时，界面只写“Either of you can retry.”。
4. **finished 阶段告诉前端“我是否已保存”**（例如 `savedByMe`），否则刷新后总结页会再次显示保存按钮。1.8 需要。
5. **房间码的长度与字符集**。schema 目前是 1–32 个字符，加入页的格式提示需要确定值。
6. **接线**：
   - `main.tsx` 引入 `./styles/global.css`；
   - `App.tsx` 增加演示入口 `/?preview=reveal` 渲染 `RevealPreview`；
   - `useGameSession` 把 snapshot 映射成 `RevealScreen` 的 `RevealStatus`；
   - `animate` 表示“本设备第一次看到这一轮揭晓”，例如用 roomId + roundIndex 记在 sessionStorage。
7. **错误显示**：界面按错误码显示自己的英文文案，不直接显示服务端的 `message`。请确认这个做法，并保证错误码与 CONTRACTS 一致。
8. **可选依赖**：是否自托管字体（`@fontsource-variable/bricolage-grotesque`、`@fontsource-variable/figtree`、`@fontsource/caveat`）。当前实现不需要 GSAP。
9. **小事**：`public/` 缺 favicon（开发时有 404）；记录列表没有总条数，前端只根据 `nextCursor` 显示 Show more。

### 可直接发给 B 的 agent

> 先读 AGENTS.md、docs/CONTRACTS.md 和 docs/HANDOFF_A_REVEAL.md。本次只做 A 请求中与 B 相关的第 1–6 项，不改 A 的 screens/components/styles，不改 C 的评估定义。
> 1. 在 `_shared/contracts/game.ts` 的 snapshot 中加入查看者槽位和房间码，并为评估失败提供“剩余手动重试次数 / 是否已耗尽 / 是否为失败后的重试”的信息；finished 阶段加入本人是否已保存。字段名和形状由你按现有 schema 风格决定，全部用 Zod 定义并推导类型，同步更新 CONTRACTS.md。
> 2. 确定房间码长度与字符集，写进 CONTRACTS 与 schema。
> 3. `main.tsx` 引入 `./styles/global.css`；`App.tsx` 增加 `/?preview=reveal` 渲染 `src/screens/RevealPreview.tsx`，保留现有 preview 入口和真实流程接线。
> 4. 在 `useGameSession` 中把 snapshot 映射到 `RevealScreen` 的 `RevealStatus` 与 `animate`（本设备首次看到该轮揭晓才为 true）。
> 完成后运行 typecheck、build 与现有测试，列出改了哪些字段、哪些行为已验证、哪些仍待联调。不提交密钥，不自动推送。

## 给 C 的请求

1. **补一个“部分可解释”的未知样例**：`status: "ok"`、`coverage < 0.5`、`distance: null`，例如只有 imagery 可评估，coverage 为 0.25。现有 `insufficientRound` 只覆盖“完全缺少线索”。前端据此区分两种未知的文案与画面。
2. **fixture 文案改成英文**（summary、commonality、divergence、unknowns、explanation），与英文题目和界面一致；昵称里去掉“（演示）”，演示身份由外层 `label` 表达即可。技术失败样例的 `message` 可以保留，界面不会直接显示它。
3. **确认两类未知的判定**：`status = insufficient` 与 `status = ok 且 coverage < 0.5`。前端只用这两个已有字段区分，不新增字段。
4. **输出语言**：若团队决定解读用英文，请同步 `prompt.ts`、CONTRACTS §7 与评估测试。

### 可直接发给 C 的 agent

> 先读 AGENTS.md、docs/CONTRACTS.md、docs/HANDOFF_C_EVALUATION.md 和 docs/HANDOFF_A_REVEAL.md。本次只改 `src/fixtures/round-results.ts`、`src/fixtures/README.md` 和 `tests/fixtures/round-results.test.ts`，不改 A 的界面代码，不改 B 的 game/identity/records 定义。
> 1. 新增一个明确标为演示的“部分可解释”样例：`status: "ok"`，只有部分维度可评估，coverage < 0.5，distance 必须为 null，并通过 `RoundResultSchema` 与逐字证据校验。
> 2. 把现有样例的 summary、commonality、divergence、unknowns、explanation 改成简短英文，保持原有含义、证据逐字属于正确答案；昵称去掉“（演示）”，演示身份只放在 label。
> 3. 在 README 说明两类未知分别是 `status = insufficient` 与 `status = ok 且 coverage < 0.5`。
> 如团队已决定解读输出改为英文，再另开任务同步 `prompt.ts` 与 CONTRACTS §7，本次不改。完成后运行 fixture 测试与 typecheck，说明改动和验证结果，不调用真实模型。

## A/B 合同变更通知（用户已确认，2026-09-26）

网站与发给模型的文字统一为英文。C 本次将比较指令升级 comparison-v2，summary/explanation/commonality/divergence/unknowns 输出英文，evidence 仍逐字引用原答案；fmp-v1、schema 和距离算法不变。生成使用 question-generation-v2 的更新规则，不再要求日常锚点；题库只用于生成后的本地去重。请 A 验收英文排版、B 接线英文错误文案与提供方配置。本通知保留以上尚未完成的 B 请求，不代表其已完成。
