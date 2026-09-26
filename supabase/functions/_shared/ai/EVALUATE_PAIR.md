# 3.4 单轮答案比较：审核与接线

状态：通用比较流程已实现、单元测试通过；0.6 的服务商/模型尚未确认，真实模型适配器及真实请求验收待完成。没有用 fixture 冒充模型结果。

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

- `prompt.ts`：中文比较说明，三个维度、0–4/null 的含义、证据规则、只比较联想，不判定人格或谁更懂谁。题目/答案视为数据；解释避免 left/right 或 A/B 称呼以免交换署名后混乱。实际抗指令干扰效果仍需真实模型校准。
- `evaluate-pair.ts`：输入检查、UTF-8 排序、有界调用、输出与证据校验、槽位映射。
- `distance.ts`：仅实现本轮所需的 coverage/distance，不实现三轮汇总。权重0.25/0.5/0.25，覆盖不足0.5时返回null，否则按合同生成0–1000整数距离。
- `tests/ai/evaluate-pair.test.ts`：六组自动测试，不调用网络。

JSON Schema 负责向提供方描述输出形状，不能代替本地 Zod 跨字段与证据校验；精确引用检查也不能证明所有语义解释都正确。3.5/3.6/3.9 后续继续打磨提示词与校准。

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
