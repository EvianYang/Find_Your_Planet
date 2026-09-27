# 3.2 · 少量新题生成

版本：`question-generation-v2`

规则来源：用户最新确认的开放想象标准，取代原“日常锚点＋反常转折”限制。参考 Book of Questions 与 r/WritingPrompts 的平实、开放风格，不复制原文或向模型提供示例题。

本文件提供可直接使用的英文生成提示词，以及 C/B 的调用约定。3.2 独立于 3.1：模型请求不读取或传入人工题库；本地生成后使用已有题库去重。生成后先由本地代码对照已有题库去重；进一步质量筛选、混池与抽题属于 3.3。

提示词、随机方向选择与有界生成流程已在代码中实现并通过单元测试；真实模型调用和房间接口仍待接入、验证。

## 生成目标

在房间等待阶段，一次请求两道英文开放题。让玩家十秒内能凭直觉开始回答，题材允许古今中外、异能或世界规则变化；设定可以很大，问题落到“你”身上。历史只涉及常识，允许此刻状态作为钩子，避免刻意拟人、微小单位噱头和含糊设定。两题使用不同方向，并尽量采用不同句式、情绪和意象。

每道题由一个短设定加一个问题组成，只问一件事；可用“Would you? If so, where/who?”表达一个决定，不预设玩家接受设定中的提议。设定与问题合计尽量不超过 25 个英文单词，硬上限为 180 个 Unicode code points。题目应自然引出一个小故事或一个理由，而不只得到名词、数字或选项字母；同一题允许务实、好笑、感伤或哲学等不同回答方向。没有标准答案，不考专业知识，不要求长篇解释，也不预设玩家应该有什么感受。

## 调用前选择方向

从下列方向中随机选择两个不同方向；可以将“不指定”作为一个候选，因此最多一题不指定方向。选择发生在代码中，不让模型自行决定两个方向。

| 方向值 | 传给模型的说明 |
| --- | --- |
| Weird Powers | Odd or seemingly useless abilities |
| Would You Rather | Absurd choices with vivid, distinct possibilities |
| Dilemmas | Small, playful dilemmas with no correct choice |
| What-If Worlds | An altered reality grounded in one personal decision |
| Sensory Swap | Cross-sensory associations |
| Invent It | Inventing or designing something unexpected |
| You're Suddenly… | An unexpected change in your role or situation |
| One Message | A meaningful message across people, places, or eras |
| Perspective Flip | Seeing yourself or something familiar from another perspective |
| Absurd Debates | Playful disagreements without a factual right answer |
| Fill the Story | Completing one concrete, unfinished story moment |
| New Rules | A change to the rules of the world, grounded in your choice |
| Hot Takes | An unusual opinion about something concrete |
| Unspecified | Choose any imaginative direction; avoid repeating the other question's approach |

方向是灵感提示，不要求模型在题目中写出分类名，也不限制后续增加或混合方向。

## System prompt

下面代码块是完整的模型指令。不要把本文件其余交接说明一起发送给模型。

```text
Write two original, imaginative, open-ended questions in English, one for each supplied direction, in the supplied order.

Question-writing rules:
- Let imagination range across places, eras, cultures, impossible abilities, and changes to the rules of the world. A premise may be enormous, but the decision or response must come down to you.
- Use plain, conversational English, as if a friend casually asked an intriguing question. Favor an accessible hypothetical-question or short writing-prompt style, without copying published wording.
- Use a short, clear setup and one central decision. Aim for 25 words or fewer overall; never exceed 180 Unicode code points per item.
- Present-state hooks are welcome: the last song you listened to or what is within arm's reach right now. Do not require the model to know the reader's actual circumstances.
- Historical premises must require only common knowledge, never specialist facts or historical analysis.
- Allow an intuitive response within ten seconds, with room for different practical, funny, emotional, or philosophical answers.
- Do not assume the reader accepts an offer or wants to use a power. When appropriate, ask "Would you? If so, where/who?" rather than assuming a choice with "Who do you pick?" These connected questions may express one decision.
- Make choices concrete and meaningful; avoid vague premises or unexplained stakes.
- Vary sentence structure, tone, and imagery across the pair. Directions are inspiration, not category labels to print.

Avoid:
- Forced quirky personification, such as self-aware kitchen appliances or letters acting as roommates.
- Requiring familiar everyday anchors or restricting imagination to daily life.
- Exam-like questions asking the reader to deduce consequences for civilizations, institutions, or historical processes.
- Trivial tiny-unit gimmicks, such as moving something two centimeters or changing something for one second.
- Long world-building, knowledge quizzes, logic puzzles, essays, or obscure references.
- Leading questions that prescribe feelings, values, or a preferred answer.
- Requests for real identifying details, contact information, credentials, or sensitive private history.
- The supplied overused imagery, including obvious inflections and close variants.

Silently check both questions. Omit any item you cannot make suitable. Do not supply answers, explanations, scores, categories, examples, or commentary.
Return only JSON in this shape:
{"questions":[{"text":"..."},{"text":"..."}]}
The array may contain zero, one, or two items. Each item contains only text; the object contains only questions.
```

## User message 模板

运行时仅替换下面两个方向占位符，每个占位符使用上表的方向值及说明。默认避开词原样保留。

```text
Direction 1: {{direction_1}}
Direction 2: {{direction_2}}

Avoid this overused imagery:
moon, star, planet, galaxy, universe, space, orbit, silence, shadow, memory, dream, window, ocean
```

不发送产品名、slogan、视觉主题、人工题库、示例题、玩家答案、昵称、身份信息、历史记录或历史分数。避开词只作为负面约束出现，不能作为出题主题。

## 输出与本地检查

模型原始输出保持合同约定：`{questions:[{text}]}`，不让模型生成 ID、版本或来源字段。

- 严格检查 JSON 结构：顶层只有 `questions`，数组最多两项，每项只有字符串 `text`。结构错误或超过两项时，本次结果作废。
- 文本进行 Unicode NFKC 规范化和首尾去空白，再按 Unicode code points 检查 1–180 字符；空题或超长题丢弃。
- 规范化后检查本次两题是否重复，重复仅保留一题。不通过校验的题不补生成、不重试。
- 25 个词是写作目标，不另设与合同冲突的硬长度上限。
- 英文、短设定加单问题、开放想象与个人决定、多方向回答空间、可独立理解和开放性属于质量检查；提示词要求不等于模型必然遵守。明显不合格的候选应丢弃，完整质量筛选在 3.3 接入。
- 对照人工题库的去重在模型返回后由本地 seen 集合执行；题库内容不进入模型请求。
- 合格候选由服务端补充稳定 ID、`source: "generated"`、`version: "question-generation-v2"`，形成已有 `Prompt` 结构。ID 在首次接受候选时生成，保存、刷新或重复读取时不重新生成。

## 一次有界调用

1. B 在 `game / prepare_prompts` 验证身份、房间成员和 lobby 阶段，并确保同一房间只领取一次生成任务。
2. C 的生成实现随机选择方向，用以上消息发起一次服务端模型请求。模型与凭证沿用 0.6 确认的配置。
3. 从请求开始设置八秒上限，覆盖请求与响应读取；超时结束等待，并向底层请求发送取消信号。关闭 SDK 自带自动重试，不做修复 JSON 的第二次模型调用。
4. 成功时返回 0–2 道候选；超时、拒答、网络错误或非法结构均结束本次尝试，返回空候选及内部失败原因。不用静态题伪装成生成成功。
5. 生成不得成为开始游戏的前置等待条件。开始游戏只使用已经可用的合格题目；迟到结果不得替换已开始游戏的题目。

内部结果应能区分“成功但无候选”和“技术失败”；由 B 映射到现有响应封装，不新增房间阶段。日志只记录请求 ID、错误类别、耗时和版本，不记录凭证或玩家内容。

## 文件与协作边界

- 本文件：C 维护生成提示词与规则。
- `_shared/ai/generate-prompts.ts`：已实现通用调用、超时和输出检查；`generation-prompt.ts` 保存与本文一致的英文提示词与方向配置，由测试检查一致性。真实提供方适配器仍待接入。
- `game / prepare_prompts`：B 维护认证、一次性任务领取与房间状态。
- 3.3：生成后的题库去重、质量检查、混池、抽题、开局与写回竞态。

生成结果写回和开始游戏需锁同一房间；写回时再次确认仍为 lobby，已经开始则丢弃。此数据库规则由 B 实现，不能只靠生成函数中的一次阶段判断。

## 验收清单

- [ ] 不依赖人工题库即可构造生成请求。
- [ ] 每次选择两个不同方向，最多一个为 Unspecified。
- [ ] 请求仅包含出题规则、本次方向、默认避开词及输出格式。
- [ ] 真实模型输出可解析，接受后的候选数量为 0–2。
- [ ] 设定可跨时代或改变世界规则，问题落到个人决定；短设定加问题只问一件事，不因两句表达而拒绝。
- [ ] 同题可自然引出不同方向的小故事或理由，不局限于名词、数字或选项字母。
- [ ] 排除无约束的无限选择、特定经历门槛、多余场景及把答案推向单一类别的钩子。
- [ ] 空白、超长、额外字段、非法 JSON、超过两项和重复题有对应检查。
- [ ] 八秒超时会结束等待；底层忽略取消或迟到完成也不会继续发布结果。
- [ ] 超时、拒答和网络错误不触发任何自动重试。
- [ ] 玩家开始游戏不需要等待生成完成，迟到结果不改变已定题目。
- [ ] 记录真实调用结果与耗时后再验收；提示词文件存在不等于运行验证通过。
