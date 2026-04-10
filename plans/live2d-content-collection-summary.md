# Live2D 内容收集汇总

这份表是按当前仓库里已经显式落表的条目整理的，不把只在仓库级统计里出现、但还没有逐条写进文档的 `195 / 193` 全量 manifest 再次展开。

汇总规则：

- 成功表统一沿用当前“新增确认可用模型表”的列结构，并额外补 `IP` 列。
- 官方 / 上游 9 条基准样本原表没有 `实测尺寸` 与 `远程直挂补测`，这里分别补为 `未记录` 与 `通过`，把来源与入口格式压进备注。
- 失败表同时收录“真实加载失败”的条目和“已确认不属于 Live2D 直挂输入”的来源级排除项。

当前显式汇总：成功 `159` 条，失败 / 排除 `22` 条。

## 1. 已收集成功总表

| IP | 模型 | 资源类型 | 实测尺寸 | Runtime | Manifest URL | 下载后本地直挂 | 远程直挂补测 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pixi-live2d-display 上游样例 | Haru greeter | 全身 | 未记录 | Cubism 4 | `https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display@master/test/assets/haru/haru_greeter_t03.model3.json` | 通过 | 通过 | 来源：`pixi-live2d-display` 上游测试资源；入口：`model3.json + moc3`；与上游 README 体系一致，适合做挂件基准样本 |
| pixi-live2d-display 上游样例 | Shizuku | 半身 / 桌宠感 | 未记录 | Cubism 2.1 | `https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display@master/test/assets/shizuku/shizuku.model.json` | 通过 | 通过 | 来源：`pixi-live2d-display` 上游测试资源；入口：`model.json + moc`；旧格式样例，适合兼容验证，不建议当长期现代主角色 |
| Live2D 官方样例 | Haru | 全身 | 未记录 | Cubism 4 | `https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Haru/Haru.model3.json` | 通过 | 通过 | 来源：`Live2D/CubismWebSamples`；入口：`model3.json + moc3`；官方标准样例 |
| Live2D 官方样例 | Hiyori | 全身 | 未记录 | Cubism 4 | `https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Hiyori/Hiyori.model3.json` | 通过 | 通过 | 来源：`Live2D/CubismWebSamples`；入口：`model3.json + moc3`；官方标准样例 |
| Live2D 官方样例 | Mao | 全身 | 未记录 | Cubism 4 | `https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Mao/Mao.model3.json` | 通过 | 通过 | 来源：`Live2D/CubismWebSamples`；入口：`model3.json + moc3`；官方现代样例，适合测试现代效果 |
| Live2D 官方样例 | Mark | 简化人形 / 半身 | 未记录 | Cubism 4 | `https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Mark/Mark.model3.json` | 通过 | 通过 | 来源：`Live2D/CubismWebSamples`；入口：`model3.json + moc3`；结构简单，适合最小挂件原型 |
| Live2D 官方样例 | Natori | 全身 | 未记录 | Cubism 4 | `https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Natori/Natori.model3.json` | 通过 | 通过 | 来源：`Live2D/CubismWebSamples`；入口：`model3.json + moc3`；Jin Natori 路线样例，资源完整 |
| Live2D 官方样例 | Rice | 半身 / 横构图 | 未记录 | Cubism 4 | `https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Rice/Rice.model3.json` | 通过 | 通过 | 来源：`Live2D/CubismWebSamples`；入口：`model3.json + moc3`；构图更特别，适合测试非标准挂件布局 |
| Live2D 官方样例 | Wanko | 吉祥物 / 非人形 | 未记录 | Cubism 4 | `https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Wanko/Wanko.model3.json` | 通过 | 通过 | 来源：`Live2D/CubismWebSamples`；入口：`model3.json + moc3`；非人形角色，适合测试宠物式挂件 |
| 贤惠幼妻仙狐小姐 | Senko | 半身 / 桌宠风 | `3505 x 3003` | Cubism 4 | `https://raw.githubusercontent.com/Eikanya/Live2d-model/master/Live2D/Senko_Normals/senko.model3.json` | 通过 | 未补测 | `The Helpful Fox Senko-san` 路线，适合右下角挂件 |
| Fox Hime Zero | Fox Hime Zero `mori_miko` | 全身 | `2160 x 3840` | Cubism 4 | `https://raw.githubusercontent.com/Eikanya/Live2d-model/master/galgame%20live2d/Fox%20Hime%20Zero/mori_miko/mori_miko.model3.json` | 通过 | 未补测 | 标准竖向全身立绘 |
| Fox Hime Zero | Fox Hime Zero `mori_mikoc` | 全身 | `2160 x 3840` | Cubism 4 | `https://raw.githubusercontent.com/Eikanya/Live2d-model/master/galgame%20live2d/Fox%20Hime%20Zero/mori_mikoc/mori_mikoc.model3.json` | 通过 | 未补测 | 同系列变体 |
| Fox Hime Zero | Fox Hime Zero `mori_mikocfs` | 全身 | `2160 x 3840` | Cubism 4 | `https://raw.githubusercontent.com/Eikanya/Live2d-model/master/galgame%20live2d/Fox%20Hime%20Zero/mori_mikocfs/mori_mikocfs.model3.json` | 通过 | 未补测 | 同系列变体 |
| Fox Hime Zero | Fox Hime Zero `mori_suit` | 全身 | `2160 x 3840` | Cubism 4 | `https://raw.githubusercontent.com/Eikanya/Live2d-model/master/galgame%20live2d/Fox%20Hime%20Zero/mori_suit/mori_suit.model3.json` | 通过 | 未补测 | 同系列变体 |
| Fox Hime Zero | Fox Hime Zero `ruri_miko` | 全身 | `2160 x 3840` | Cubism 4 | `https://raw.githubusercontent.com/Eikanya/Live2d-model/master/galgame%20live2d/Fox%20Hime%20Zero/ruri_miko/ruri_miko.model3.json` | 通过 | 未补测 | 双纹理，细节量更高 |
| BanG Dream! | BanG Dream! `001_2018_dog` | 半身 / 角色立绘 | `2000 x 2500` | Cubism 2.1 | `https://raw.githubusercontent.com/Eikanya/Live2d-model/master/BanG%20Dream!/asneeded/live2d/chara/001/001_2018_dog/.model.json` | 通过 | 未补测 | 老格式 `model.json + moc` |
| BanG Dream! | BanG Dream! `001_miku_romecin` | 半身 / 角色立绘 | `2000 x 2500` | Cubism 2.1 | `https://raw.githubusercontent.com/Eikanya/Live2d-model/master/BanG%20Dream!/asneeded/live2d/chara/001/001_miku_romecin/.model.json` | 通过 | 未补测 | 老格式 `model.json + moc` |
| 碧蓝航线 | Z23 `z23` | 方构图 / 小挂件感 | `1200 x 1200` | Cubism 4 | `https://cdn.jsdelivr.net/gh/donjuanplatinum/AzurLane-Live2D@master/live2d/z23/z23.model3.json` | 通过 | `jsDelivr` 通过，`raw` 超时 | 本轮唯一补测到远程直挂成功的碧蓝航线条目 |
| 碧蓝航线 | Z46 `z46_3` | 方构图 / 大立绘 | `7000 x 7000` | Cubism 4 | `https://raw.githubusercontent.com/donjuanplatinum/AzurLane-Live2D/master/live2d/z46_3/z46_3.model3.json` | 通过 | 未补测 | 著名驱逐舰角色代表条目 |
| 碧蓝航线 | 企业 `qiye_7` | 全身 | `10500 x 10000` | Cubism 4 | `https://raw.githubusercontent.com/donjuanplatinum/AzurLane-Live2D/master/live2d/qiye_7/qiye_7.model3.json` | 通过 | 未补测 | 大尺寸现代立绘 |
| 碧蓝航线 | 俾斯麦 `bisimai_2` | 全身 / 大立绘 | `7197 x 7625` | Cubism 4 | `https://raw.githubusercontent.com/donjuanplatinum/AzurLane-Live2D/master/live2d/bisimai_2/bisimai_2.model3.json` | 通过 | 未补测 | 大尺寸单纹理条目 |
| 碧蓝航线 | 凌波 `lingbo` | 方构图 / 小挂件感 | `1200 x 1200` | Cubism 4 | `https://raw.githubusercontent.com/donjuanplatinum/AzurLane-Live2D/master/live2d/lingbo/lingbo.model3.json` | 通过 | 未补测 | 纹理数 `4` |
| 碧蓝航线 | 大凤 `dafeng_4` | 全身 | `7000 x 7300` | Cubism 4 | `https://raw.githubusercontent.com/donjuanplatinum/AzurLane-Live2D/master/live2d/dafeng_4/dafeng_4.model3.json` | 通过 | 未补测 | 适合测试复杂互动角色 |
| 碧蓝航线 | 宁海 `ninghai_4` | 横构图 / 角色立绘 | `6000 x 5000` | Cubism 4 | `https://raw.githubusercontent.com/donjuanplatinum/AzurLane-Live2D/master/live2d/ninghai_4/ninghai_4.model3.json` | 通过 | 未补测 | 与平海形成成对条目 |
| 碧蓝航线 | 平海 `pinghai_4` | 横构图 / 角色立绘 | `6000 x 5000` | Cubism 4 | `https://raw.githubusercontent.com/donjuanplatinum/AzurLane-Live2D/master/live2d/pinghai_4/pinghai_4.model3.json` | 通过 | 未补测 | 与宁海同组，比例一致 |
| 碧蓝航线 | 拉菲 `lafei` | 方构图 / 小挂件感 | `1200 x 1200` | Cubism 4 | `https://raw.githubusercontent.com/donjuanplatinum/AzurLane-Live2D/master/live2d/lafei/lafei.model3.json` | 通过 | `raw` 超时，`jsDelivr` 超时 | 适合做右下角悬浮挂件 |
| 碧蓝航线 | 提尔比茨 `tierbici_2` | 方构图 / 小挂件感 | `1700 x 1700` | Cubism 4 | `https://raw.githubusercontent.com/donjuanplatinum/AzurLane-Live2D/master/live2d/tierbici_2/tierbici_2.model3.json` | 通过 | 未补测 | 双纹理，小尺寸里结构最紧凑的一类 |
| 碧蓝航线 | 明石 `mingshi` | 方构图 / 小挂件感 | `1200 x 1200` | Cubism 4 | `https://raw.githubusercontent.com/donjuanplatinum/AzurLane-Live2D/master/live2d/mingshi/mingshi.model3.json` | 通过 | 未补测 | 单纹理，轻量 |
| 碧蓝航线 | 标枪 `biaoqiang` | 方构图 / 小挂件感 | `1200 x 1200` | Cubism 4 | `https://raw.githubusercontent.com/donjuanplatinum/AzurLane-Live2D/master/live2d/biaoqiang/biaoqiang.model3.json` | 通过 | 未补测 | 纹理数 `7`，资源较完整 |
| 碧蓝航线 | 独角兽 `dujiaoshou_4` | 方构图 / 角色立绘 | `5000 x 5000` | Cubism 4 | `https://raw.githubusercontent.com/donjuanplatinum/AzurLane-Live2D/master/live2d/dujiaoshou_4/dujiaoshou_4.model3.json` | 通过 | 未补测 | 大方图，做挂件裁切也友好 |
| 碧蓝航线 | 翔鹤 `xianghe_2` | 方构图 / 大立绘 | `7000 x 7000` | Cubism 4 | `https://raw.githubusercontent.com/donjuanplatinum/AzurLane-Live2D/master/live2d/xianghe_2/xianghe_2.model3.json` | 通过 | 未补测 | 高分辨率单纹理条目 |
| 碧蓝航线 | 贝尔法斯特 `beierfasite_2` | 全身 / 大立绘 | `3508 x 4961` | Cubism 4 | `https://raw.githubusercontent.com/donjuanplatinum/AzurLane-Live2D/master/live2d/beierfasite_2/beierfasite_2.model3.json` | 通过 | 未补测 | 经典女仆角色代表条目 |
| 碧蓝航线 | 雪风 `xuefeng` | 方构图 / 小挂件感 | `1200 x 1200` | Cubism 4 | `https://raw.githubusercontent.com/donjuanplatinum/AzurLane-Live2D/master/live2d/xuefeng/xuefeng.model3.json` | 通过 | 未补测 | 纹理数 `6` |
| CUE! | `001 / 001_001` | 全身 | `3039 x 4298` | Cubism 4 | `https://raw.githubusercontent.com/Cpk0521/CUE-live2d-Viewer/master/live2d/001/001_001/001.model3.json` | 通过 | `raw` 超时，`jsDelivr` 超时 | 这是本轮重试过的首个 CUE 条目 |
| CUE! | `016 / 016_013` | 全身 | `3039 x 4298` | Cubism 4 | `https://raw.githubusercontent.com/Cpk0521/CUE-live2d-Viewer/master/live2d/016/016_013/016.model3.json` | 通过 | 未补测 | 同仓库内路径规律稳定 |
| CUE! | `103 / 103_001` | 全身 | `3039 x 4298` | Cubism 4 | `https://raw.githubusercontent.com/Cpk0521/CUE-live2d-Viewer/master/live2d/103/103_001/103.model3.json` | 通过 | 未补测 | 说明后段编号资源也不是“前面几条特例” |
| 崩坏学园 2 | `Nindi` | 细高全身 | `2806 x 5332` | Cubism 2.1 | `https://raw.githubusercontent.com/KISGP/model/main/live2d/BengHuai2/Nindi/model.json` | 通过 | 未补测 | 这组里最高的竖向立绘之一 |
| 崩坏学园 2 | `keluoyi` | 方构图 / 角色立绘 | `2000 x 2000` | Cubism 2.1 | `https://raw.githubusercontent.com/KISGP/model/main/live2d/BengHuai2/keluoyi/model.json` | 通过 | 未补测 | 轻量方图，适合补齐老格式角色池 |
| 崩坏学园 2 | 丽塔 `Lita` | 竖向角色立绘 | `1800 x 2000` | Cubism 2.1 | `https://raw.githubusercontent.com/KISGP/model/main/live2d/BengHuai2/Lita/model.json` | 通过 | 未补测 | 竖向比例更适合侧栏挂件 |
| 崩坏学园 2 | 伊瑟琳 `yiselin` | 竖向角色立绘 | `2500 x 3000` | Cubism 2.1 | `https://raw.githubusercontent.com/KISGP/model/main/live2d/BengHuai2/yiselin/model.json` | 通过 | 未补测 | 补齐后 `BengHuai2` 子目录达到 `10 / 10` 通过 |
| 崩坏学园 2 | 八重樱 `BYC` | 方构图 / 角色立绘 | `2480 x 2480` | Cubism 2.1 | `https://raw.githubusercontent.com/KISGP/model/main/live2d/BengHuai2/BYC/model.json` | 通过 | 未补测 | 接近方图，挂件友好 |
| 崩坏学园 2 | 布洛妮娅 `bronya` | 方构图 / 角色立绘 | `2500 x 2500` | Cubism 2.1 | `https://raw.githubusercontent.com/KISGP/model/main/live2d/BengHuai2/bronya/model.json` | 通过 | 未补测 | 方构图稳定，适合桌宠化裁切 |
| 崩坏学园 2 | 希儿 `xier` | 竖向角色立绘 | `1400 x 2700` | Cubism 2.1 | `https://raw.githubusercontent.com/KISGP/model/main/live2d/BengHuai2/xier/model.json` | 通过 | 未补测 | 细高构图，适合全身展示 |
| 崩坏学园 2 | 时雨绮罗 `Kiro` | 方构图 / 角色立绘 | `2000 x 2000` | Cubism 2.1 | `https://raw.githubusercontent.com/KISGP/model/main/live2d/BengHuai2/Kiro/model.json` | 通过 | 未补测 | 最接近标准桌宠方图 |
| 崩坏学园 2 | 耀夜姬 `kaguya` | 方构图 / 角色立绘 | `2000 x 2100` | Cubism 2.1 | `https://raw.githubusercontent.com/KISGP/model/main/live2d/BengHuai2/kaguya/model.json` | 通过 | 未补测 | 老格式但资源完整 |
| 崩坏学园 2 | 西琳 `xilin2.1` | 竖向角色立绘 | `3000 x 3500` | Cubism 2.1 | `https://raw.githubusercontent.com/KISGP/model/main/live2d/BengHuai2/xilin2.1/model.json` | 通过 | 未补测 | 比例稳定，适合全身展示 |
| 崩坏：星穹铁道 | 卡夫卡 | 全身 / 大立绘 | `3326 x 6162` | Cubism 4 | `https://raw.githubusercontent.com/KISGP/model/main/live2d/StarRail/卡夫卡/卡夫卡.model3.json` | 通过 | 未补测 | 这轮首个跑通的星铁条目 |
| 崩坏：星穹铁道 | 知更鸟 | 全身 / 大立绘 | `6363 x 9000` | Cubism 4 | `https://raw.githubusercontent.com/KISGP/model/main/live2d/StarRail/知更鸟/知更鸟.model3.json` | 通过 | 未补测 | 高分辨率双纹理条目 |
| 崩坏：星穹铁道 | 符玄 | 全身 / 大立绘 | `6000 x 8487` | Cubism 4 | `https://raw.githubusercontent.com/KISGP/model/main/live2d/StarRail/符玄/符玄.model3.json` | 通过 | 未补测 | 纹理数 `8`，复杂度较高 |
| 崩坏：星穹铁道 | 花火 | 全身 / 大立绘 | `3836 x 4750` | Cubism 4 | `https://raw.githubusercontent.com/KISGP/model/main/live2d/StarRail/花火/花火.model3.json` | 通过 | 未补测 | 尺寸更紧凑，适合中型挂件 |
| 崩坏：星穹铁道 | 藿藿 | 全身 / 大立绘 | `6000 x 8487` | Cubism 4 | `https://raw.githubusercontent.com/KISGP/model/main/live2d/StarRail/藿藿/藿藿.model3.json` | 通过 | 未补测 | 纹理数 `4` |
| 崩坏：星穹铁道 | 镜流 | 全身 / 大立绘 | `3454 x 4160` | Cubism 4 | `https://raw.githubusercontent.com/KISGP/model/main/live2d/StarRail/镜流/镜流.model3.json` | 通过 | 未补测 | 单纹理，轻量于大多数星铁条目 |
| 少女前线 | 95 式 `95type_405` | 方构图 / 桌宠感 | `1024 x 1024` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/95type_405/95type_405.model.json` | 通过 | 未补测 | 这批里最接近小挂件尺寸 |
| 少女前线 | AA-12 `aa12_2403` | 全身 / 大立绘 | `6000 x 7000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/aa12_2403/aa12_2403.model.json` | 通过 | 未补测 | 大型竖向立绘 |
| 少女前线 | AK-12 `ak12_3302` | 全身 / 大立绘 | `4000 x 5813` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/ak12_3302/ak12_3302.model.json` | 通过 | 未补测 | 大竖图 |
| 少女前线 | AN-94 `an94_3303` | 全身 / 大立绘 | `3000 x 4360` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/an94_3303/an94_3303.model.json` | 通过 | 未补测 | 与 AK-12 形成配套代表样本 |
| 少女前线 | Carcano M1891 `carcano1891_2201` | 全身 / 角色立绘 | `2480 x 3508` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/carcano1891_2201/carcano1891_2201.model.json` | 通过 | 未补测 | Carcano 姐妹之一 |
| 少女前线 | Carcano M1938 `carcano1938_2202` | 全身 / 角色立绘 | `2480 x 3508` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/carcano1938_2202/carcano1938_2202.model.json` | 通过 | 未补测 | 与 `M1891` 构成配套条目 |
| 少女前线 | Contender `contender_2302` | 全身 / 角色立绘 | `2480 x 3508` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/contender_2302/contender_2302.model.json` | 通过 | 未补测 | 中等尺寸，适合常规侧栏挂件 |
| 少女前线 | DSR-50 `dsr50_1801` | 全身 / 大立绘 | `5000 x 6036` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/dsr50_1801/dsr50_1801.model.json` | 通过 | 未补测 | 高分辨率代表条目 |
| 少女前线 | FN-57 `fn57_2203` | 全身 / 大立绘 | `5000 x 6500` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/fn57_2203/fn57_2203.model.json` | 通过 | 未补测 | 细高比例，更适合全身展示 |
| 少女前线 | G36C `g36c_1202` | 全身 / 大立绘 | `2757 x 4130` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/g36c_1202/g36c_1202.model.json` | 通过 | 未补测 | 比例更适中 |
| 少女前线 | G41 `g41_2401` | 全身 / 大立绘 | `5000 x 6000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/g41_2401/g41_2401.model.json` | 通过 | 未补测 | 这组里分辨率最高的少女前线条目之一 |
| 少女前线 | Grizzly `grizzly_2102` | 全身 / 大立绘 | `4500 x 6000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/grizzly_2102/grizzly_2102.model.json` | 通过 | 未补测 | 高辨识度角色之一 |
| 少女前线 | HK416 `hk416_3401` | 全身 / 大立绘 | `3500 x 5000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/hk416_3401/hk416_3401.model.json` | 通过 | 未补测 | 著名角色代表条目 |
| 少女前线 | K2 `k2_3301` | 横构图 / 角色立绘 | `4522 x 4300` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/k2_3301/k2_3301.model.json` | 通过 | 未补测 | 比大多数 GFL 条目更接近横构图 |
| 少女前线 | NTW-20 `ntw20_2301` | 全身 / 角色立绘 | `2480 x 3507` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/ntw20_2301/ntw20_2301.model.json` | 通过 | 未补测 | 细高比例稳定 |
| 少女前线 | OTs-14 `ots14_3001` | 全身 / 大立绘 | `4800 x 5328` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/ots14_3001/ots14_3001.model.json` | 通过 | 未补测 | 宽一些的全身构图 |
| 少女前线 | Px4 Storm `px4storm_2801` | 全身 / 大立绘 | `3480 x 4923` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/px4storm_2801/px4storm_2801.model.json` | 通过 | 未补测 | 中大型竖向立绘 |
| 少女前线 | RFB `rfb_1601` | 全身 / 大立绘 | `4213 x 5797` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/rfb_1601/rfb_1601.model.json` | 通过 | 未补测 | 著名 AR 角色补充条目 |
| 少女前线 | SAT8 `sat8_2601` | 横构图 / 角色立绘 | `5190 x 3508` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/sat8_2601/sat8_2601.model.json` | 通过 | 未补测 | 宽构图版本，适合横向展示区 |
| 少女前线 | SAT8 `sat8_3602` | 全身 / 大立绘 | `3508 x 4961` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/sat8_3602/sat8_3602.model.json` | 通过 | 未补测 | 同角色的竖向版本 |
| 少女前线 | UMP45 `ump45_3403` | 全身 / 角色立绘 | `2480 x 3861` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/ump45_3403/ump45_3403.model.json` | 通过 | 未补测 | 中等尺寸 |
| 少女前线 | UMP9 `ump9_3404` | 全身 / 角色立绘 | `2480 x 3861` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/ump9_3404/ump9_3404.model.json` | 通过 | 未补测 | 可与 `UMP45` 组成配对条目 |
| 少女前线 | Vector `vector_1901` | 宽构图 / 角色立绘 | `3661 x 3900` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/vector_1901/vector_1901.model.json` | 通过 | 未补测 | 接近方图但横向更宽一点 |
| 少女前线 | WA2000 `wa2000_6` | 方构图 / 角色立绘 | `1920 x 1920` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/wa2000_6/wa2000_6.model.json` | 通过 | 未补测 | 方图，适合挂件裁切 |
| 少女前线 | Welrod `welrod_1401` | 方构图 / 角色立绘 | `3500 x 3600` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/welrod_1401/welrod_1401.model.json` | 通过 | 未补测 | 接近方图，做挂件裁切也比较友好 |
| 少女前线 | 格琳娜 `gelina` | 全身 / 角色立绘 | `3400 x 3826` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/gelina/gelina.model.json` | 通过 | 未补测 | 辨识度很高的副官角色 |
| 超次元海王星 | Blanc `blanc_normal` | 横构图 / 角色立绘 | `3750 x 3000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/HyperdimensionNeptunia/blanc_normal/model.json` | 通过 | 未补测 | 四纹理 |
| 超次元海王星 | Blanc 泳装 `blanc_swimwear` | 横构图 / 角色立绘 | `3750 x 3000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/HyperdimensionNeptunia/blanc_swimwear/model.json` | 通过 | 未补测 | 三纹理，略轻于基础版 |
| 超次元海王星 | Nepgear `nepgear` | 横构图 / 角色立绘 | `3750 x 3000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/HyperdimensionNeptunia/nepgear/model.json` | 通过 | 未补测 | 四纹理 |
| 超次元海王星 | Nepgear 泳装 `nepgearswim` | 横构图 / 角色立绘 | `3750 x 3000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/HyperdimensionNeptunia/nepgearswim/model.json` | 通过 | 未补测 | 四纹理，复杂度与基础版一致 |
| 超次元海王星 | Neptune `nepnep` | 横构图 / 角色立绘 | `3750 x 3000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/HyperdimensionNeptunia/nepnep/model.json` | 通过 | 未补测 | 本轮最经典的海王星代表条目 |
| 超次元海王星 | Neptune 圣诞 `neptune_santa` | 横构图 / 角色立绘 | `3750 x 3000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/HyperdimensionNeptunia/neptune_santa/model.json` | 通过 | 未补测 | 经典角色节日变体 |
| 超次元海王星 | Noir `noir` | 横构图 / 角色立绘 | `3750 x 3000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/HyperdimensionNeptunia/noir/model.json` | 通过 | 未补测 | 三纹理 |
| 超次元海王星 | Noir 圣诞 `noir_santa` | 横构图 / 角色立绘 | `3750 x 3000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/HyperdimensionNeptunia/noir_santa/model.json` | 通过 | 未补测 | 经典角色节日变体 |
| 超次元海王星 | Vert `vert_normal` | 横构图 / 角色立绘 | `3750 x 3000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/HyperdimensionNeptunia/vert_normal/model.json` | 通过 | 未补测 | 四纹理 |
| 超次元海王星 | Vert 泳装 `vert_swimwear` | 横构图 / 角色立绘 | `3750 x 3000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/HyperdimensionNeptunia/vert_swimwear/model.json` | 通过 | 未补测 | 四纹理，适合作为变体补充 |
| Vocaloid / Miku | Snow Miku | 横构图 / 大立绘 | `4000 x 3200` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/moc/snow_miku/model.json` | 通过 | 未补测 | 著名 Miku 变体 |
| Vocaloid / Miku | 初音未来 `miku` | 半身 / 轻量挂件 | `900 x 1200` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/moc/miku/miku.model.json` | 通过 | 未补测 | 轻量级老格式代表条目 |
| Project SEKAI / Vocaloid | KAITO `26kaito_band` | 全身 / 乐队风 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/26kaito/26kaito_band/26kaito_band.model3.json` | 通过 | 未补测 | 说明男 Vocaloid 变体也同样稳定 |
| Project SEKAI / Vocaloid | KAITO `26kaito_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/26kaito/26kaito_normal/26kaito_normal.model3.json` | 通过 | 未补测 | Vocaloid 代表条目 |
| Project SEKAI / Vocaloid | MEIKO `25meiko_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/25meiko/25meiko_normal/25meiko_normal.model3.json` | 通过 | 未补测 | Vocaloid 代表条目 |
| Project SEKAI / Vocaloid | MEIKO `25meiko_wonder` | 全身 / 游乐舞台风 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/25meiko/25meiko_wonder/25meiko_wonder.model3.json` | 通过 | 未补测 | `Wonder` 方向代表条目 |
| Project SEKAI / Vocaloid | 东云彰人 `11akito_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/11akito/11akito_normal/11akito_normal.model3.json` | 通过 | 未补测 | `Vivid BAD SQUAD` 基础角色 |
| Project SEKAI / Vocaloid | 凤笑梦 `14emu_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/14emu/14emu_normal/14emu_normal.model3.json` | 通过 | 未补测 | `Wonderlands x Showtime` 基础角色 |
| Project SEKAI / Vocaloid | 初音未来 `21miku_band` | 全身 / 乐队风 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/21miku/21miku_band/21miku_band.model3.json` | 通过 | 未补测 | 适合补齐 `Leo/need` 路线 |
| Project SEKAI / Vocaloid | 初音未来 `21miku_idol` | 全身 / 偶像风 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/21miku/21miku_idol/21miku_idol.model3.json` | 通过 | 未补测 | 适合补齐 `MORE MORE JUMP!` 路线 |
| Project SEKAI / Vocaloid | 初音未来 `21miku_night` | 全身 / 夜曲风 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/21miku/21miku_night/21miku_night.model3.json` | 通过 | 未补测 | `25 时，Nightcord 见` 路线变体 |
| Project SEKAI / Vocaloid | 初音未来 `21miku_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/21miku/21miku_normal/21miku_normal.model3.json` | 通过 | 未补测 | 现代 `Miku` 样本，优先级很高 |
| Project SEKAI / Vocaloid | 初音未来 `21miku_street` | 全身 / 街头风 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/21miku/21miku_street/21miku_street.model3.json` | 通过 | 未补测 | `Vivid BAD SQUAD` 路线变体 |
| Project SEKAI / Vocaloid | 初音未来 `21miku_wonder` | 全身 / 游乐舞台风 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/21miku/21miku_wonder/21miku_wonder.model3.json` | 通过 | 未补测 | `Wonderlands x Showtime` 路线变体 |
| Project SEKAI / Vocaloid | 天马司 `13tsukasa_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/13tsukasa/13tsukasa_normal/13tsukasa_normal.model3.json` | 通过 | 未补测 | `Wonderlands x Showtime` 主角路线 |
| Project SEKAI / Vocaloid | 天马咲希 `02saki_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/02saki/02saki_normal/02saki_normal.model3.json` | 通过 | 未补测 | `Leo/need` 基础角色 |
| Project SEKAI / Vocaloid | 宵崎奏 `17kanade_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/17kanade/17kanade_normal/17kanade_normal.model3.json` | 通过 | 未补测 | `25 时，Nightcord 见` 核心角色 |
| Project SEKAI / Vocaloid | 小豆泽心羽 `09kohane_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/09kohane/09kohane_normal/09kohane_normal.model3.json` | 通过 | 未补测 | `Vivid BAD SQUAD` 基础角色 |
| Project SEKAI / Vocaloid | 巡音流歌 `24luka_night` | 全身 / 夜曲风 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/24luka/24luka_night/24luka_night.model3.json` | 通过 | 未补测 | 与 `Nightcord` 路线对应 |
| Project SEKAI / Vocaloid | 巡音流歌 `24luka_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/24luka/24luka_normal/24luka_normal.model3.json` | 通过 | 未补测 | Vocaloid 代表条目 |
| Project SEKAI / Vocaloid | 日野森志步 `04shiho_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/04shiho/04shiho_normal/04shiho_normal.model3.json` | 通过 | 未补测 | `Leo/need` 基础角色 |
| Project SEKAI / Vocaloid | 日野森雫 `08shizuku_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/08shizuku/08shizuku_normal/08shizuku_normal.model3.json` | 通过 | 未补测 | `MORE MORE JUMP!` 基础角色 |
| Project SEKAI / Vocaloid | 星乃一歌 `01ichika_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/01ichika/01ichika_normal/01ichika_normal.model3.json` | 通过 | 未补测 | `Leo/need` 主唱路线 |
| Project SEKAI / Vocaloid | 望月穗波 `03honami_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/03honami/03honami_normal/03honami_normal.model3.json` | 通过 | 未补测 | `Leo/need` 基础角色 |
| Project SEKAI / Vocaloid | 朝比奈真冬 `18mafuyu_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/18mafuyu/18mafuyu_normal/18mafuyu_normal.model3.json` | 通过 | 未补测 | `25 时，Nightcord 见` 路线 |
| Project SEKAI / Vocaloid | 桃井爱莉 `07airi_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/07airi/07airi_normal/07airi_normal.model3.json` | 通过 | 未补测 | `MORE MORE JUMP!` 基础角色 |
| Project SEKAI / Vocaloid | 桐谷遥 `06haruka_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/06haruka/06haruka_normal/06haruka_normal.model3.json` | 通过 | 未补测 | `MORE MORE JUMP!` 基础角色 |
| Project SEKAI / Vocaloid | 白石杏 `10an_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/10an/10an_normal/10an_normal.model3.json` | 通过 | 未补测 | `Vivid BAD SQUAD` 基础角色 |
| Project SEKAI / Vocaloid | 神代类 `16rui_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/16rui/16rui_normal/16rui_normal.model3.json` | 通过 | 未补测 | 与宁宁同 IP 路线 |
| Project SEKAI / Vocaloid | 花里实乃理 `05minori_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/05minori/05minori_normal/05minori_normal.model3.json` | 通过 | 未补测 | `MORE MORE JUMP!` 基础角色 |
| Project SEKAI / Vocaloid | 草薙宁宁 `15nene_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/15nene/15nene_normal/15nene_normal.model3.json` | 通过 | 未补测 | `Wonderlands x Showtime` 路线 |
| Project SEKAI / Vocaloid | 镜音连 `23len_band` | 全身 / 乐队风 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/23len/23len_band/23len_band.model3.json` | 通过 | 未补测 | 与 `Miku band` 风格对应 |
| Project SEKAI / Vocaloid | 镜音连 `23len_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/23len/23len_normal/23len_normal.model3.json` | 通过 | 未补测 | Vocaloid 代表条目 |
| Project SEKAI / Vocaloid | 镜音连 `23len_wonder` | 全身 / 游乐舞台风 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/23len/23len_wonder/23len_wonder.model3.json` | 通过 | 未补测 | 与 `Wonderlands x Showtime` 路线对应 |
| Project SEKAI / Vocaloid | 青柳冬弥 `12touya_normal` | 全身 / 标准立绘 | `3000 x 4500` | Cubism 4 | `https://raw.githubusercontent.com/lezzthanthree/SEKAI-Stories/master/public/live2d/model/12touya/12touya_normal/12touya_normal.model3.json` | 通过 | 未补测 | `Vivid BAD SQUAD` 基础角色 |
| 少女前线 | G36 `g36_2407` | 全身 / 角色立绘 | `2480 x 3508` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/g36_2407/g36_2407.model.json` | 通过 | 未补测 | G36 补充皮肤条目 |
| 少女前线 | HK416 `hk416_805` | 全身 / 大立绘 | `4000 x 5000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/hk416_805/hk416_805.model.json` | 通过 | 未补测 | HK416 补充皮肤条目，单纹理 |
| 少女前线 | KP-31 `kp31_1103` | 全身 / 角色立绘 | `2894 x 4093` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/kp31_1103/kp31_1103.model.json` | 通过 | 未补测 | 索米 KP-31 代表条目 |
| 少女前线 | Lewis `lewis_3502` | 全身 / 大立绘 | `3207 x 4835` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/lewis_3502/lewis_3502.model.json` | 通过 | 未补测 | Lewis 补充皮肤条目 |
| 少女前线 | M950A `m950a_2303` | 全身 / 大立绘 | `5189 x 6000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/m950a_2303/m950a_2303.model.json` | 通过 | 未补测 | 宽幅感更强的大尺寸条目 |
| 少女前线 | OTs-14 `ots14_1203` | 全身 / 角色立绘 | `2600 x 4000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/ots14_1203/ots14_1203.model.json` | 通过 | 未补测 | OTs-14 补充皮肤条目 |
| 少女前线 | PKP `pkp_1201` | 全身 / 角色立绘 | `2480 x 3507` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/pkp_1201/pkp_1201.model.json` | 通过 | 未补测 | PKP 代表条目 |
| 少女前线 | R93 `r93_3501` | 方构图 / 大立绘 | `6000 x 5920` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/Girls%27%20Frontline/r93_3501/r93_3501.model.json` | 通过 | 未补测 | 更接近方图的大尺寸条目 |
| 超次元海王星 | Blanc `blanc_classic` | 横构图 / 角色立绘 | `3750 x 3000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/HyperdimensionNeptunia/blanc_classic/model.json` | 通过 | 未补测 | Blanc 经典服装变体，四纹理 |
| 超次元海王星 | Histoire | 吉祥物 / 精灵感 | `1536 x 1024` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/HyperdimensionNeptunia/histoire/model.json` | 通过 | 未补测 | 尺寸最小的一条，适合轻量挂件 |
| 超次元海王星 | Nepgear `nepgear_extra` | 横构图 / 角色立绘 | `3750 x 3000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/HyperdimensionNeptunia/nepgear_extra/model.json` | 通过 | 未补测 | Nepgear 额外变体，四纹理 |
| 超次元海王星 | Neptune 女仆 `nepmaid` | 横构图 / 角色立绘 | `3750 x 3000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/HyperdimensionNeptunia/nepmaid/model.json` | 通过 | 未补测 | Neptune 女仆变体，三纹理 |
| 超次元海王星 | Neptune 泳装 `nepswim` | 横构图 / 角色立绘 | `3750 x 3000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/HyperdimensionNeptunia/nepswim/model.json` | 通过 | 未补测 | Neptune 泳装变体，三纹理 |
| 超次元海王星 | Neptune `neptune_classic` | 横构图 / 角色立绘 | `3750 x 3000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/HyperdimensionNeptunia/neptune_classic/model.json` | 通过 | 未补测 | Neptune 经典服装变体 |
| 超次元海王星 | Noir `noir_classic` | 横构图 / 角色立绘 | `3750 x 3000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/HyperdimensionNeptunia/noir_classic/model.json` | 通过 | 未补测 | Noir 经典服装变体 |
| 超次元海王星 | Noir 泳装 `noireswim` | 横构图 / 角色立绘 | `3750 x 3000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/HyperdimensionNeptunia/noireswim/model.json` | 通过 | 未补测 | Noir 泳装变体，三纹理 |
| 超次元海王星 | Vert `vert_classic` | 横构图 / 角色立绘 | `3750 x 3000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/HyperdimensionNeptunia/vert_classic/model.json` | 通过 | 未补测 | Vert 经典服装变体，四纹理 |
| 请问您今天要来点兔子吗？ | Chino | 轻量半身 / 小挂件 | `1031 x 1377` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/moc/chino/model.json` | 通过 | 未补测 | 轻量单纹理，小尺寸也能跑通 |
| 小林家的龙女仆 | Kanna | 竖向角色立绘 | `1200 x 2133` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/moc/kanna/model.json` | 通过 | 未补测 | 康娜代表条目，单纹理 |
| 魔法禁书目录 / 某科学的超电磁炮 | 白井黑子 `kuroko` | 横构图 / 角色立绘 | `1300 x 1000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/moc/kuroko/kuroko.model.json` | 通过 | 未补测 | 双纹理，Toaru 配套角色 |
| 约会大作战 | Kurumi | 方构图 / 桌宠感 | `1024 x 1024` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/moc/kurumi/model.json` | 通过 | 未补测 | 时崎狂三代表条目，三纹理 |
| Vocaloid / 镜音连 | 镜音连 `len_impact` | 全身 / 大立绘 | `4050 x 4500` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/moc/len_impact/len_impact.model.json` | 通过 | 未补测 | 冲击风格变体，单纹理 |
| Vocaloid / 镜音连 | 镜音连 `len_space` | 全身 / 大立绘 | `4050 x 4500` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/moc/len_space/len_space.model.json` | 通过 | 未补测 | 太空风变体，单纹理 |
| Vocaloid / 镜音连 | 镜音连 `len_swim` | 全身 / 大立绘 | `4050 x 4500` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/moc/len_swim/len_swim.model.json` | 通过 | 未补测 | 泳装变体，单纹理 |
| Vocaloid / 镜音连 | 镜音连 `len` | 全身 / 大立绘 | `4050 x 4500` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/moc/len/len.model.json` | 通过 | 未补测 | 基础版镜音连，单纹理 |
| 魔法少女小圆 | Madoka | 竖向角色立绘 | `2400 x 3100` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/moc/madoka/model.json` | 通过 | 未补测 | 鹿目圆代表条目，单纹理 |
| 魔法禁书目录 / 某科学的超电磁炮 | 御坂美琴 `mikoto` | 横构图 / 角色立绘 | `1300 x 1000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/moc/mikoto/mikoto.model.json` | 通过 | 未补测 | 双纹理，超电磁炮核心角色 |
| 工作细胞 | Platelet | 方构图 / 桌宠感 | `2048 x 2048` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/moc/platelet/model.json` | 通过 | 未补测 | 血小板代表条目，方图很适合桌宠化 |
| Re:Zero | Rem | 竖向角色立绘 | `2500 x 2900` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/moc/rem/model.json` | 通过 | 未补测 | 著名女主角代表条目，单纹理 |
| 埃罗芒阿老师 | Sagiri | 竖向角色立绘 | `1200 x 2133` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/moc/sagiri/model.json` | 通过 | 未补测 | 双纹理，适合中型挂件 |
| 魔法禁书目录 / 某科学的超电磁炮 | 佐天泪子 `saten` | 横构图 / 角色立绘 | `1300 x 1000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/moc/saten/saten.model.json` | 通过 | 未补测 | 双纹理，Toaru 配套角色 |
| 魔法禁书目录 / 某科学的超电磁炮 | 上条当麻 `touma` | 横构图 / 角色立绘 | `1300 x 1000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/moc/touma/touma.model.json` | 通过 | 未补测 | 双纹理，Toaru 系列男主样本 |
| 魔法禁书目录 / 某科学的超电磁炮 | 初春饰利 `uiharu` | 横构图 / 角色立绘 | `1300 x 1000` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/moc/uiharu/uiharu.model.json` | 通过 | 未补测 | 双纹理，Toaru 配套角色 |
| 干物妹！小埋 | Umaru | 轻量半身 / 小挂件 | `978 x 1295` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/moc/umaru/model.json` | 通过 | 未补测 | 轻量条目，适合右下角挂件 |
| Vocal synth / 结月缘 | 结月缘 `yukari_model` | 轻量半身 / 小挂件 | `881 x 1024` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/moc/yukari_model/yukari_model.model.json` | 通过 | 未补测 | 更轻量的旧版结月缘模型 |
| Vocal synth / 结月缘 | 结月缘 `YuzukiYukari` | 竖向角色立绘 | `1240 x 1754` | Cubism 2.1 | `https://raw.githubusercontent.com/zenghongtu/live2d-model-assets/master/assets/moc/YuzukiYukari/YuzukiYukari.model.json` | 通过 | 未补测 | 旧格式里更完整的一版，单纹理 |

## 2. 确认失败 / 排除总表

| IP | 条目 | 类型 | Runtime | 下载后本地直挂 | 实测状态 | 失败原因 |
| --- | --- | --- | --- | --- | --- | --- |
| 官方样例候选 | Ren | Live2D 模型 | Cubism 4 | 不适用 | 失败 | `pixi-live2d-display` + `cubism4.min.js` 真实加载时抛出 `Unknown error`，当前不能直接列入稳定可用清单 |
| BanG Dream! | `arisa_event053.1024` | Live2D 模型 | Cubism 2.1 | 失败 | 失败 | `Texture loading error` |
| BanG Dream! | `kanon_event011.1024` | Live2D 模型 | Cubism 2.1 | 失败 | 失败 | `Texture loading error` |
| BanG Dream! | `kaoru_live_t_shirt_t03.1024` | Live2D 模型 | Cubism 2.1 | 失败 | 失败 | `Texture loading error` |
| BanG Dream! | `kasumi_event053.1024` | Live2D 模型 | Cubism 2.1 | 失败 | 失败 | `Texture loading error` |
| BanG Dream! | `kokoro_live_t_shirt_t02.1024` | Live2D 模型 | Cubism 2.1 | 失败 | 失败 | `Texture loading error` |
| BanG Dream! | `misaki_live_t_shirt_t01.1024` | Live2D 模型 | Cubism 2.1 | 失败 | 失败 | `Texture loading error` |
| BanG Dream! | `rimi_event053.1024` | Live2D 模型 | Cubism 2.1 | 失败 | 失败 | `Texture loading error` |
| BanG Dream! | `saya_event053.1024` | Live2D 模型 | Cubism 2.1 | 失败 | 失败 | `Texture loading error` |
| BanG Dream! | `sayo_event010.1024` | Live2D 模型 | Cubism 2.1 | 失败 | 失败 | `Texture loading error` |
| BanG Dream! | `tae_event053.1024` | Live2D 模型 | Cubism 2.1 | 失败 | 失败 | `Texture loading error` |
| 少女前线 | `an94sr` | Live2D 模型 | Cubism 2.1 | 失败 | 失败 | `Network error` |
| 少女前线 | `g41bp2062` | Live2D 模型 | Cubism 2.1 | 失败 | 失败 | `Network error` |
| 少女前线 | `hk416sc` | Live2D 模型 | Cubism 2.1 | 失败 | 失败 | `Network error` |
| 少女前线 | `suomimfh` | Live2D 模型 | Cubism 2.1 | 失败 | 失败 | `Network error` |
| 少女前线 | `wa2000hc` | Live2D 模型 | Cubism 2.1 | 失败 | 失败 | `Network error` |
| 少女前线 | `welrodlod` | Live2D 模型 | Cubism 2.1 | 失败 | 失败 | `Network error` |
| 明日方舟 | PRTS 明日方舟小人页 | Spine 展示页 | Spine | 不适用 | 排除 | 页面资源路线仍是 Spine，不属于 `pixi-live2d-display` 直挂输入 |
| 明日方舟 | PRTS 阿米娅小人元数据 | Spine 元数据 | 不适用 | 不适用 | 失败 | `Unknown settings format`，因为这不是 `model.json` / `model3.json` 体系 |
| 明日方舟 | `Halyul/aklive2d` | 候选来源 / Spine 展示方案 | Spine | 不适用 | 排除 | 仓内没有可直接交给 `pixi-live2d-display` 的 `.model3.json/.model.json` manifest |
| Blue Archive | `respectZ/blue-archive-viewer` | 候选来源 / Spine 资源仓 | Spine | 不适用 | 排除 | 资源实质是 `.atlas + .skel`，不是 Live2D manifest |
| Blue Archive | `stories2/BlueArchive` | 候选来源 / Cubism 编辑工程 | 不适用 | 不适用 | 排除 | 只有 `arona.cmo3`、`randomPose.can3` 等编辑工程文件，不是 runtime manifest |

## 3. 更新日志

| 时间 | 更新内容 | 涉及 IP / 类型统计 | 总共看了多少内容 | 找到多少有效的 |
| --- | --- | --- | --- | --- |
| 2026-04-10 20:30 | 首版兼容性调研落库，建立官方 / 上游基准池与初始失败池。 | 新增有效 9 项：`pixi-live2d-display` 上游 2，`Live2D/CubismWebSamples` 官方样例 7；新增失败 2 项：`Ren` 1、`PRTS` Spine 元数据 1。 | 可考下限 11 项（按首版显式落表条目计） | 9 |
| 2026-04-10 20:40 | 补齐首批可运行 URL、资源根目录 URL、资源类型与最小加载写法。 | 无新增 IP；仍是官方 / 上游 9 个基准样本的结构化补录。 | - | 0 |
| 2026-04-10 21:28 | 第二轮补测入库，加入仓库级结论、复验脚本与第二批可用条目。 | 新增有效 19 项：`贤惠幼妻仙狐小姐` 1、`Fox Hime Zero` 5、`BanG Dream!` 2、`碧蓝航线` 8、`CUE!` 3；新增失败 6 项：`GFL-Live2D-Viewer` 抽测 6。另补到仓库级统计：`CUE-live2d-Viewer` 本地 `195 / 195`、`AzurLane-Live2D` 本地 `193 / 193`、`Eikanya/Live2d-model` 抽测 `8 / 8`。 | 至少 402 项本地 manifest / 条目（`195 + 193 + 8 + 6`），另有若干远程补测 | 至少 396 |
| 2026-04-10 23:32 | 继续扩著名 IP 方向，补齐 KISGP、`zenghongtu/live2d-model-assets`、`SEKAI-Stories`，并确认 `BanG Dream!` / `Blue Archive` 失败路径。 | 新增有效 61 项：`崩坏学园 2` 10、`崩坏：星穹铁道` 6、`少女前线` 15、`超次元海王星` 10、`Vocaloid / Miku` 2、`Project SEKAI / Vocaloid` 18；新增失败 12 项：`BanG Dream!` 抽测 10、`Blue Archive` 候选源 2。 | 至少 73 项（`16 + 27 + 18 + 10 + 2`） | 61 |
| 2026-04-10 23:59 | 补到第三轮著名角色增量，顺手把明日方舟 `aklive2d` 这条线正式排除。 | 新增有效 34 项：`碧蓝航线` 8、`少女前线` 11、`Project SEKAI / Vocaloid` 15；新增排除 1 项：`Halyul/aklive2d`。 | 35 项（commit message 明确：34 个 manifest 候选 + 1 个明日方舟来源候选） | 34 |
| 2026-04-11 00:36 | 继续追明日方舟相关公开资源，但没有找到新的 `model.json / model3.json` 级可测入口；转而补齐 `zenghongtu/live2d-model-assets` 里尚未落表的著名 IP 增量，并全部完成本地直挂验证。 | 新增有效 36 项：`少女前线` 8、`超次元海王星` 9、`魔法禁书目录 / 某科学的超电磁炮` 5、`Vocaloid / 镜音连` 4、`Vocal synth / 结月缘` 2、经典动画角色 8（`Re:Zero`、`埃罗芒阿老师`、`约会大作战`、`魔法少女小圆`、`请问您今天要来点兔子吗？`、`小林家的龙女仆`、`工作细胞`、`干物妹！小埋` 各 1）。 | 36 项 manifest 候选（另行检索若干明日方舟来源，未形成可测 manifest） | 36 |
