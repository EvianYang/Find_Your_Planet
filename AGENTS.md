# Find my planet — Agent rules

本仓库已建立文档、目录与明确标记的源文件占位。当前没有可运行应用、依赖配置、数据库或部署；占位文件中的 export {} 不是功能实现。只有收到具体开发任务后才实现对应代码。

## 先读

1. [docs/PROJECT.md](docs/PROJECT.md)：产品目标与范围。
2. [docs/CONTRACTS.md](docs/CONTRACTS.md)：接口、状态、AI、数据与权限。
3. [Notion：Find my planet — Development Checklist](https://app.notion.com/p/3e7d830fac0481c8bf0ef203ac15c27e?pvs=204)中的当前任务、依赖、负责人和验收。

这是现有 GitHub 仓库 Find_Your_Planet，不要重命名仓库或工作目录。产品规划名称为 Find my planet；README 保留团队已有的英文介绍。本仓库不复制旧 Same Moon 归档。进度以 Notion 为准，不另建重复 ROADMAP。

## 个人 starting point

- A：[前端与体验](docs/START_FRONTEND.md)
- B：[后端与整合](docs/START_BACKEND.md)
- C：[AI 与题目](docs/START_AI.md)

B 先建立开发运行环境和共用结构，再让 A 接样例、C 接真实评估。禁止为绕过依赖而各自初始化另一套项目。

## 不得改变的产品基线

- 产品名称 Find my planet；已有仓库目录保留 Find_Your_Planet；slogan“两颗星之间的距离，两颗心之间的距离。”
- 双人同题独立作答，三轮，每轮一个对称距离；不加入预测步骤或双向理解分。
- 每局独立，允许不同题组，不锁定跨局个人答案。
- 人工题库加少量 AI 新题后随机抽取；不限制题型，新题失败不阻塞开局。
- 每人自主保存当局距离和解读，个人榜按记录排序，同一伙伴可多条；不保存完整原始答案。
- 保存/排序/找回属于主线；互猜、公开榜、聊天、复杂账号管理不进入当前范围。
- AI 解释必须有依据，unknown 不是最大距离；不得伪造实时调用。

## 文件归属

A/前端：src/screens、components、styles；主导体验与手机验收。
B/后端：src/services、hooks、App.tsx 接线、supabase/migrations、game、evaluate 调度、records、identity、部署配置。
C/AI：supabase/functions/_shared/ai、content、评估 schema、src/fixtures、评估测试。
共用 contracts：B 维护游戏/记录/身份，C 维护评估；改动先告知其他负责人并更新 CONTRACTS.md。前端只导入纯类型与 schema，不导入服务端模块。不同负责人使用独立分支，由 B 整合；不替他人删除或覆盖未完成工作。

## 每项任务怎么做

确认任务编号、依赖已满足、允许修改范围、输入输出、验收。只完成当前任务，不顺带重构或添加产品功能。跨范围需要协调；一般实现细节在已有规则内自行处理，不反复索要许可。

TypeScript 保持直观，禁止无必要的复杂泛型、any 逃避检查或重复 schema。Zod 校验外部数据；类型检查不能替代真实输入和权限验证。结果距离由服务端计算，页面只呈现。

提交前按改动运行必要检查；不写只复述实现的测试，不为纯样式变更搭庞大测试框架。服务端密钥、恢复码、JWT、答案不得进日志或仓库。没有凭证时如实报告阻塞，不偷偷用 mock 替代真实验收。

交付报告：改了什么、如何验证、结果与限制、仍需谁接手。提供简短验收证据；代码生成、类型通过、文档存在都不自动等于功能完成。Notion 任务通过对应行为验收才勾选；尚未验证标“待联调”，不要捏造完成率。
