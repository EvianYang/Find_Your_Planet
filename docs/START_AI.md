# C — AI 与题目 Starting Point

你负责回答两个问题：怎样让题目打开联想，以及怎样解释两份答案为什么接近或不同。这里没有互猜预测，也没有对玩家人格的判定。

## 先打开

1. [产品说明](PROJECT.md)：题目不限制类型，人工题库加少量新题。
2. [共同约定](CONTRACTS.md)：第 7 节的评估结构、维度、权重、证据和距离算法。
3. [Agent 规则](../AGENTS.md)。
4. [Notion checklist](https://app.notion.com/p/3e7d830fac0481c8bf0ef203ac15c27e?pvs=204)：先 3.1 和你负责的 0.7/0.8，再 0.6 的模型调用、3.4–3.10，最后 3.2–3.3。

## 第一个交付：前端能用的样例与评估定义

1. 按下方“出题规则”写 39 道英文人工题（13 个方向各 3 道）放进 `_shared/content/prompts.ts`，提供稳定 ID/版本，和 A 试玩审阅。
2. 根据 CONTRACTS 在 `_shared/contracts/evaluation.ts` 建立 Zod schema，由 schema 推导类型。先和 B 确认共用依赖。
3. 在 `src/fixtures/round-results.ts` 提供接近、有差异、未知和技术失败的静态样例，全部标记为演示数据。有效样例覆盖近、中、远。
4. 检查证据逐字属于正确答案；成功样例通过 schema，技术失败使用约定的错误结构，而不是伪造一个未知成功结果。
5. 将输出交给 A，前端无需等待真实模型完成即可工作。

验收：样例结构可验证；null 不等于最大距离；没有 A→B/B→A；没有凭空的人格解释；前端拿到确定的字段和示例。

## 第二个交付：真实单轮比较

在 `_shared/ai/evaluate-pair.ts` 实现比较入口；提示词、schema 校验与距离计算分开。按 CONTRACTS 对答案输入顺序规范化，证据映射回玩家槽位。提供超时/结构错误，不把技术失败变成 insufficient。

B 调用这个函数并管理房间、租约和结果持久化；你不自行更新 room。没有模型凭证先报告，不能让运行时悄悄返回 fixture。服务调用验证完成后再做混合题池的新题生成。

## 出题规则

人工题库和 AI 新题都按这套规则来。核心是天马行空；规则只为让题目好答、好比较，不限制题型和风格。

### 好题标准

- 英文，一句话，只问一个问题，尽量不超过 25 个词（合同上限 180 字符）。
- 调动联想和抽象思维：答案要从题目出发往外跳，而不是从记忆里找现成事实。
- 十秒内能凭直觉开始作答，不需要历史、科学或其他专业知识。
- 以“你”为尺度：设定可以很大，问题要落到个人能直接回答的一点上。
- 有具体的钩子（物件、场景、处境），不要只给抽象名词。
- 没有标准答案：老师能给答案打分的题就不是好题。
- 风格不设限：荒诞、温柔、奇怪、好笑、日常都可以。两个人的答案可能很近，也可能很远，不应该必然很远。

### 要避免

- **推理题、论文题**：要求“推演后果”，或分析制度、文明、历史进程。反例：
  > Humanity discovers how to record dreams before it invents writing. What becomes the first great civilization's most powerful institution?

  它要的是推理和知识，尺度是文明而不是你，还暗含一个“标准答案”。
- **两段式长设定**：先读懂一个世界观，再推一步因果。
- **Loaded question**：题干已经预设了答案方向。
- **没有画面的纯二选一**：只答一个字母时 AI 几乎无从比较。二选一的选项本身要有画面，或者追加一个开放的小问题。
- **同质化**：同一批题不要都用同一种句式、情绪或意象。

### 方向

第一版人工题库按下列 13 个方向各写 3 道。AI 新题也用它们分散方向，但这不是限定清单：可以超出、可以混搭，以后可以增加方向。

1. Weird Powers：奇怪或没用的超能力
2. Would You Rather：荒诞二选一
3. Dilemmas：轻量两难
4. What-If Worlds：改写现实或历史，但落到“你”身上
5. Sensory Swap：通感、自由联想
6. Invent It：发明与设计
7. You're Suddenly…：身份或处境突变
8. Mundane Magic：日常物件活了
9. Perspective Flip：换视角看你或看世界
10. Absurd Debates：没有正确答案的杠精辩论
11. Fill the Story：补全故事
12. Tiny Rules：微小规则改变
13. Hot Takes：离谱观点

### AI 新题生成

- 生成提示只包含本节规则、本次方向和默认避开词。**不传**产品名、slogan、视觉主题（星球、距离、月亮等），也不传人工题库全文或任何示例题，避免模型模仿。和题库的去重在生成后由代码完成。
- 每次请求 2 道题，随机指定两个不同方向，其中一个可以是“不指定”。
- 默认避开的高频意象：moon, star, planet, galaxy, universe, space, orbit, silence, shadow, memory, dream, window, ocean。人工题确有需要可以用，但同一批不要重复。
- 不合格就丢弃，不重试（与 CONTRACTS 第 6 节一致）。

## 文件归属

负责 `_shared/ai/`、`_shared/content/`、`_shared/contracts/evaluation.ts`、`src/fixtures/` 和 `tests/ai/`。距离只在服务端计算，客户端消费最终数值。不要改房间状态、身份或保存规则。

## 可直接发给 agent 的首个任务

> 先读 AGENTS.md、docs/PROJECT.md、docs/CONTRACTS.md 和 docs/START_AI.md。本次完成 checklist 3.1、0.7 的评估结构与 0.8：按出题规则准备 39 道英文开放题、严格评估 schema，以及可供前端使用的有效距离/未知/失败样例。先确认 B 已提供的依赖配置，缺少时报告并协调，不另起项目。保留 fmp-v1 权重、覆盖门槛和计算规则，不添加互猜模式；不调用真实模型、不修改房间或数据库。用必要校验验证样例，说明给 A/B 的导入入口及未完成项。
