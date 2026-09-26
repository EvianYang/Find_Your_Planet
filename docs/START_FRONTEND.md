# A — 前端与体验 Starting Point

你负责让玩家读懂玩法、愿意回答，并在揭晓时感受到两颗星的距离。当前没有运行环境，源文件都是占位；不要把它们当成可运行页面。

## 先打开

1. [产品说明](PROJECT.md)：核心体验、保存规则与视觉方向。
2. [共同约定](CONTRACTS.md)：状态、RoundResult、distance=null、保存数据。
3. [Agent 规则](../AGENTS.md)。
4. [Notion checklist](https://app.notion.com/p/3e7d830fac0481c8bf0ef203ac15c27e?pvs=204)：先认领 1.1–1.7，之后 1.8–1.10、4.3、6.2–6.3。

## 第一份任务：一轮样例揭晓

前置：B 完成 0.4 可运行环境和 0.7 共用结构；C 完成 0.8 fixture。等待时可以读文档、画页面草图和确定样式，不自行发明结果结构。

建议依次处理：

1. `src/styles/tokens.css`：夜空、文字、两位玩家的颜色和间距。
2. `src/components/AnswerCard.tsx`：昵称和原文，支持长内容。
3. `src/components/PlanetPair.tsx`：只接收服务端提供的 distance；null 不放在最远处。
4. `src/screens/RevealScreen.tsx`：原文、相似点、差异、继续按钮。
5. 用 `src/fixtures/round-results.ts` 展示近、中、远、未知和失败，说明是演示样例。

验收：手机宽度可读；不同距离位置稳定；null 显示线索不足；失败有重试状态；减少动态效果后仍能理解结果。不要调用模型或数据库，不在组件里生成解读。

## 文件归属

可改 `src/screens/`、`src/components/`、`src/styles/`。`App.tsx` 的临时预览入口先与 B 约定，由 B 整合；不要覆盖 B 的实际流程接线。共用数据定义、services、hooks、后端和距离公式不属于你的默认修改范围。

后续补建房、作答、等待、总结和个人记录页面；星图复杂布局可后做，记录列表不可省略。结果保存是每人独立选择。

## 可直接发给 agent 的首个任务

> 先读 AGENTS.md、docs/PROJECT.md、docs/CONTRACTS.md 和 docs/START_FRONTEND.md。检查 0.4/0.7/0.8 是否已经完成；如果未完成，明确报告缺少的运行环境/类型/fixture，不自建替代接口。本次只实现样例驱动的 AnswerCard、PlanetPair、RevealScreen 和必要样式，对应 checklist 1.5/1.6/1.7。使用既有共用结构，覆盖有效距离、null 和技术失败；不接真实服务、不创建新玩法。说明改了哪些文件、如何查看、哪些状态已验证，未验证不能勾选完成。
