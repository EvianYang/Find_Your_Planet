# C — AI 与题目 Starting Point

你负责回答两个问题：怎样让题目打开联想，以及怎样解释两份答案为什么接近或不同。这里没有互猜预测，也没有对玩家人格的判定。

## 先打开

1. [产品说明](PROJECT.md)：题目不限制类型，人工题库加少量新题。
2. [共同约定](CONTRACTS.md)：第 7 节的评估结构、维度、权重、证据和距离算法。
3. [Agent 规则](../AGENTS.md)。
4. [Notion checklist](https://app.notion.com/p/3e7d830fac0481c8bf0ef203ac15c27e?pvs=204)：先 3.1 和你负责的 0.7/0.8，再 0.6 的模型调用、3.4–3.10，最后 3.2–3.3。

## 第一个交付：前端能用的样例与评估定义

1. 把 PROJECT 中 12 道人工题草案放进 `_shared/content/prompts.ts`，提供稳定 ID/版本，和 A 试玩审阅；不把题型限定成超能力。
2. 根据 CONTRACTS 在 `_shared/contracts/evaluation.ts` 建立 Zod schema，由 schema 推导类型。先和 B 确认共用依赖。
3. 在 `src/fixtures/round-results.ts` 提供接近、有差异、未知和技术失败的静态样例，全部标记为演示数据。有效样例覆盖近、中、远。
4. 检查证据逐字属于正确答案；成功样例通过 schema，技术失败使用约定的错误结构，而不是伪造一个未知成功结果。
5. 将输出交给 A，前端无需等待真实模型完成即可工作。

验收：样例结构可验证；null 不等于最大距离；没有 A→B/B→A；没有凭空的人格解释；前端拿到确定的字段和示例。

## 第二个交付：真实单轮比较

在 `_shared/ai/evaluate-pair.ts` 实现比较入口；提示词、schema 校验与距离计算分开。按 CONTRACTS 对答案输入顺序规范化，证据映射回玩家槽位。提供超时/结构错误，不把技术失败变成 insufficient。

B 调用这个函数并管理房间、租约和结果持久化；你不自行更新 room。没有模型凭证先报告，不能让运行时悄悄返回 fixture。服务调用验证完成后再做混合题池的新题生成。

## 文件归属

负责 `_shared/ai/`、`_shared/content/`、`_shared/contracts/evaluation.ts`、`src/fixtures/` 和 `tests/ai/`。距离只在服务端计算，客户端消费最终数值。不要改房间状态、身份或保存规则。

## 可直接发给 agent 的首个任务

> 先读 AGENTS.md、docs/PROJECT.md、docs/CONTRACTS.md 和 docs/START_AI.md。本次完成 checklist 3.1、0.7 的评估结构与 0.8：准备约 12 道开放题、严格评估 schema，以及可供前端使用的有效距离/未知/失败样例。先确认 B 已提供的依赖配置，缺少时报告并协调，不另起项目。保留 fmp-v1 权重、覆盖门槛和计算规则，不添加互猜模式；不调用真实模型、不修改房间或数据库。用必要校验验证样例，说明给 A/B 的导入入口及未完成项。
