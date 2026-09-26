# C — Evaluation 接口交接

状态：C 的首个交付六项已完成并通过本地测试，game.ts 已组合 GameSnapshotSchema；A 展示验收和 B/C 真实接口联调仍待完成。本文是一次交接说明，不替代 Notion checklist 或 `CONTRACTS.md`。

## 已由 B 固定

- 根目录使用 npm；React、Vite、TypeScript 与 Zod 版本见 `package.json` 和 lockfile。
- 浏览器代码使用裸导入 `zod`；Edge Functions 通过 `supabase/functions/deno.json` 映射到同一版本。
- 游戏、身份、记录 schema 位于 `supabase/functions/_shared/contracts/`。
- `game.ts` 导出 `createGameSnapshotSchema(roundResultSchema)`。它是 C 接入前的组合边界，避免 B 复制评估结构。
- `records.ts` 只保存白名单字段，不保存完整答案或 evidence。

## C 的首个交付

请按 `docs/START_AI.md` 与 `docs/CONTRACTS.md` 第 7 节完成：

1. 在 `_shared/contracts/evaluation.ts` 实现严格 Zod schema，并从 schema 推导类型。
2. 至少导出 `DimensionResultSchema`、`ModelComparisonSchema`、`RoundResultSchema` 及相应推导类型。
3. 最终 `RoundResult` 使用 `aEvidence` / `bEvidence`，不暴露模型内部的 left/right 字段。
4. `distance` 必须是 0–1000 的整数或 `null`；`coverage` 为 0–1；`rubricVersion` 固定为 `fmp-v1`。
5. 在 `src/fixtures/round-results.ts` 提供明确标为演示的近、中、远、未知和技术失败样例。
6. 有效 fixture 必须通过 `RoundResultSchema`；技术失败使用 API 错误结构，不能冒充 `insufficient`。

建议导出名称：

```ts
export const DimensionResultSchema = ...;
export const ModelComparisonSchema = ...;
export const RoundResultSchema = ...;

export type DimensionResult = z.infer<typeof DimensionResultSchema>;
export type ModelComparison = z.infer<typeof ModelComparisonSchema>;
export type RoundResult = z.infer<typeof RoundResultSchema>;
```

## B/C 接线动作

C 提交 `RoundResultSchema` 后，B 将在 `game.ts` 中导出最终结构：

```ts
import { RoundResultSchema } from "./evaluation.ts";

export const GameSnapshotSchema = createGameSnapshotSchema(RoundResultSchema);
export type GameSnapshot = z.infer<typeof GameSnapshotSchema>;
```

联调需验证：

- 揭晓前的 snapshot 不含对方答案或中间评估。
- `insufficient` 是有效结果；超时、拒答、结构或 evidence 校验失败是技术失败。
- A/B 交换不改变比较含义，evidence 仍映射到正确槽位。
- `null` 不映射为最大距离，前端不重新计算距离。
- 保存记录时移除答案与 evidence，只保留 `records.ts` 的白名单字段。
- fixture 不会在真实运行时作为模型失败回退。

## 尚未验证

- 已有 Supabase 身份实现；本次未运行远端验证，不把代码或历史提交视为新的服务验收。模型提供方适配器与真实模型调用仍未验收。
- `evaluate/run` 租约、重试、持久化和房间状态推进属于后续 B/C 联调，不在本次脚手架交付内。

## 0.7 本次交付

C 已实现三个要求的 schema 及派生类型，另提供输入相关证据校验、evaluate 请求/响应 schema；game.ts 已完成上文组合动作。详细导入入口、响应格式及验收证据见 CONTRACTS.md 的“0.7 代码交接”。本次不实现 0.8 fixture 或服务端模型调用。

## 0.8 样例交付（2026-09-26）

`src/fixtures/round-results.ts` 已提供近、中、远、线索不足、可重试技术失败五项手写演示数据。使用方式与状态表见 `src/fixtures/README.md`；未知为成功结果且 distance=null，技术失败为 data=null 的公共错误响应。三组 fixture 测试与类型检查通过；待 A 展示验收，不把样例视为真实模型结果。

## 英文输出决定（2026-09-26）

用户确认网站、模型指令、解读、fixture 与测试样例均用英文。comparison-v2 已同步 CONTRACTS，evidence 保留原文、fmp-v1 不变。A/B 交接通知见 HANDOFF_A_REVEAL.md；B 的未完成接线事项继续保留。


## 本次完成核对与证据（2026-09-26）

| 交接项 | 当前结论 |
| --- | --- |
| 严格评估 schema 与派生类型 | 已实现，结构/范围/额外字段测试通过 |
| 模型 left/right 到结果 A/B 证据 | 交换槽位、原文引用和映射测试通过 |
| fmp-v1 距离与覆盖度 | 覆盖门槛、数值一致性和 null 测试通过 |
| 近、中、远、未知、技术失败 fixture | 已完成；补充 partialRound 后共六种英文展示样例 |
| 共用 GameSnapshotSchema 组合 | 已实现且测试通过 |
| 技术失败不冒充 insufficient | 错误封装、超时与非法输出测试通过 |
| 收藏不接受原文或 evidence | schema 白名单测试通过；真实保存处理器仍待 B 联调 |
| fixture 不作为运行时回退 | 当前服务端、services、hooks 无 fixture 引用；真实调用失败流程仍待接线验收 |

验证命令：`node --test tests/**/*.test.ts`，27 项全部通过；对所有测试及其导入依赖执行严格 TypeScript 检查通过；`npm run build`（含 tsc -b）通过。构建仅有 Zod 依赖注释提示，不影响产物。

新增 partialRound：status=ok、coverage=0.25、distance=null，仅 imagery 可判断；与 insufficient 的完全缺少线索明确区分。所有演示文案英文，所有证据逐字属于正确答案。

尚不可勾选真实联调：揭晓前网络与订阅的数据保护、模型真实输出、评估租约/持久化/有限重试、收藏保存时实际剥离原文与证据、前端真实 snapshot 映射及 null 展示。上述需要 A/B 接线和真实设备流程验证，不能以本地单测代替。

保留本文和 HANDOFF_A_REVEAL.md；C 首个交付完成不代表 B 的交接任务已完成。

## 3.4 最新进展

OpenAI Responses 适配器已接入，gpt-5-mini 正常/交换槽位两次真实调用均通过结构与逐字证据校验，耗时2588/3091ms。此前一次 INVALID_OUTPUT 已如实记录，稳定性仍待3.9校准。具体入口与证据见 `_shared/ai/EVALUATE_PAIR.md`；本结果只更新模型调用部分，不代表 B 的租约、重试、持久化或房间联调已完成。

## 3.5 最新进展

comparison-v3 已落实具体共鸣/分歧、独立维度、无依据为 null、禁止人格标签的解释规则；未改合同结构或 fmp-v1。请求镜像原有字数限制，OpenAI 推理使用 low。三组虚构英文真实样例最终批次通过结构、逐字证据和人工解释审核（8353/5707/5118ms），覆盖不同对象同机制、相同地点相反目的、缺少意图。此前超长、截断及证据失败记录保留在 `_shared/ai/EVALUATE_PAIR.md`；不能据此声称整体稳定性已通过。

本地29项测试与类型检查通过。3.9仍需扩大样例并校准评分；A展示验收、B房间接线/租约/有限重试/持久化/收藏剥离原文仍待完成。本文和HANDOFF_A_REVEAL.md继续保留。

## 3.6 最新进展

C的输出与证据校验函数级验收完成。新增 `tests/ai/output-validation.test.ts` 六组测试，覆盖结构/字段范围、Unicode长度及数量边界、三维两侧全部引用的逐字归属、status与null一致性，以及真实适配器配合模拟传输的失败链路。35项本地测试全部通过，应用与测试严格类型检查通过。

现有实现通过反例验证，本次未改共用schema或运行时行为，不调用真实模型。错误分类与完整验收证据见 `_shared/ai/EVALUATE_PAIR.md` 的3.6章节。B须继续完成公共错误封装、有限重试与持久化；A展示验收仍保留，语义质量留待3.9。3.7依赖的本地校验基础已具备，但本次不将3.7或房间联调标为完成。

## 3.7 最新进展

服务端距离与未知规则的确定性验收完成，现有distance.ts无需修改。新增 `tests/ai/distance.test.ts`：13个手算样例、全部216种合法评分组合、覆盖边界/舍入/极值、固定评分下长度与槽位不影响距离。39项测试、应用及测试类型检查通过，未调用真实模型。

验收证据见 `_shared/ai/EVALUATE_PAIR.md` 的3.7章节。保持fmp-v1及全部合同不变。模型的短句偏好与语义合理性仍待3.9校准；3.8三轮汇总、A的null展示与B房间联调尚未在本次完成。所有既有handoff继续保留。
