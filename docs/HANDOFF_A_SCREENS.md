# A — 其余画面与整局接线交接（1.1–1.4、1.8–1.10）

状态：代码已交付、待联调（2026-09-26 已核对 backend `7220b50`，即 task 2 完成版）。承接 `docs/HANDOFF_A_REVEAL.md`（揭晓页 1.5–1.7），不替代 Notion checklist 或 `CONTRACTS.md`；未通过真实接口验收前不勾选任务。所有画面文字为英文。

## 团队已定

- 揭晓页和总结页**显示距离数字**（“This round: 500 · 0 is closest, 1000 is farthest” / “Overall distance: 500”）。
- 舞台角落的手写昵称按 v0.4 **保留**（装饰性重复，内容区另有正式昵称）。
- 第一版**不做个人星图**，只做记录列表。
- 记录列表每条的解读：**第一个测出距离的那一轮的摘要**；三轮都没有距离时用第 1 轮的摘要。
- 界面与模型输出均为英文（C 已改 `prompt.ts` 与 CONTRACTS §7，已合入 main）。

## 本次交付（只动 A 的文件，不改 services / hooks / App / contracts）

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
| `src/screens/GameScreen.tsx` | 4.1 前的画面接线 | 按 snapshot 的 phase 切换大厅 / 作答 / 分析与揭晓 / 总结；B 只需传入 `useGameSession` 的状态和服务函数，见下文“整局接线” |
| `src/screens/RevealScreen.tsx` | 更新 | `onContinue` 可返回 Promise：按钮显示忙碌，失败时显示英文错误 |
| `src/screens/GamePreview.tsx` | 演示 | 模拟服务器与对方，把 `GameScreen` 从大厅走到总结，可切换评估成功 / 失败 / 服务不可用 / 卡在 processing、断线、查看者 A/B |

首页流程：没有 profile 时，先调用 identity/create；若返回 `recoveryCode`，先显示一次找回码，玩家点 “I've saved it” 后才继续建房或加入。建房和加入两条路径都会经过这一步。之后若建房或加入失败，不会重复创建身份。

## 与后端的对齐

- **错误**：B 的客户端目前抛出 `new Error("CODE: message")`。`errorCodeOf` 解析这个前缀，也兼容将来带 `code` 字段的错误对象；界面不显示服务端 `message`。如果 B 改成带 `code` 的错误对象更好，前端不用改。
- **房间码**：前端按 backend 分支 rooms 表的约束校验：8 位，字符集 `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`，输入时自动转大写并去掉空格和横线。请 B 把这个规则写进 CONTRACTS（目前 schema 仍是 1–32 位）。
- **找回码**：26 位、同一字符集、4 位一组，与 identity 函数的生成方式一致；输入时横线和空格可省略。
- **昵称**：1–20 个 Unicode 字符，去首尾空白；允许重名，界面不做“已被占用”提示。

## 验证

- `npm run typecheck`、`npm run build` 通过；非注释代码没有中文。
- 本地临时挂载预览入口（未提交），puppeteer 检查：
  - `?preview=game` 整局 40 项全部通过：
    - 主流程：大厅 → 三轮作答 → 分析 → 揭晓 → 继续 → 总结 → 保存；
    - 分析中看不到对方原文；首次揭晓有动画，快照丢失后重新挂载直接显示完成态；
    - 继续按钮请求中显示忙碌，等待对方、对方先继续都有对应提示；第 3 轮按钮为 See the full game；
    - 评估失败显示技术失败（不是距离、不是线索不足）；Try again 进入重试中；
    - 服务不可用（INTERNAL_ERROR）时提供重试，不会无限转圈；
    - 自动 1 次加手动 2 次都失败后显示“已耗尽”，与服务端规则一致；Check again 只刷新；
    - 服务层不传 `retryable` 时一直显示可重试（无法判断已耗尽）；
    - 加入者大厅；房间 EXPIRED 或网络错误的读取失败页；同步失败横幅；320 宽无横向溢出；
    - 找回码查看页在拿不到当前码时的说明与换码；全程无 React 报错。
  - `?preview=screens` 59 项、`?preview=reveal` 30 项回归全部通过。其中一项预期随 C 把样例昵称改为 “Alex (demo)” 而更新，不是功能改动。
- 与 backend `7220b50` 对齐：backend + 本分支合并无冲突，下文接线写法 `tsc -b` 通过。
- 未验证：
  - 真实接口联调：本机没有 `.env.local`，而且 README 说明 2.6–2.9 远程部署后才验收；
  - 真机、读屏软件实际朗读、真实剪贴板。

## 整局接线（backend `7220b50`）

`GameScreen` 只收 props，不导入 services 或 hooks。在临时合并目录里用下面的写法把 B 的真实 hook 与 services 传进画面，`tsc -b` 通过，两边都不用改代码（只用于核对，没有提交 `App.tsx`）：

```tsx
type ActiveRoom = { roomId: string; viewerSlot: Slot; joinCode: string | null };

function GameRoute({ room, onLeave }: { room: ActiveRoom; onLeave: () => void }) {
  const session = useGameSession(room.roomId);
  return (
    <GameScreen
      snapshot={session.snapshot} loading={session.loading} syncError={session.error}
      viewerSlot={room.viewerSlot} joinCode={room.joinCode}
      onStart={() => startGame(room.roomId)}
      onSubmit={(round, answer) => submitAnswer(room.roomId, round, answer)}
      onEvaluate={(round) => evaluateRound(room.roomId, round)}
      onContinue={(round) => continueGame(room.roomId, round)}
      onRefresh={session.refresh}
      onBackToStart={onLeave}
    />
  );
}

<WelcomeScreen
  profileNickname={profileNickname /* getIdentityProfile() */}
  onCreateIdentity={createIdentityProfile}
  onCreateRoom={async () => { const r = await createRoom(); setRoom({ roomId: r.roomId, viewerSlot: "A", joinCode: r.joinCode }); }}
  onJoinRoom={async (code) => { const r = await joinRoom(code); setRoom({ roomId: r.roomId, viewerSlot: "B", joinCode: null }); }}
  onRecover={recoverIdentityProfile}
  onRecovered={...}
/>
<RecoveryCodePanel variant="view" code={null} onRotate={rotateRecoveryCode} onBack={...} />
```

`GameScreen` 内部处理的事（B 不用再做）：

- phase 与画面的对应；揭晓的 `animate` 用 sessionStorage 记录“本设备是否看过这一轮”，刷新后不重播。
- **自动发起评估**：看到 `phase = evaluating` 且 `evaluationState = pending` 时调用 `onEvaluate`。两台设备都可能调用，服务端只让一台真正运行，另一台拿到 processing。若一直停在 processing，65 秒后再调用一次，接管过期的 60 秒租约。手动 Try again 也走 `onEvaluate`。如果 B 更希望把评估调度放在 hook 里，告诉 A 改成只接收状态。
- 每个操作完成后调用 `onRefresh`，按钮保持忙碌直到新快照到达，不必等 Realtime。
- 首个快照加载中、读取失败（EXPIRED / NOT_FOUND 不提供重试）、刷新失败时的横幅。

## 仍需 B 提供的参数与部分

| # | 需要什么 | 为什么 | 对应任务 | 现在的临时做法 |
| --- | --- | --- | --- | --- |
| 1 | snapshot 加查看者槽位（如 `viewerSlot`） | 判断哪份答案是自己的、You 标签、谁能开始 | 2.5 | App 在建房时记 A、加入时记 B，并和 roomId 一起存起来；换设备或清除存储后会丢失 |
| 2 | snapshot 加房间码（如 `joinCode`） | 房主刷新后大厅还能显示邀请码 | 2.5 | 只用 createRoom 的返回值；丢失时大厅说明暂时拿不到 |
| 3 | 评估失败信息：①客户端抛错时保留信封里的 `retryable`（例如错误对象带 `code`、`retryable`）；②最好在 snapshot 加剩余手动重试次数 | 区分“可重试”和“已耗尽”，另一台设备和刷新后也能知道 | 2.6 + 2.5 | 现在客户端只抛 `new Error("CODE: message")`，`retryable` 丢了，界面永远显示可重试；重试用完后再点仍会失败 |
| 4 | **重试耗尽后怎么继续** | 目前耗尽后房间停在 evaluating，无法揭晓、继续或结束。按产品规则，技术失败不能当成线索不足 | 产品决定 + 2.6/2.8 | 界面只显示“已耗尽”和 Check again |
| 5 | 开始评估和手动重试时也递增 `revision` | 目前只有发布结果和标记失败会递增，另一台设备看不到“正在重试” | 2.6 / 2.7 | 另一台设备继续显示失败，直到出结果 |
| 6 | records：save / list / delete，以及 finished 阶段的“我是否已保存” | 1.8 保存、1.9 列表；刷新后不再重复显示保存按钮 | 5.1–5.6 | `onSave` 不传，总结页写 “Saving isn't available yet.” |
| 7 | App 接线：以上路由；刷新后恢复当前房间（roomId、槽位、房间码）；`getIdentityProfile` 提供昵称；找回成功后清掉当前房间；`main.tsx` 引入 `global.css`；预览入口 `?preview=reveal`、`?preview=screens`、`?preview=game` | 让画面跑在真实流程里 | 4.1 | 未做（`App.tsx` 归 B） |
| 8 | 可选：hook 提供“直接采用操作返回的快照” | start / submit / continue 已经返回快照，可以少一次请求 | 2.7 | 操作后多调一次 `refresh` |
| 9 | 房间码规则写进 CONTRACTS 和 join 的输入校验 | 目前 schema 仍是 1–32 位 | 2.2 | 前端按 8 位、`ABCDEFGHJKLMNPQRSTUVWXYZ23456789` 校验 |
| 10 | 部署 2.6–2.9 并提供联调环境 | 真实双设备验收 | 2.6–2.9、4.1 | A 本机没有 `.env.local`，只能用模拟服务器验证 |
| 11 | 是否自托管字体、favicon | 视觉与 404 | 不在任务里 | 系统字体 |

### 可直接发给 B 的 agent（接线部分）

> 先读 AGENTS.md、docs/CONTRACTS.md、docs/HANDOFF_A_REVEAL.md 和 docs/HANDOFF_A_SCREENS.md。本次只做 B 的部分，不改 A 的 screens/components/styles，不改 C 的评估定义。
> 1. 在 `_shared/contracts/game.ts` 的 snapshot 加入查看者槽位和房间码；为评估提供剩余手动重试次数（或等价信息）；开始评估和手动重试时递增 revision。全部用 Zod 定义并推导类型，同步 CONTRACTS.md。
> 2. 让 services 抛出的错误保留信封里的 `code` 与 `retryable`（例如带这两个字段的错误对象），前端的 `errorCodeOf` / `retryableOf` 已兼容。
> 3. `main.tsx` 引入 `./styles/global.css`；`App.tsx` 增加 `?preview=reveal`、`?preview=screens`、`?preview=game`，并按 HANDOFF_A_SCREENS 的“整局接线”渲染 `WelcomeScreen`、`GameScreen`、`RecoveryCodePanel`，刷新后恢复当前房间。
> 4. 把房间码规则写进 CONTRACTS 与 join 的输入校验。
> 重试耗尽后的去向是产品决定，先和 A、C 确认，不要自行加入新流程。完成后运行 typecheck、build 与现有测试，说明验证结果与待联调项。不提交密钥，不自动推送。

## C 的请求

`HANDOFF_A_REVEAL.md` 中给 C 的四项已完成并合入 main（英文 fixture 与标签、部分可解释样例、两类未知判定、英文输出），本分支已同步。
