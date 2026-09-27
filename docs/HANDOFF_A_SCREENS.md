# A — 其余画面与整局接线交接（1.1–1.4、1.8–1.10）

状态：代码已交付、待真实环境联调（2026-09-26 已核对 production `fbc39ae`：backend task 2 与技术失败修复）。承接 `docs/HANDOFF_A_REVEAL.md`（揭晓页 1.5–1.7），不替代 Notion checklist 或 `CONTRACTS.md`；未通过真实接口验收前不勾选任务。所有画面文字为英文。

## 团队已定

- 揭晓页和总结页**显示距离数字**（“This round: 500 · 0 is closest, 1000 is farthest” / “Overall distance: 500”）。
- 舞台角落的手写昵称按 v0.4 **保留**（装饰性重复，内容区另有正式昵称）。
- 第一版**不做个人星图**，只做记录列表。
- 记录列表每条的解读：**第一个测出距离的那一轮的摘要**；三轮都没有距离时用第 1 轮的摘要。
- 界面与模型输出均为英文（C 已改 `prompt.ts` 与 CONTRACTS §7，已合入 main）。

## 本次交付（A 的文件；`App.tsx` / `main.tsx` 接线经用户决定由 A 完成，不改 services / hooks / contracts）

画面只通过 props 接收数据和回调；B 接线时直接传入现有服务函数。

| 文件 | 任务 | props 与接线 |
| --- | --- | --- |
| `src/screens/WelcomeScreen.tsx` | 1.1 | `profileNickname`（identity/me，有值时昵称固定）；`onCreateIdentity(nickname)` → `createIdentityProfile`；`onCreateRoom()` → `createRoom`；`onJoinRoom(code)` → `joinRoom`（传入已规范化的 8 位码）；`onRecover?(code)`（identity/recover 未实现时不传，入口会说明暂不可用）；`onRecovered?()` |
| `src/components/RecoveryCodePanel.tsx` | 1.10 | `variant: "new" \| "restored" \| "view"`；`code`（服务端原样的分组码；`view` 时可为 `null`：服务端只存哈希，平时拿不到当前码，页面会说明并提供换码）；`onDone`；`onRotate?()` → `rotateRecoveryCode`；`onBack` |
| `src/screens/LobbyScreen.tsx` | 1.2 | `joinCode \| null`、`players`、`viewerSlot`、`onStart?()` → game/start |
| `src/screens/AnswerScreen.tsx` | 1.3、1.4 | `roundIndex`、`prompt`、`players`、`viewerSlot`、`ownAnswer`（snapshot）、`partnerSubmitted`（snapshot.submitted）、`onSubmit(answer)` → game/submit |
| `src/screens/ResultScreen.tsx`、`src/components/DistanceSummary.tsx` | 1.8 | `players`、`viewerSlot`、`overall`、`rounds`（revealedRounds）、`alreadySaved?`、`onSave?()` → records/save（task 5 未实现时不传，页面显示 “Saving isn't available yet.”）、`onOpenRecords?`、`onBackToStart?` |
| `src/screens/RecordsScreen.tsx` | 1.9 | `records`（records/list 的 RankedRecord，排名直接用服务端 `rank`）、`nextCursor`、`loading?`、`loadError?`、`onLoadMore?`、`onRetry?`、`onDelete(id)` → records/delete、`onStartGame?`、`onOpenRecoveryCode?` |
| `src/components/error-copy.ts` | 共用 | 从抛出的错误读取 API 错误码，按场景给出英文文案；房间码 / 找回码格式校验 |
| `src/components/ui.tsx`、`src/styles/screens.css` | 共用 | 按钮（忙碌与不可用都用 aria-disabled，防重复提交）、字段错误、复制（含剪贴板失败提示） |
| `src/screens/ScreensPreview.tsx` | 演示 | 用 C 的 fixture 拼演示数据（记录经 `RankedRecordSchema` 校验），模拟成功与各错误码 |
| `src/components/PlanetPair.tsx` | 更新 | 新增 `present`（大厅第二个位置可为空）与 `ariaLabel` |
| `src/screens/GameScreen.tsx` | 4.1 画面接线 | 按 snapshot 的 phase 切换大厅 / 作答 / 分析与揭晓 / 总结；槽位、房间码、剩余重试次数直接读 snapshot；重试耗尽时提供本地离开 |
| `src/GameApp.tsx`、`src/App.tsx`、`src/main.tsx` | 4.1 App 接线 | 真实流程：身份 → 建房 / 加入 → 整局；`?preview=game`、`screens`、`reveal` 演示入口按需加载；保留 B 的 `contracts`、`supabase` 入口；`main.tsx` 引入 `global.css` |
| `src/screens/RevealScreen.tsx` | 更新 | `onContinue` 可返回 Promise：按钮显示忙碌，失败时显示英文错误；重试耗尽改为说明本局停止并提供 `onLeave`（Leave this room），不再有 Check again |
| `src/screens/GamePreview.tsx` | 演示 | 模拟服务器与对方，把 `GameScreen` 从大厅走到总结，可切换评估成功 / 失败 / 服务不可用 / 卡在 processing、断线、查看者 A/B、快照是否带房间码 |

首页流程：没有 profile 时，先调用 identity/create；若返回 `recoveryCode`，先显示一次找回码，玩家点 “I've saved it” 后才继续建房或加入。建房和加入两条路径都会经过这一步。之后若建房或加入失败，不会重复创建身份。

## 与后端的对齐

- **错误**：B 的客户端抛出 `ApiClientError`（带 `code`、`retryable`）。`errorCodeOf` / `retryableOf` 读取这两个字段，仍兼容 `"CODE: message"` 形式；界面按错误码显示自己的英文文案，不显示服务端 `message`。
- **房间码**：8 位，字符集 `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`。前端直接用 contracts 的 `JoinCodeSchema` 校验，输入时自动转大写并去掉空格和横线。
- **找回码**：26 位、同一字符集、4 位一组，与 identity 函数的生成方式一致；输入时横线和空格可省略。
- **昵称**：1–20 个 Unicode 字符，去首尾空白；允许重名，界面不做“已被占用”提示。

## 验证

- `npm run typecheck`、`npm run build` 通过；演示页按需加载，不进主包；非注释代码没有中文。
- **双人模拟联调 26 项全部通过**：用 puppeteer 拦截 Supabase 的 auth 与 Edge Functions 请求（假服务器按 CONTRACTS 与 backend 代码的规则返回），两个独立浏览器上下文走真实接线（`GameApp` + B 的 services / `useGameSession` + A 的画面）：
  - 访问首页不创建匿名用户；建身份 → 先显示找回码 → 建房 / 用小写房间码加入；
  - 加入者看不到房间码；Realtime 不可用时靠 3 秒轮询同步；
  - 三轮作答、自动评估、双方同步揭晓；揭晓中刷新回到房间且不重播动画；
  - 继续：等待对方与“对方已准备好”；
  - 技术失败两边都显示且带剩余次数；手动重试进行中刷新另一台设备，仍显示“正在重试”；手动重试后揭晓；同一轮没有重复的 evaluate 调用；
  - 总结页的总距离与服务端规则一致；保存未接时如实说明；回到首页保留昵称；
  - 已存会话失效（identity/me 返回 UNAUTHORIZED）时清掉本地会话，能重新建身份；
  - 浏览器存储里没有答案或找回码；全程无 React 报错。
- 演示页回归：`?preview=game` 42 项（含房间在打开期间过期、`?preview=__proto__` 不崩溃）、`?preview=screens` 59 项、`?preview=reveal` 31 项全部通过。
- 未配置 Supabase 时首页显示说明和演示入口；B 的 `?preview=supabase` 仍可用。
- 未验证：
  - **真实后端联调**：本机没有 `.env.local`，上面的联调用的是假服务器；
  - 真机、读屏软件实际朗读、真实剪贴板。

## 整局接线（已在 `src/GameApp.tsx` 完成）

- **身份**：有会话才调用 identity/me，只访问不会创建匿名用户；me 返回 UNAUTHORIZED / IDENTITY_REPLACED（身份已在别处恢复）时按新玩家处理。
- **当前房间**：roomId 存在 sessionStorage，刷新回到房间；新标签页从首页开始。game/join 对已在房间里的人是幂等的，所以任一方都能用房间码回去，加入页有相应提示。
- **槽位与房间码**：直接用 snapshot 的 `viewerSlot`、`joinCode`（只有房主拿得到）。
- **评估**（`GameScreen` 内部）：
  - 看到 `evaluating` + `pending` 时调用 evaluate/run；两台设备都可能调用，服务端只让一台运行；
  - 停在 processing 超过 65 秒时再调用一次，接管过期的租约；
  - 状态由 `evaluationState`、`evaluationRetriesRemaining` 和 `ApiClientError.retryable` 推出；
  - `failed` 且剩余 0 次时显示“已耗尽”，只提供本地离开（CONTRACTS：不删除 participant，没有服务端 leave）。
- **每个操作之后调用 `refresh`**，按钮保持忙碌直到新快照到达。
- **找回**：首页 Restore 调用 `recoverIdentityProfile`，成功后显示新码，再回到首页。

## 仍需处理

| # | 事项 | 负责 | 说明 |
| --- | --- | --- | --- |
| 1 | records：save / list / delete，以及 finished 阶段“我是否已保存” | B（task 5） | 接好后在 `GameApp` 传 `onSave`、`alreadySaved`，并加上 `RecordsScreen` 路由 |
| 2 | “我的记录”入口与找回码查看 / 换码页（`RecoveryCodePanel variant="view"`，`onRotate={rotateRecoveryCode}`） | A，随 task 5 | 入口在记录页，记录页接好前没有入口 |
| 3 | 部署后用真实 `.env.local` 做双设备验收 | B 部署，A/B 联调 | 包括 Realtime 实际推送、模型真实耗时下的分析与重试 |
| 4 | 可选：hook 直接采用 start / submit / continue 返回的快照 | B | 现在每个操作后多一次 snapshot 请求 |
| 4b | 租约过期接管会消耗手动重试次数 | B | 前端在 processing 停留 65 秒后会再调用 evaluate/run 接管。若 `automatic_attempts` 已达 2（例如手动重试的运行中断），`claim_round_evaluation` 走手动分支，玩家没点也会少一次重试，与 CONTRACTS 的“手动重试最多两次”不一致；建议过期租约的接管不计入手动次数 |
| 5 | 是否自托管字体、favicon | 待定 | 目前用系统字体；缺 favicon 会有 404 |

B 在 `fbc39ae` 已完成上一版表格里的：snapshot 的 `viewerSlot` / `joinCode` / `evaluationRetriesRemaining`，`ApiClientError` 携带 `code` 与 `retryable`，开始评估与手动重试递增 revision，房间码规则写入 CONTRACTS 与 join 校验，重试耗尽后的处理（本地离开）。

## C 的请求

`HANDOFF_A_REVEAL.md` 中给 C 的四项已完成并合入 main（英文 fixture 与标签、部分可解释样例、两类未知判定、英文输出），本分支已同步。
