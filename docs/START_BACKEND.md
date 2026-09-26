# B — 后端与整合 Starting Point

你负责让三个开发分支接起来。当前仓库只有目录、文档和空模块；你的第一步是建立真正的开发运行环境，而不是马上实现全部后端。

## 先打开

1. [Agent 规则](../AGENTS.md)、[产品说明](PROJECT.md)、[共同约定](CONTRACTS.md)。
2. [Notion checklist](https://app.notion.com/p/3e7d830fac0481c8bf0ef203ac15c27e?pvs=204)：先认领 0.4–0.7；随后 2.1–2.8 和联调。

## 第一个交付：其他两人可以开工

1. 在**当前仓库根目录**初始化 React + TypeScript + Vite，保留 README、文档与占位文件；不要再生成嵌套 find-my-planet 项目，也不要强制覆盖用户文件。
2. 固定依赖并提交 lockfile；配置 dev、typecheck、build 命令。后端 Edge Functions 的 Deno 依赖单独处理，前端不导入服务端模块。
3. 提供一个最小可运行页面和样例预览入口；与 A 约定 App.tsx 由你整合。
4. 把游戏/身份/记录的共用定义放入 `_shared/contracts/game.ts`、`identity.ts`、`records.ts`；C 维护 evaluation.ts。使用 Zod 作为输入结构真相，不复制平行接口。
5. 与 C 确认 fixture 结构后，告诉 A 可以开始做界面。
6. 验证最小部署、Supabase 匿名身份；真实服务凭证未提供时明确报告，不造假值冒充连接成功。

验收：其他两人从干净检出可以启动；typecheck/build 通过；前端导入的只有纯 contracts；README 更新为实际启动命令；远程部署成功才记录部署完成。

## 第二个交付：双设备一轮

顺序是身份 → 创建/加入 → 开始三题 → 单轮提交 → 对方答案保护 → 调用 C 的评估 → 保存揭晓 → 同步/刷新。先跑通一轮，再三轮和 records。题库先允许固定题回退，新题准备不能挡开局。

事务和唯一约束承担状态推进，不能只依赖前端按钮禁用。每个接口验证当前 profile 绑定；昵称不作为账号凭证。租约、旧请求、RLS 与列权限按 CONTRACTS 实现。

## 文件归属

负责 package/config、src/services、src/hooks、src/App.tsx、supabase/migrations、functions/game、evaluate 调度、records、identity。C 提供实际 AI 比较函数。共用 evaluation 变更先找 C；不覆盖 A 的视觉文件。

`supabase/functions/.env.example` 是服务器变量说明模板，不能把其内容放入 Vite 前缀变量。真实凭证只放私密环境中。

## 可直接发给 agent 的首个任务

> 先读 AGENTS.md 和 docs/START_BACKEND.md。本次只完成 checklist 0.4 和 0.7 中 B 负责的基础：在现有根目录建立 React/TypeScript/Vite 运行环境，保留现有文件，添加实际可用的 dev/typecheck/build 命令，落实游戏/身份/记录共用 schema，与 evaluation 的接口保持一致。不要实现完整房间、模型、账号恢复或部署，也不要替 C 改评估规则。完成后跑 typecheck/build，更新 README 的实际启动方式，列出给 A/C 的入口与仍缺的环境条件。不提交密钥，不自动推送。
