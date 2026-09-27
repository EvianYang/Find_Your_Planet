# 3.4 单轮答案比较：审核与接线

状态：通用比较流程与 OpenAI 适配器已实现，gpt-5-mini 的两次真实请求通过结构与证据校验；输出稳定性与房间联调仍待验证。没有用 fixture 冒充模型结果。

## 新增行为

`evaluatePair(input, provider)` 接受未知外部数据，由已有 ComparisonInputSchema 检查，只允许题目和 a/b 两份答案。历史分数、昵称等额外字段直接拒绝。

1. 使用现有输入规则去除首尾空白，限制题目和答案长度。
2. 按 UTF-8 字节序排列答案为 left/right；相同文本固定 A 在前。不做大小写或 Unicode 重写，以保留逐字证据。
3. 把题目、left、right 序列化成 JSON 数据消息，另发送固定系统提示和从 ModelComparisonSchema 导出的 JSON Schema。模型请求不含玩家槽位或其他资料。
4. 一次模型尝试最多20秒。提供方必须传递取消信号、关闭 SDK 重试、返回解码后的 JSON；拒答须抛错。当前没有默认提供方。
5. 使用已有 schema 验证结构、状态及字段限制，再检查证据是否确实来自对应答案。
6. 将 left/right 证据还原为 aEvidence/bEvidence，按现有 fmp-v1 规则计算单轮距离，再用 RoundResultSchema 验证并返回。

交换槽位能保证相同模型输入；独立模型调用本身可能有随机性，因此这不是“两次真实调用必然逐字相同”的保证。测试用确定性适配器验证排序和映射。B 应保存成功结果，刷新不重复请求。

## 文件

- `prompt.ts`：英文比较说明（comparison-v3），三个维度、0–4/null 的含义、证据规则、只比较联想，不判定人格或谁更懂谁。题目/答案视为数据；解释避免 left/right 或 A/B 称呼以免交换署名后混乱。实际抗指令干扰效果仍需真实模型校准。
- `evaluate-pair.ts`：输入检查、UTF-8 排序、有界调用、输出与证据校验、槽位映射。
- `distance.ts`：仅实现本轮所需的 coverage/distance，不实现三轮汇总。权重0.25/0.5/0.25，覆盖不足0.5时返回null，否则按合同生成0–1000整数距离。
- `tests/ai/evaluate-pair.test.ts`：六组自动测试，不调用网络。

JSON Schema 负责向提供方描述输出形状，不能代替本地 Zod 跨字段与证据校验；精确引用检查也不能证明所有语义解释都正确。3.5 的解释规则和验收样例已实现；真实语义稳定性仍需人工复核，3.6/3.9 继续校准。

## B 接入

服务端读取已授权房间的题目和两份完整提交，构造 `{prompt, answers:{a,b}}`。提供 `ComparisonProvider`，其中 modelId 与实际调用模型一致，compare 实现真实服务商请求。服务端密钥只由适配器持有，不进数据消息、返回值或日志。

成功返回已有 RoundResult，B 负责租约、结果发布、持久化和继续下一轮。函数不读写数据库，不调用 UI，也不改变房间阶段。

EvaluationError.code 区分 INVALID_INPUT、INVALID_CONFIGURATION、TIMEOUT、PROVIDER_ERROR、INVALID_OUTPUT、INVALID_EVIDENCE。消息不保留原始提供方错误或答案。B 根据现有公共 API 封装对外返回，技术错误不能转成 insufficient；重试策略由 B 的调度层统一限制，避免多层重试相乘。

## 审核重点

- 模型只给三维相似度和解释，最终距离由服务端计算。
- 线索不足为成功的未知结果；拒答、超时和非法输出为失败。
- 非空证据必须来自正确答案，输出不保留 left/right 字段。
- 输入内容不能扩展为历史分数、个人资料或双向理解分。
- 实际提供方及模型配置确认后，需真实调用并记录结构验证、耗时和交换槽位观察；未完成前不勾选3.4最终验收。

## 已验证

`node --test tests/ai/evaluate-pair.test.ts` 六组通过；测试入口及其导入依赖通过严格 TypeScript 检查。
覆盖槽位交换、UTF-8 与 UTF-16 排序差异、同文答案、额外输入拒绝、错误证据、未知距离、提供方失败无重试及超时取消。

输出语言已由用户确认：所有模型指令和解读使用英文；evidence 不翻译，fmp-v1 不变。

## 3.4 真实请求验证（2026-09-26）

已新增 `openai-provider.ts`，固定请求官方 Responses API，使用 strict JSON Schema、store=false、取消信号，无适配器内自动重试。配置通过调用者注入，不从前端读取；默认网络目标固定，防止本地配置意外把密钥发送至其他服务。

本地验证入口：`node --env-file=supabase/functions/.env.local scripts/check-model.ts`。只发送脚本中的虚构英文答案，运行两次（正常顺序与交换槽位）；日志不输出密钥、答案或完整模型响应，仅记录模型、耗时、状态、距离和证据校验结果。普通测试不会调用网络。

使用本地配置 gpt-5-mini 的成功记录：正常顺序 2588ms，交换后 3091ms；两次 status=ok、coverage=1、distance=0，全部证据属于正确答案，经过 ModelComparisonSchema 和 RoundResultSchema 验证。排序不变另有确定性单元测试覆盖。

限制：此前一次真实尝试返回 INVALID_OUTPUT，被本地校验拒绝，未降级为 insufficient、未发布假结果。随后显式运行两次成功；这不是稳定性保证。错误字段诊断已加入验证脚本，仅打印路径和错误类别。3.9 仍需更广样例校准，3.10/B 调度仍需有限重试、租约与持久化接线。

实现依据：[OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)、[GPT-5 mini](https://developers.openai.com/api/docs/models/gpt-5-mini)。未改评估 schema、权重或距离公式，未接入房间数据库。

## 3.5 具体解释（2026-09-26）

解释规则与三组真实样例初验已完成，广泛稳定性留待 3.9；不是确定性语义保证。

- `prompt.ts` 升为 comparison-v3：解释具体对象、动作与分歧，分别判断意象/联想/意图；只给地点不推断联想或意图。不制造共鸣、差异或人格标签，允许空数组与 null。
- `openai-provider.ts` 将本地已有的 120/100/60 字符限制镜像到请求 JSON Schema。原来的 Unicode 自定义校验不会自动导出这些长度。未改共用 schema、权重或距离算法。推理从 minimal 调到 low，为短句与证据选择留出推理空间；耗时/成本需后续观察。
- `tests/ai/explanation-cases.ts` 提供三个虚构英文样例及人工审核标准，不作为模型提示中的示例。
- `scripts/check-explanations.ts` 显式调用真实模型，每例仅一次，无自动重试。只运行内置虚构样例，输出完整解读供人工审核；不得替换为真实玩家答案并记录日志。普通测试不联网。结构通过不等于语义通过。

运行：`node --env-file=supabase/functions/.env.local scripts/check-explanations.ts`。

最终版本 gpt-5-mini 三例均通过结构、字数、逐字证据和最终结果校验；人工检查无截断、无人格标签：

| 样例 | 人工观察 | 耗时 | 距离 |
| --- | --- | --- | --- |
| 食谱 / 歌曲 | 指出媒介不同，但都通过保存延续家庭传统 | 8353ms | 250 |
| 同一小屋、相反用途 | 识别独处避谈与邀请陌生人交谈的差异 | 5707ms | 750 |
| 只有同一地点 | imagery=4，association/orientation=null；没有编造动机 | 5118ms | null |

失败记录：调整过程中出现超长文本、INVALID_EVIDENCE，以及长度合规但句尾截断的结果。增加请求长度约束、短句/短引用要求与 low 推理后，上述最终批次通过。此前不同版本对同例评分有波动，表中分值仅是本次观察，不是黄金答案；三例通过不代表生产稳定性。没有放宽校验、截断修补返回值或用 fixture 替代失败。

本地验证：29 项测试全部通过，`tsc -b` 及 AI 测试/脚本严格类型检查通过。测试覆盖实际请求中的嵌套长度限制且确认原 schema 不被修改。

A 可审核解释呈现和 null 状态；B 仍需完成真实房间调用、租约、有限重试、持久化与保存白名单验证。handoff 文档全部保留。

## 3.6 输出与证据校验验收（2026-09-26）

状态：C 的函数级验收完成。现有 schema 与 evaluatePair 已实现所需校验，本次补充反例验证，没有修改共用合同、运行时代码、权重或距离算法。

新增 `tests/ai/output-validation.test.ts`，通过实际 evaluatePair 入口验证：

- 顶层及每个维度的缺失/额外字段、类型错误、相似度越界或非整数被拒绝。
- summary/explanation 的120、其他文本数组项的100、证据的60 Unicode码点边界；两项数组允许，三项拒绝；空白引用拒绝；不截断修补非法文本。
- 三维两侧的所有引用均检查归属，包括第二条引用。伪造、串人、大小写改写、空格改写、非连续拼接均拒绝。两份答案确实共有的文本允许被双方引用。
- 非 null 维度必须双侧有证据；insufficient 必须全 null，全 null 不能标为 ok；未知维度若附带证据也必须逐字合法。
- 提供方 HTTP 错误、损坏响应、拒答和非法 JSON 经适配器进入比较函数后均抛技术错误；没有自动重试、fixture 回退或伪造 insufficient。已有测试继续覆盖超时取消和交换槽位映射。

错误边界：解码成功后的结构错误为 INVALID_OUTPUT，引用归属错误为 INVALID_EVIDENCE；在 provider.compare 内抛出的异常由 evaluatePair 统一清洗为 PROVIDER_ERROR（包括适配器发现的非法 JSON），超时为 TIMEOUT。对外不附带原始答案或提供方响应。

验证：`node --test tests/**/*.test.ts` 共35项通过；`npx tsc -b` 及全部测试入口的严格 TypeScript 检查通过。本次不调用真实模型，故不新增模型稳定性结论。

验收边界：逐字引用只能证明文本归属，不能证明解释语义、英文质量或人格推断正确，仍由3.9校准。B仍需在实际接口中封装公共错误、管理重试与持久化；本次不代表房间联调验收，3.7距离专项验收另行进行。

## 3.7 距离与未知规则验收（2026-09-26）

状态：服务端确定性距离规则验收完成。复用现有 `distance.ts`，不修改合同、权重、算法或模型提示词。

新增 `tests/ai/distance.test.ts` 四组测试：13个手算样例覆盖全部8种已知维度组合、覆盖门槛、极值和四舍五入；穷举216种合法评分组合，检查整数范围、未知规则和固定覆盖度下的单调性；通过 evaluatePair 验证最终结果；固定模型评分时交换槽位或改变答案长度不改变距离。

手算代表值（依次为 imagery / association / orientation）：

| 三维评分 | coverage | distance | 原因 |
| --- | --- | --- | --- |
| null / null / null | 0 | null | 没有可评估维度 |
| 4 / null / null | 0.25 | null | 即使已知维度满分，覆盖仍不足 |
| null / 3 / null | 0.5 | 250 | 达到门槛，按有效权重归一化 |
| 4 / null / 0 | 0.5 | 500 | 两个四分之一权重维度共同达到门槛 |
| null / 1 / 3 | 0.75 | 583 | 距离583.333…四舍五入 |
| 1 / 4 / 0 | 1 | 438 | 距离437.5四舍五入 |
| 4 / 4 / 4 | 1 | 0 | 有充分依据的最近端点 |
| 0 / 0 / 0 | 1 | 1000 | 有充分依据的最远端点，区别于未知 |

验证：39项本地测试全部通过；应用 `tsc -b` 与全部测试严格类型检查通过。本次不调用真实模型。测试中的模型结果是明确的受控评分，不是对样例含义的真实模型验收。

限制：算法不使用字数，无法据此证明模型本身不存在长短偏好；该语义部分仍由3.9校准。3.8三轮汇总未在本次实现；A须正确展示null，B仍需实际房间结果发布与持久化联调。

## comparison-v4：解读质量（2026-09-26，待真实模型验收）

真实试玩发现三类问题：summary 复述题干（如 “Both are short global sky-messages”）、unknowns 总是 “No explanation why…” 这类套话、英文解读里夹中文；另有一条 summary 恰好在 120 字符处被截断（请求 JSON Schema 的 maxLength 让生成在上限处停住）。

- `prompt.ts` 升为 comparison-v4：
  - 任何字段都不把题干前提当作洞察；commonality 只写超出题干的共同点，只有题干重合时留空；
  - summary 要说出每份答案对题目的切入角度，以及两者在哪里汇合或分叉；只描述答案，不描述人；附一个与游戏题目无关的强弱对照例；
  - 避免 “Both are X: one …, the other …” 在 X 只是题干时的套路；
  - 字数改为“参考 + 宽硬上限”：summary / explanation 参考 10–16 词、约 100 字符，commonality / divergence / unknowns 每条参考约 90 字符；硬上限放宽为 200 / 160（evidence 仍是 60），统一定义在 `contracts/evaluation.ts` 的 `INTERPRETATION_MAX`、`LIST_ITEM_MAX`、`EVIDENCE_MAX`，提示词、请求 JSON Schema、`records.ts` 与测试都引用这些常量。原来把 120 同时当目标和生成上限，模型会在第 120 个字符处被截断；
  - unknowns 只写会改变比较结论的具体疑问，不写适用于任何短答案的缺口；可以为空；
  - 答案是其他语言时，解读字段仍用英文转述，非英文只允许出现在 evidence 里。
- `openai-provider.ts` 推理强度从 low 调为 medium，`max_output_tokens` 从 2500 调为 5000（推理 token 也计入）；模型改为 gpt-5.4-mini 通过环境变量 `LLM_MODEL` 配置，代码不写死模型。
- 语言检查：`ModelComparisonSchema` 拒绝 summary、explanation、commonality、divergence、unknowns 中的非拉丁字母（如中文），按 INVALID_OUTPUT 处理并走现有自动重试；evidence 不检查，可逐字引用中文答案。检查只在模型输出这一步，不加在 `RoundResultSchema`，已保存的旧结果仍可解析。
- `tests/ai/explanation-cases.ts` 新增三个虚构样例：题干不是洞察、非英文答案、信息多的答案仍要完整放进上限。
- 未改 fmp-v1、字段结构、权重或距离算法；本地校验改了长度上限，并新增模型输出的语言检查。

待验证：用 `scripts/check-explanations.ts` 以 gpt-5.4-mini 跑全部样例，人工检查 summary 与 unknowns，记录耗时（单次调用上限 20 秒）以及是否出现 `incomplete`（medium 的推理 token 也计入 `max_output_tokens: 5000`）或因语言检查触发的 INVALID_OUTPUT。本机没有 `supabase/functions/.env.local`，本次未调用真实模型。

## comparison-v5：对玩家说话的语气与轻量倾向解读（2026-09-26，待真实模型验收）

试玩反馈：共同点和差异语气疏远、缺少分析；中间的 summary 太长，像复述答案（“One goes home; the other goes to school. Both choose familiar everyday places, but the targets differ.”）。经用户确认采用“温和倾向版”，同步修改了 CONTRACTS 第 7 节提示词基线与 PROJECT.md 的解读说明。

- 面向玩家的文字（summary、commonality、divergence、unknowns）对两人共同说话：共同点以 “You both” 开头，差异用 “One of you …, while the other …”；两人看到同一段文字，所以不对单独一人用 “you”，也不用昵称或 A/B。
- 文本支持时，可以用 seems / leans toward / might 这类留有余地的措辞，点出答案流露的思考方式、价值或情感倾向，例如 comfort and belonging versus purpose and routine。只谈本轮答案，轻松而不临床。
- 仍然禁止：固定标签或类型（introvert、selfish 等）；年龄、性别、文化、职业的刻板印象；对关系或契合度下结论；给答案排高低。很短的答案最多用一个留有余地的短语点一下，不编故事，不支持的维度仍为 null。
- summary 改为一句由共同点和差异提炼的短标题：约 5–10 词、60 字符内，不写第二句，不复述答案。
- 维度 explanation 不在揭晓页显示，缩短到 80 字符内，把输出预算留给推理。推理强度保持 medium，硬上限不变（200 / 160 / 60）。
- 对照例子改为展示三种字段的新语气；新增虚构样例 `bare-choices-light-reading`（只给地点的短答案）。
- 已保存的旧结果仍是旧语气，界面照常显示；前端演示 fixture 未改。

## comparison-v6：主观解读思维方式与价值倾向（2026-09-26，待真实模型验收）

试玩反馈：即使答案很长，共同点和差异仍在复述题干和答案内容，不够主观。经用户确认放开 v5 的“不做人格判定”，改为主观解读，并同步修改 CONTRACTS 第 7 节、PROJECT.md 与 START_AI.md 的基线措辞。

- 提示词分成三部分：PART 1 打分（与之前相同，严格依据文本，距离算法不变）、PART 2 解读、FORMAT。
- PART 2 明确“复述即失败”，换成更抽象的词复述也算复述。写之前先私下为每份答案找五个信号：论证方式、责任与主动权归于谁、保护与容忍什么、视野尺度、语气气质；再比较两人的思维方式与价值倾向，找不明显的交汇点。
- 每句话要过三条检验：只看题目写不出来；换成同话题的另外两个答案就不成立；说的是思路、假设、取舍或价值，而不只是话题。
- 可以借用荣格八维 / MBTI 的维度语言，转成日常说法；不输出类型代号或框架名，不宣称给人定型。仍禁止诊断、刻板印象、评判关系或契合度、给答案排高低。
- 示例换成一组虚构的正反对照（删除一项发明：社交媒体 vs 塑料袋）。
- 长度：summary 60 字符内的一句标题；commonality / divergence / unknowns 参考 160 字符内；`LIST_ITEM_MAX` 硬上限从 160 放宽到 240。部署时仍须先部署 `game` 与网页，再部署 `evaluate`。
- 推理强度仍为 medium。若 gpt-5.4-mini 仍停留在复述，下一步考虑 high 或更强的模型。

## comparison-v7 与计分规则 fmp-v2（2026-09-27，待真实模型验收）

试玩时经常出现同样的距离。原因：fmp-v1 只有三维、每维 5 档，满覆盖时只能算出 17 种距离（62.5 的倍数），模型又爱给中间分 2。fmp-v2 改为：

- 模型给两项重合度（imagery、focus，0–4），再对每份答案**分别**画像：leap（0–4）、思维方式四条轴（scope / basis / direction / closure，−2…+2，借用荣格八维 / MBTI 的维度但用日常说法）、价值倾向四组（openness / enhancement / conservation / transcendence，0–3，参照 Schwartz 基本价值理论）。
- 服务端用 `calculateFmpV2` 把各项差距换成 0–1 并加权：联想 0.30、思维方式 0.35、价值倾向 0.35；null 不计入；coverage < 0.5 无距离。分别画像再比较差距，天然对称，也避开了“直接判断像不像”时往中间靠的倾向。
- 同样的随机分数下，fmp-v2 在 2 万组组合里算出 488 种不同距离，最常见的值只占 0.7%。
- 提示词：每个子项写明刻度与例子（“删掉一项发明：社交媒体 vs 塑料袋”，示例距离 224，测试中逐项核对）；要求各自画像时不看另一份答案；null 表示看不出、不是中间分；解读要围绕画像里最接近和最远的地方写，使文字和数字一致。
- 去掉每维 explanation（玩家看不到），证据改为每份答案 1–2 条原文，输出预算留给推理。
- `RoundResultSchema` 同时接受 fmp-v1 与 fmp-v2；已保存的 fmp-v1 结果不重算。记录结构允许 `fmp-v2`。演示 fixture 仍是 fmp-v1。
- 部署：先 `game` 与网页（能读取 fmp-v2），最后 `evaluate`。

## comparison-v8：引用对齐原文（2026-09-27）

真实评估出现 `INVALID_EVIDENCE`：模型约 15.8 秒正常返回，但至少一条引用不是逐字原文。常见原因是抄写时改了空格、全半角、大小写、标点或引号（中英混写的答案尤其容易），整轮因此失败并消耗重试。

- 新增 `_shared/ai/evidence.ts`：`alignQuote` 忽略空白、标点、大小写、全半角与重音，在对应答案里定位同一串文字，返回答案里的原样片段；找不到或对齐后超过 60 字符时返回 null。`alignEvidence` 保留能对齐的引用、去重、丢弃其余。
- `evaluate-pair.ts` 在结构校验之后、原文校验之前对齐两侧引用；保存的仍是原文片段，`createModelComparisonSchema` 的逐字校验不变。丢弃后 status=ok 且某侧为空时仍为 INVALID_EVIDENCE。
- `EvaluationError` 新增 `issues`（字段路径、Zod 错误类型、“leftEvidence: 0/2 matched”这类计数），`evaluate/index.ts` 在每次尝试失败和最终失败时写入日志；不记录答案、引用或模型原始输出。
- 提示词升为 comparison-v8，只加一句：保留全角标点、不要在中英文之间加空格、不要给引用加引号。
- 测试：`tests/ai/evidence.test.ts`（中英混写、全半角、引号、大小写、重音、长度上限、编造与跨答案引用）；`output-validation.test.ts` 改为“能对齐的修正、对不上的丢弃、全丢光才失败”。
- 单次模型调用上限 `EVALUATION_TIMEOUT_MS` 从 20 秒调为 40 秒：medium 推理下一次调用已接近 16 秒。认领和自动重试都会把租约重新计为 60 秒，所以不需要改数据库；一轮最多约 80 秒（两次尝试）后才显示失败。
