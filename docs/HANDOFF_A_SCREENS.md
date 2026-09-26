# A — 其余画面交接（1.1–1.4、1.8–1.10）

状态：代码已交付、待联调（2026-09-26 已核对 backend `b0b7d85`）。承接 `docs/HANDOFF_A_REVEAL.md`（揭晓页 1.5–1.7），不替代 Notion checklist 或 `CONTRACTS.md`；未通过真实接口验收前不勾选任务。所有画面文字为英文。

## 团队已定

- 揭晓页和总结页**显示距离数字**（“This round: 500 · 0 is closest, 1000 is farthest” / “Overall distance: 500”）。
- 舞台角落的手写昵称按 v0.4 **保留**（装饰性重复，内容区另有正式昵称）。
- 第一版**不做个人星图**，只做记录列表。
- 记录列表每条的解读：**第一个测出距离的那一轮的摘要**；三轮都没有距离时用第 1 轮的摘要。
- 界面与模型输出均为英文（C 分支已改 `prompt.ts` 与 CONTRACTS §7，待合并）。

## 本次交付（只动 A 的文件，不改 services / hooks / App / contracts）

画面只通过 props 接收数据和回调；B 接线时直接传入现有服务函数。

| 文件 | 任务 | props 与接线 |
| --- | --- | --- |
| `src/screens/WelcomeScreen.tsx` | 1.1 | `profileNickname`（identity/me，有值时昵称固定）；`onCreateIdentity(nickname)` → `createIdentityProfile`；`onCreateRoom()` → `createRoom`；`onJoinRoom(code)` → `joinRoom`（传入已规范化的 8 位码）；`onRecover?(code)`（identity/recover 未实现时不传，入口会说明暂不可用）；`onRecovered?()` |
| `src/components/RecoveryCodePanel.tsx` | 1.10 | `variant: "new" \| "restored" \| "view"`；`code`（服务端原样的分组码）；`onDone`；`onRotate?()`（identity/rotate_recovery 未实现时不传，隐藏换码）；`onBack` |
| `src/screens/LobbyScreen.tsx` | 1.2 | `joinCode \| null`、`players`、`viewerSlot`、`onStart?()` → game/start |
| `src/screens/AnswerScreen.tsx` | 1.3、1.4 | `roundIndex`、`prompt`、`players`、`viewerSlot`、`ownAnswer`（snapshot）、`partnerSubmitted`（snapshot.submitted）、`onSubmit(answer)` → game/submit |
| `src/screens/ResultScreen.tsx`、`src/components/DistanceSummary.tsx` | 1.8 | `players`、`viewerSlot`、`overall`、`rounds`（revealedRounds）、`alreadySaved?`、`onSave()` → records/save、`onOpenRecords?`、`onBackToStart?` |
| `src/screens/RecordsScreen.tsx` | 1.9 | `records`（records/list 的 RankedRecord，排名直接用服务端 `rank`）、`nextCursor`、`loading?`、`loadError?`、`onLoadMore?`、`onRetry?`、`onDelete(id)` → records/delete、`onStartGame?`、`onOpenRecoveryCode?` |
| `src/components/error-copy.ts` | 共用 | 从抛出的错误读取 API 错误码，按场景给出英文文案；房间码 / 找回码格式校验 |
| `src/components/ui.tsx`、`src/styles/screens.css` | 共用 | 按钮（忙碌与不可用都用 aria-disabled，防重复提交）、字段错误、复制（含剪贴板失败提示） |
| `src/screens/ScreensPreview.tsx` | 演示 | 用 C 的 fixture 拼演示数据（记录经 `RankedRecordSchema` 校验），模拟成功与各错误码 |
| `src/components/PlanetPair.tsx` | 更新 | 新增 `present`（大厅第二个位置可为空）与 `ariaLabel` |

首页流程：没有 profile 时，先调用 identity/create；若返回 `recoveryCode`，先显示一次找回码，玩家点 “I've saved it” 后才继续建房或加入。建房和加入两条路径都会经过这一步。之后若建房或加入失败，不会重复创建身份。

## 与后端的对齐

- **错误**：B 的客户端目前抛出 `new Error("CODE: message")`。`errorCodeOf` 解析这个前缀，也兼容将来带 `code` 字段的错误对象；界面不显示服务端 `message`。如果 B 改成带 `code` 的错误对象更好，前端不用改。
- **房间码**：前端按 backend 分支 rooms 表的约束校验：8 位，字符集 `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`，输入时自动转大写并去掉空格和横线。请 B 把这个规则写进 CONTRACTS（目前 schema 仍是 1–32 位）。
- **找回码**：26 位、同一字符集、4 位一组，与 identity 函数的生成方式一致；输入时横线和空格可省略。
- **昵称**：1–20 个 Unicode 字符，去首尾空白；允许重名，界面不做“已被占用”提示。

## 验证

- `npm run typecheck`、`npm run build` 通过。
- 本地临时挂载 `?preview=screens`（未提交），puppeteer 检查 59 项全部通过，覆盖 checklist 验收：
  - 1.1：空昵称和纯空格不能继续，报错后焦点回到输入框；昵称最多 20 字；无“已被占用”字样；房间码格式错误、ROOM_FULL 等报错落在对应字段；
  - 1.10：身份创建后先显示找回码再加入；复制有反馈；写明遗失后果与不能按昵称找回；查看与换码；恢复失败为统一提示；恢复成功显示新码；恢复未实现时有说明；
  - 1.2：房主单人不能开始，点击无效；复制邀请有反馈；双方昵称；开始失败可读；加入者没有开始按钮；
  - 1.3：空白不能提交；粘贴超长保留 300 字并提示；输入框随内容增高；提交中只读、连点只发送一次；
  - 1.4：等待时能读自己的答案，对方只显示 “Waiting for their answer.” 或密封状态；
  - 1.8：3 / 2 / 1 轮有效的文案；不足两轮仍可收藏；暂不保存后仍可保存；房间关闭时不能保存；刷新后显示已保存；
  - 1.9：服务端并列名次（1、1、3、4）；解读取第一个测出距离的轮次；分页后未知排在后面并显示 Unranked；同一伙伴多条；删除需确认；空记录和加载失败；
  - 375 与 320 宽度下六个画面都没有溢出，按钮不小于 44px，只有英文；全程无 React 报错。
- 揭晓页回归测试 30 项通过（含 C 新增的部分可解释样例）。
- 与 backend `b0b7d85` 对齐：main + backend + 本分支合并无冲突；B 的服务函数直接传入画面 props 通过类型检查（见下文接线写法）。
- 未验证：真机、读屏软件实际朗读、真实剪贴板、与真实接口联调。

## 已能接上的接口（backend `b0b7d85`）

backend 已实现 identity `me` / `create`，game `create` / `join` / `start` / `snapshot` / `submit`。把 main、backend 与本分支合并后，用下面的写法把 B 的真实函数直接传进画面，`tsc -b` 通过，两边都不用改代码（这段只用于核对，没有提交到 `App.tsx`）：

```tsx
<WelcomeScreen profileNickname={null} onCreateIdentity={createIdentityProfile}
  onCreateRoom={() => createRoom()} onJoinRoom={(code) => joinRoom(code)} />

<LobbyScreen joinCode={/* 待 snapshot 提供 */ null} players={snap.players} viewerSlot={viewerSlot}
  onStart={() => startGame(snap.roomId)} />

<AnswerScreen roundIndex={snap.currentRound as 1 | 2 | 3} prompt={snap.currentPrompt} players={snap.players}
  viewerSlot={viewerSlot} ownAnswer={snap.ownAnswer}
  partnerSubmitted={viewerSlot === "A" ? snap.submitted.b : snap.submitted.a}
  onSubmit={(text) => submitAnswer(snap.roomId, snap.currentRound as 1 | 2 | 3, text)} />
```

`viewerSlot` 和房间码目前 snapshot 里没有，见下表第 1、2 项。

## B 的请求与 Notion 任务对应

做这些任务时请把两份交接文档一起当作验收输入（checklist 原文没有点名这些字段）：

| # | 请求 | 对应任务 | 状态（backend `b0b7d85`） |
| --- | --- | --- | --- |
| 1 | snapshot 加查看者槽位 | 2.5 | ❌ 2.5 已实现，但 `GameSnapshotSchema` 没有该字段；前端无法判断“我”是 A 还是 B |
| 2 | snapshot 加房间码 | 2.5 | ❌ 同上；房主刷新后大厅无法显示房间码 |
| 3 | 评估失败的剩余次数 / 已耗尽 / 失败后重试中，并放进 snapshot | 2.6 + 2.5 | 未开始（2.6） |
| 4 | `useGameSession` 映射到各画面 props；`RevealScreen` 的 `animate` | 2.7 + 4.1 | 未开始 |
| 5 | continue，推进下一轮 | 2.8 | 未开始 |
| 6 | 揭晓结果（`revealedRounds` 目前恒为空） | 2.6 | 未开始 |
| 7 | finished 阶段“我是否已保存” | 5.1–5.3 | 未开始 |
| 8 | 房间码规则写进 CONTRACTS | 2.2 | 已实现（8 位），缺文档 |
| 9 | identity/recover、rotate_recovery | 2.9 | 未开始 |
| 10 | records/save、list、delete | 5.2–5.6 | 未开始 |
| 11 | `main.tsx` 引入 `global.css`；`App.tsx` 加 `?preview=reveal` 与 `?preview=screens` | 不在任务里，4.1 之前顺手做 | 未做 |
| 12 | 是否自托管字体、favicon | 不在任务里 | 未定 |

### 可直接发给 B 的 agent（接线部分）

> 先读 AGENTS.md、docs/CONTRACTS.md、docs/HANDOFF_A_REVEAL.md 和 docs/HANDOFF_A_SCREENS.md。本次只做接线，不改 A 的 screens/components/styles。
> 1. `main.tsx` 引入 `./styles/global.css`；`App.tsx` 增加 `/?preview=reveal`（`RevealPreview`）和 `/?preview=screens`（`ScreensPreview`），保留现有入口。
> 2. 在真实流程中渲染 `WelcomeScreen`：`profileNickname` 来自 identity/me，`onCreateIdentity` 传 `createIdentityProfile`，`onCreateRoom` 传 `createRoom`，`onJoinRoom` 传 `joinRoom`；identity/recover 实现后再传 `onRecover`。
> 3. 把房间码规则（8 位，`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`）写进 CONTRACTS 与 `game.ts` 的 join 输入校验。
> 做 2.5–2.7 时，按两份交接文档补齐 snapshot 字段并把 snapshot 映射到 Lobby / Answer / Reveal / Result 的 props。完成后运行 typecheck、build 与现有测试，说明验证结果与待联调项。不提交密钥，不自动推送。

## C 的请求

`HANDOFF_A_REVEAL.md` 中给 C 的四项已完成并合入 main（英文 fixture 与标签、部分可解释样例、两类未知判定、英文输出），本分支已同步。
