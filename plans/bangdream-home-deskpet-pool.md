# BanG Dream! 首页桌宠可切换池

## 结论

- 当前确认适合作为首页右下角 all-in-one 桌宠池的主资源，只保留 `BanG Dream!`。
- 当前桌宠池已扩到 `45` 名角色、`165` 个可切换变体。
- 历史已验 `57` 个旧条目；后续新增条目现累计到 `108` 个，本轮补入的 `21` 个 Ave Mujica 变体也已逐个完成真实浏览器加载、交互点击和截图复核，当前池子合计 `165` 个条目都具备接入记录。
- 这一池统一为 `Cubism 2.1`，能走同一套运行时代码。
- 角色全部为真人类女性、非 chibi，且大多为半身便服立绘，和当前首页风格最稳。
- 当前实际覆盖团体为 `9` 团：Poppin'Party、Afterglow、ハロー、ハッピーワールド！、Pastel*Palettes、Roselia、Morfonica、RAISE A SUILEN、MyGO!!!!!、Ave Mujica。

## 默认推荐 5 人

- `bangdream_017_casual` 冰川日菜 `017_casual`：综合色调最稳，右下角常驻时最不违和。
- `bangdream_006_casual` 美竹兰 `006_casual`：深色外套和站点工业感最贴。
- `bangdream_003_casual_winter` 牛込里美 `003_casual_winter`：冬装半身感最好，贴边自然。
- `bangdream_015_casual_winter` 奥泽美咲 `015_casual_winter`：动作多，活力够，但不吵。
- `bangdream_014_casual_winter` 松原花音 `014_casual_winter`：低饱和，稳定，适合作默认常驻。

## 统一动作基础

- 当前语义动作池已经统一收敛为 `idle / follow / greet / farewell / react / pose` 六类。
- 对应的跨模型公共动作名已经扩到：
  - `idle`：`13` 个
  - `follow`：`16` 个
  - `greet`：`25` 个
  - `farewell`：`14` 个
  - `react`：`35` 个
  - `pose`：`40` 个
- 这意味着前端可以继续走统一语义映射，例如“打招呼 / 惊讶 / 害羞 / 常驻 / 跟随 / 随机 pose”，切人不需要换实现。
- 这批模型几乎都没有内置 `hitAreas`，所以交互应由页面统一绑事件，再映射到动作组。

## 角色与变体分布

- Poppin'Party `001-005`：`5` 人，合计 `15` 个变体，均为 `casual / casual_summer / casual_winter`
- Afterglow `006-010`：`5` 人，合计 `15` 个变体，均为 `casual / casual_summer / casual_winter`
- ハロー、ハッピーワールド！ `011-015`：`5` 人，合计 `15` 个变体，均为 `casual / casual_summer / casual_winter`
- Pastel*Palettes `016-020`：`5` 人，合计 `19` 个变体
  - `016` 仍是 `3` 套常服
  - `017-020` 已从单服装扩到 `4` 套左右，补入 `2023` 常服、辉彩祭、梦祭和活动立绘等可用品
- Roselia `021-025`：`5` 人，合计 `20` 个变体，已从原先单服装扩到每人 `4` 套左右
- Morfonica `026-030`：`5` 人，合计 `20` 个变体
- RAISE A SUILEN `031-035`：`5` 人，合计 `20` 个变体
- MyGO!!!!! `036-040`：`5` 人，合计 `20` 个变体
- Ave Mujica `041-045`：`5` 人，合计 `21` 个变体
  - `041` 豊川 祥子：`5` 套
  - `042` 三角 初華：`6` 套
  - `043` 八幡 海鈴：`4` 套
  - `044` 祐天寺 にゃむ：`2` 套
  - `045` 若葉 睦：`4` 套
- 当前整体分布：
  - `1` 名角色有 `2` 套可用服装
  - `16` 名角色各有 `3` 套可用服装
  - `26` 名角色各有 `4` 套可用服装
  - `1` 名角色有 `5` 套可用服装
  - `1` 名角色有 `6` 套可用服装

## 额外说明

- 当前数据文件除了角色基础信息，还已补入日文原名、罗马音、生日、年龄段、身高、学校、CV、交互动作统计和可用动作映射。
- `041-045` 这一批 Ave Mujica 资源现已全部切到可用本地包，角色名、团名、生日、学校、CV、动作统计和交互映射都已经写回数据文件。
- `041-045` 的 `21` 个变体已在真实 Chrome 中逐个验收：加载状态全部进入 `SIGNAL LOCK`，点击桌宠都能切到交互态，前后截图可见姿态变化；其中桌面宽度完成全量复核，移动宽度额外抽查了 `042_sumimi` 与 `044_event_297_story_01`，资料面板与桌宠画面均未出现遮挡或横向溢出。
- 首页桌宠信息面板已经改成：
  - 标题显示角色日文原名
  - `SIGNAL LOCK` 行显示罗马音 + 身高 + 生日代码
  - 可展开资料面板显示乐队、担当、生日、年龄、学校、CV、动作和交互统计
- `015` 在 Bestdori 角色槽位里是 `ミッシェル / Michelle` 的特殊位点，但当前导入的 Live2D 画面实际是奥沢美咲本人常服，因此当前展示主名保持为与画面一致的 `奥沢 美咲 / Okusawa Misaki`。
- 次选池如 `Project SEKAI / Vocaloid`、`CUE!` 这轮都没有进入主切换池：前者更像全身立绘缩裁，后者动作密度不够。
- 机器可读数据见 [src/data/bangdreamDeskPetPool.json](/home/hansbug/oo-projects/HansBug.github.io/src/data/bangdreamDeskPetPool.json)。
