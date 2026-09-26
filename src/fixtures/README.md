# 0.8 · 揭晓界面演示样例

从 `round-results.ts` 导入 `ROUND_RESULT_FIXTURES`，或按需导入 `closeRound`、`mediumRound`、`farRound`、`partialRound`、`insufficientRound`、`technicalFailureRound`。这些是手写演示数据，不来自实时模型；页面展示 `label`，不得作为真实请求失败后的回退。

每项包含 `isDemo`、`scenario`、`label`、`prompt`、`players`、`answers` 和 `response`。内层题目、玩家、答案及响应都使用现有 contracts 校验；外层仅是演示页面元数据，不是另一个业务接口。

| 样例 | 距离 | 展示行为 |
| --- | --- | --- |
| closeRound | 0 | 近位置，展示相似联想 |
| mediumRound | 500 | 中位置，共同意象但展开不同 |
| farRound | 1000 | 远位置，展示具体差异 |
| partialRound | null | 部分可解释：保留共同意象解读，但不设置量化终点 |
| insufficientRound | null | 展示线索不足，不设置量化终点 |
| technicalFailureRound | 无结果 | 显示 error.message 和重试入口，不显示评语或假距离 |

前端先检查 `response.error`。成功且 `response.data.status === 'ready'` 时读取 `response.data.result`，并根据 players 的 A/B 槽位对应 answers.a/b 与 aEvidence/bEvidence。技术失败仍处于分析阶段，演示包中的 answers 只用于测试上下文，不代表真实失败接口可以揭晓双方答案。

星体组件仅消费已给定的距离，不重新评分。有效距离按合同映射边缘间距：0/500/1000 对应 48/144/240；null 不应落到最远位置。重试按钮行为需由演示宿主或真实接口接线，本文件不调用模型。

验证：`node --test tests/fixtures/round-results.test.ts`，五组测试通过，覆盖共用结构、评分一致性、证据逐字归属、未知与技术失败区别；项目类型检查通过。A 仍需实际打开界面核对六种状态后确认 0.8 展示验收。


A 揭晓交接补充：所有样例解读现为英文，昵称为 Alex (demo) / Sam (demo)；演示标识也由外层 label 和 isDemo 保留。模型输出语言已统一为英文，详见 CONTRACTS 与 comparison-v3；evidence 仍逐字保留原答案。

两类未知都没有量化距离，但含义不同：
- `status === "insufficient"`：全部维度无从判断，本样例 coverage=0。
- `status === "ok" && coverage < 0.5`：部分维度可解释，但不足以计算距离；partialRound 只有 imagery=4，coverage=0.25、distance=null。

前端直接使用现有 status/coverage 区分两类，不新增业务字段。partial 只是演示选择器的 scenario 标签。技术失败仍为 error 响应，不属于上述任一类未知。
