# BanG Dream! 首页桌宠可切换池

## 结论

- 当前确认适合作为首页右下角 all-in-one 桌宠池的主资源，只保留 `BanG Dream!`。
- 已对 `57 / 57` 个条目完成真实浏览器接入、鼠标跟随、动作触发、桌面 / 移动端截图复核。
- 这一池统一为 `Cubism 2.1`，能走同一套运行时代码。
- 角色全部为真人类女性、非 chibi，且大多为半身便服立绘，和当前首页风格最稳。

## 默认推荐 5 人

- `bangdream_017_casual` 冰川纱夜 `017_casual`：综合色调最稳，右下角常驻时最不违和。
- `bangdream_006_casual` 美竹兰 `006_casual`：深色外套和站点工业感最贴。
- `bangdream_003_casual_winter` 牛込里美 `003_casual_winter`：冬装半身感最好，贴边自然。
- `bangdream_015_casual_winter` 若宫伊芙 `015_casual_winter`：动作多，活力够，但不吵。
- `bangdream_014_casual_winter` 大和麻弥 `014_casual_winter`：低饱和，稳定，适合作默认常驻。

## 统一动作基础

- 57 个条目共有动作：`angry01`、`bye01`、`idle01`、`left01`、`right01`、`nf01-05`、`sad01`、`serious01`、`shame01`、`smile01`、`surprised01`。
- 这意味着前端可以做统一语义映射，例如“打招呼 / 惊讶 / 害羞 / 常驻 / 左右看 / 随机 pose”，切人不需要换实现。
- 这批模型几乎都没有内置 `hitAreas`，所以交互应由页面统一绑事件，再映射到动作组。

## 角色与变体

- `001` 户山香澄 / Poppin'Party：`casual`、`casual_summer`、`casual_winter`
- `002` 花园多惠 / Poppin'Party：`casual`、`casual_summer`、`casual_winter`
- `003` 牛込里美 / Poppin'Party：`casual`、`casual_summer`、`casual_winter`
- `004` 山吹沙绫 / Poppin'Party：`casual`、`casual_summer`、`casual_winter`
- `005` 市谷有咲 / Poppin'Party：`casual`、`casual_summer`、`casual_winter`
- `006` 美竹兰 / Afterglow：`casual`、`casual_summer`、`casual_winter`
- `007` 青叶摩卡 / Afterglow：`casual`、`casual_summer`、`casual_winter`
- `008` 上原绯玛丽 / Afterglow：`casual`、`casual_summer`、`casual_winter`
- `009` 宇田川巴 / Afterglow：`casual`、`casual_summer`、`casual_winter`
- `010` 羽泽鸫 / Afterglow：`casual`、`casual_summer`、`casual_winter`
- `011` 丸山彩 / Pastel*Palettes：`casual`、`casual_summer`、`casual_winter`
- `012` 冰川日菜 / Pastel*Palettes：`casual`、`casual_summer`、`casual_winter`
- `013` 白鹭千圣 / Pastel*Palettes：`casual`、`casual_summer`、`casual_winter`
- `014` 大和麻弥 / Pastel*Palettes：`casual`、`casual_summer`、`casual_winter`
- `015` 若宫伊芙 / Pastel*Palettes：`casual`、`casual_summer`、`casual_winter`
- `016` 凑友希那 / Roselia：`casual`、`casual_summer`、`casual_winter`
- `017` 冰川纱夜 / Roselia：`casual`
- `018` 今井莉莎 / Roselia：`casual`
- `019` 宇田川亚子 / Roselia：`casual`
- `020` 白金燐子 / Roselia：`casual`
- `021` 弦卷心 / Hello, Happy World!：`casual`
- `022` 濑田薰 / Hello, Happy World!：`casual`
- `023` 北泽育美 / Hello, Happy World!：`casual`
- `024` 松原花音 / Hello, Happy World!：`casual`
- `025` 奥泽美咲 / Hello, Happy World!：`casual`

## 额外说明

- `Roselia` 的 `017-020` 和 `Hello, Happy World!` 的 `021-025` 当前只有 `casual`。
- 其余 `001-016` 基本都同时具备 `casual / casual_summer / casual_winter`。
- 次选池如 `Project SEKAI / Vocaloid`、`CUE!` 这轮都没有进入主切换池：前者更像全身立绘缩裁，后者动作密度不够。
- 机器可读数据见 [src/data/bangdreamDeskPetPool.json](/home/zhangshaoang/sensetime-projects/hansbug-tech-blog/src/data/bangdreamDeskPetPool.json)。
