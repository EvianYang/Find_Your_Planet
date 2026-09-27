# Find Your Planet

**The distance between two stars. The distance between two hearts.**

状态：产品与开发规划、目录骨架已整理，应用尚未实现。版本：2026-09-25。日常进度由 [Notion：Find Your Planet — Development Checklist](https://app.notion.com/p/3e7d830fac0481c8bf0ef203ac15c27e?pvs=204)管理，不能把本文中的计划当成已完成的功能。

## 我们在做什么

我们看到同一道问题，会想到相同的世界吗？

Find Your Planet 是一个双人 AI 社交小游戏。两个人回答同样的开放问题，AI 比较答案中的联想，解释你们在哪里共鸣、在哪里走向不同，把这一局的“电波距离”变成两颗小行星之间的距离。

它回应 “Fly Me to the Moon”：暂时离开眼前的现实，进入想象，也借此靠近另一个人的世界。“但愿人长久，千里共婵娟”是情感背景。名字使用 Find Your Planet，不再使用 Same Moon 作为现行产品名。

适合朋友、伴侣、同学，也允许不熟悉的两个人一起玩。无需预先了解对方。体验应轻松、有趣、值得回看，不是心理测评，也不是回答质量比赛。

## 一局怎么玩

1. 输入昵称，创建房间或通过邀请加入；每房两人。
2. 每局三轮。每轮双方看到同一道题，各自回答，不提前看对方文本。
3. 双方提交后，AI 比较两份真实答案，揭晓原文、相似点和差异。
4. 两颗小行星根据这一轮结果移动，呈现距离。
5. 双方继续，完成三轮后看到当局整体距离与每轮回看。
6. 两个人分别选择保存或不保存。收藏进入自己的记录列表，按距离排序。

每局重新作答、重新计算，不跨局复用答案、不固定个人答案或题组。本轮提交后不再修改，是为了让揭晓基于同一份输入，并不意味着跨局锁定。没有倒计时惩罚。

主模式只比较 A 的答案和 B 的答案，不要求预测对方，不区分 A→B 与 B→A。

## 题目：让人跳出现实去联想

题目用英文。核心只有四个字：天马行空。风格不设限，荒诞、温柔、奇怪、好笑、日常都可以，也可以很简单。不要求每道题都有条件反转，也不强制解释“为什么”。每道题都要能调动联想和抽象思维，同时十秒内就能凭直觉开始作答，让人愿意回答。

第一版人工准备 39 道题：13 个方向各 3 道。房间等待时尝试生成 2 道 AI 新题，检查后混入本局题池，随机抽三道不重复题。没有必须出现 AI 题的配额；开始时新题未准备好就用人工题，不耽误开局。开局后题目不再替换。

首批人工题目草案（供 A/C 试玩后调整，不是题型限制）：

1. If the world could have one more color, where would you want it to appear?
2. Once a day, you can move anything two centimeters to the left. What would you move first?
3. A moment of silence can fit inside a suitcase. Where would you take it?
4. The Moon suddenly displays “Storage full.” What do you think is stored inside?
5. A road that did not exist yesterday appears outside your home. Where does it lead?
6. If you could add one instruction to the universe’s manual, what would it say?
7. Tomorrow, everyone’s shadow can take the day off. Where would your shadow go?
8. You receive a receipt from the future with only one item on it. What is it?
9. If a sound could grow into a plant, which sound would you plant?
10. The world suddenly gains a holiday that belongs only to you. What does everyone do that day?
11. You can place a window on anything. Where would you put it?
12. An animal that has never seen a human mistakes you for a kind of weather. How would it describe you?
本文档刻意不放示例题，避免人工出题和 AI 生成都往同一种意象和句式上靠。方向、出题标准、反例和生成规则见 [START_AI.md 的出题规则](START_AI.md#出题规则)。

## AI 为什么不可替代

同一个词可能藏着不同的思路，不同的答案也可能沿着相似的联想路径。

例如题目是“每天一次，你能让任何东西向左移动两厘米”：一个人把雨伞挪过去替朋友挡雨，另一个把杯子挪回桌面防止摔碎。对象不同，但都用微小改变阻止一件不好的事。

AI 解释共同意象、联想方式、表达出来的目的或感受。只根据文本，不强迫每个脑洞都有价值观或心理意义，不因答案短或古怪就扣分。证据不足可以说“不知道”。

整体距离只描述这一局答案。不同局、不同题组的收藏允许一起排序，这是游戏记录的趣味排序，不是经过验证的人格匹配度。不要宣传永久关系分。

## 保存与个人排名

默认不收藏。每人独立点击保存；一方保存不替另一方保存。保存伙伴昵称快照、时间、题目、距离和简短 AI 解读，不长期保存双方完整原文或证据摘录。

同一伙伴的不同局是不同记录，不自动平均、不覆盖。有效距离由近到远，同距离并列；无法得出整体距离也可收藏，但显示“未排名”。支持删除自己的记录，不能删除对方收藏。

个人星图属于可简化的呈现方式，第一版必须有清楚的记录列表。若实现星图，每个点表示一次相遇，到“我”的径向距离代表记录距离；其他点之间的间距只是排版，不代表这些人彼此的相似程度。

## 昵称与找回

输入昵称即可开始，后台使用独立身份。同名不代表同一个人。首次建立身份时显示私人找回码，可复制并保存在本浏览器；服务端只存校验值。换设备输入找回码恢复记录，不要求记住昵称。

找回后换发新码并撤销旧身份对该资料的访问。没有邮箱、密码重设、客服找回或好友系统。找回码丢失且浏览器身份也丢失时，不能仅凭昵称恢复。

## 视觉方向

两颗小行星是主角，月亮可作为共同背景；夜空、轨道和光点辅助表达。画面首先让人读懂解读，再让距离变化产生感觉。

使用 CSS/SVG，不做 WebGL、3D 物理或运行时生成图片。建议深蓝背景 #0B1020，正文 #F7F4EE，两颗星用 #91D8F7 / #D1B3FA，搭配昵称与形状，不只依赖颜色。

揭晓：原文出现 → 简短解读 → 星体移动，约 1.5–2 秒，可跳过。未知结果用虚线和文字，不放到最大距离。动画关闭仍能读懂；刷新直接显示已完成状态。

手机优先（390px 设计基线，320px 不横向溢出），桌面内容最大约 960px。长昵称、长答案、键盘和失败状态都要设计。触控目标至少 44px，焦点清楚，检查实际对比度。

设计工具任务基线：制作首页、等待、作答、揭晓、总结、个人记录及找回入口；以统一 fixture 驱动；两颗星表达一个对称距离；不自行生成解释、不新增心理标签、聊天或互猜功能。状态接线与评估数据由对应负责人提供。

## 一天版本的范围

P0：双人房间、三轮问答、AI 比较、距离动画、总结、独立保存、个人排序/删除、昵称身份与找回、混合题池及失败回退、基本恢复与权限验证。

后续：熟人互猜、一键分享、复杂个人星图、聊天、公开榜、完整账号管理。熟人互猜可以完全不做；不能为它预建预测阶段或双向评分。

时间不足时先简化装饰、额外转场和星图布局，保留可玩的闭环和保存排序。三人约一天开发，先两台设备玩通一轮，再三轮、收藏、打磨。至少两次真人完整试玩，一次包含手机。

## 文档与进度

- [CONTRACTS.md](CONTRACTS.md)：三条开发线必须一致的行为和接口。
- [AGENTS.md](../AGENTS.md)：修改范围和交付规则。
- [Notion：Find Your Planet — Development Checklist](https://app.notion.com/p/3e7d830fac0481c8bf0ef203ac15c27e?pvs=204)：任务与验收的唯一日常进度入口。

本文中的初始题目、数值阈值和视觉参数是开发基线，未宣称经过实测。现阶段只有目录与明确标记的代码占位，没有可运行应用、数据库、部署链接或已验证的功能。实际仓库目录保留团队已有的 Find_Your_Planet，不因产品名称重命名。
