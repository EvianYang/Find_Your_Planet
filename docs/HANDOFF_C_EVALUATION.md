# C — Evaluation 接口交接

状态：评估 schema 已实现，game.ts 已组合 GameSnapshotSchema；fixture 与真实接口接线尚待完成。本文是一次交接说明，不替代 Notion checklist 或 `CONTRACTS.md`。

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

- Supabase、模型供应商与真实服务调用均未配置或验证。
- `evaluate/run` 租约、重试、持久化和房间状态推进属于后续 B/C 联调，不在本次脚手架交付内。

## 0.7 本次交付

C 已实现三个要求的 schema 及派生类型，另提供输入相关证据校验、evaluate 请求/响应 schema；game.ts 已完成上文组合动作。详细导入入口、响应格式及验收证据见 CONTRACTS.md 的“0.7 代码交接”。本次不实现 0.8 fixture 或服务端模型调用。

## 0.8 样例交付（2026-09-26）

`src/fixtures/round-results.ts` 已提供近、中、远、线索不足、可重试技术失败五项手写演示数据。使用方式与状态表见 `src/fixtures/README.md`；未知为成功结果且 distance=null，技术失败为 data=null 的公共错误响应。三组 fixture 测试与类型检查通过；待 A 展示验收，不把样例视为真实模型结果。
