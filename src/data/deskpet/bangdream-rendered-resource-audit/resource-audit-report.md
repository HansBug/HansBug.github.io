# BanG Dream 最终渲染资源审计报告

生成时间：`2026-06-15T11:15:34Z`

本报告只展示审计样例和 contact sheet；完整结论以 `audit.csv` / `audit.parquet` 为准。

## 分布摘要

| 项 | 数量 |
| --- | ---: |
| 总行数 | 3443 |
| covered candidate | 3336 |
| `soft_review` | 647 |
| `exclude` | 260 |
| `public_candidate` | 2303 |
| `easter_egg_candidate` | 126 |
| `pending` | 107 |

## public_candidate

- 总量：`2303`
- 样例：`40`
- Contact sheet: ![](samples/public/contact-sheet.jpg)

| 图 | 资源 | 角色 | 理由 |
| --- | --- | --- | --- |
| <img src="samples/public/bangdream_006_birthday_2021.png" width="120"> | `bangdream_006_birthday_2021` | 美竹兰 | `no_hard_or_soft_policy_tags,non_decisive:bare_shoulders` |
| <img src="samples/public/bangdream_006_casual.png" width="120"> | `bangdream_006_casual` | 美竹兰 | `no_hard_or_soft_policy_tags` |
| <img src="samples/public/bangdream_006_dream_festival_3_ur.png" width="120"> | `bangdream_006_dream_festival_3_ur` | 美竹兰 | `no_hard_or_soft_policy_tags` |
| <img src="samples/public/bangdream_006_event_128_story_01.png" width="120"> | `bangdream_006_event_128_story_01` | 美竹兰 | `no_hard_or_soft_policy_tags` |
| <img src="samples/public/bangdream_006_2019_furisode.png" width="120"> | `bangdream_006_2019_furisode` | 美竹兰 | `no_hard_or_soft_policy_tags` |
| <img src="samples/public/bangdream_006_live_default.png" width="120"> | `bangdream_006_live_default` | 美竹兰 | `no_hard_or_soft_policy_tags` |
| <img src="samples/public/bangdream_006_live_event_05_ssr.png" width="120"> | `bangdream_006_live_event_05_ssr` | 美竹兰 | `no_hard_or_soft_policy_tags` |
| <img src="samples/public/bangdream_006_live_r_2020.png" width="120"> | `bangdream_006_live_r_2020` | 美竹兰 | `no_hard_or_soft_policy_tags` |
| <img src="samples/public/bangdream_006_event_06_story.png" width="120"> | `bangdream_006_event_06_story` | 美竹兰 | `no_hard_or_soft_policy_tags` |
| <img src="samples/public/bangdream_006_school_summer.png" width="120"> | `bangdream_006_school_summer` | 美竹兰 | `no_hard_or_soft_policy_tags` |
| <img src="samples/public/bangdream_006_special_5th.png" width="120"> | `bangdream_006_special_5th` | 美竹兰 | `no_hard_or_soft_policy_tags` |
| <img src="samples/public/bangdream_007_casual.png" width="120"> | `bangdream_007_casual` | 青叶摩卡 | `no_hard_or_soft_policy_tags` |
| <img src="samples/public/bangdream_007_dream_festival_4_ur.png" width="120"> | `bangdream_007_dream_festival_4_ur` | 青叶摩卡 | `no_hard_or_soft_policy_tags,non_decisive:thighhighs` |
| <img src="samples/public/bangdream_007_event_216_story_01.png" width="120"> | `bangdream_007_event_216_story_01` | 青叶摩卡 | `no_hard_or_soft_policy_tags` |
| <img src="samples/public/bangdream_007_2019_furisode.png" width="120"> | `bangdream_007_2019_furisode` | 青叶摩卡 | `no_hard_or_soft_policy_tags` |
| <img src="samples/public/bangdream_007_live_default.png" width="120"> | `bangdream_007_live_default` | 青叶摩卡 | `no_hard_or_soft_policy_tags` |
| <img src="samples/public/bangdream_007_live_event_06_ssr.png" width="120"> | `bangdream_007_live_event_06_ssr` | 青叶摩卡 | `no_hard_or_soft_policy_tags,non_decisive:thighhighs` |
| <img src="samples/public/bangdream_007_live_r_2020.png" width="120"> | `bangdream_007_live_r_2020` | 青叶摩卡 | `no_hard_or_soft_policy_tags` |
| <img src="samples/public/bangdream_007_2nd_general_election_r.png" width="120"> | `bangdream_007_2nd_general_election_r` | 青叶摩卡 | `no_hard_or_soft_policy_tags` |
| <img src="samples/public/bangdream_007_school_summer.png" width="120"> | `bangdream_007_school_summer` | 青叶摩卡 | `no_hard_or_soft_policy_tags` |
| <img src="samples/public/bangdream_007_special_5th.png" width="120"> | `bangdream_007_special_5th` | 青叶摩卡 | `no_hard_or_soft_policy_tags` |
| <img src="samples/public/bangdream_008_birthday_2021.png" width="120"> | `bangdream_008_birthday_2021` | 上原绯玛丽 | `no_hard_or_soft_policy_tags` |
| <img src="samples/public/bangdream_008_casual.png" width="120"> | `bangdream_008_casual` | 上原绯玛丽 | `no_hard_or_soft_policy_tags,non_decisive:thighhighs` |
| <img src="samples/public/bangdream_008_dream_festival_3_ur.png" width="120"> | `bangdream_008_dream_festival_3_ur` | 上原绯玛丽 | `no_hard_or_soft_policy_tags` |
| <img src="samples/public/bangdream_008_event_128_story_01.png" width="120"> | `bangdream_008_event_128_story_01` | 上原绯玛丽 | `no_hard_or_soft_policy_tags` |
| <img src="samples/public/bangdream_008_2019_furisode.png" width="120"> | `bangdream_008_2019_furisode` | 上原绯玛丽 | `no_hard_or_soft_policy_tags` |
| <img src="samples/public/bangdream_008_live_default.png" width="120"> | `bangdream_008_live_default` | 上原绯玛丽 | `no_hard_or_soft_policy_tags,non_decisive:thighhighs` |
| <img src="samples/public/bangdream_008_live_event_06_r.png" width="120"> | `bangdream_008_live_event_06_r` | 上原绯玛丽 | `no_hard_or_soft_policy_tags,non_decisive:thighhighs` |
| <img src="samples/public/bangdream_008_live_r_2023.png" width="120"> | `bangdream_008_live_r_2023` | 上原绯玛丽 | `no_hard_or_soft_policy_tags,non_decisive:thighhighs` |
| <img src="samples/public/bangdream_008_event_06_story.png" width="120"> | `bangdream_008_event_06_story` | 上原绯玛丽 | `no_hard_or_soft_policy_tags` |
| <img src="samples/public/bangdream_008_school_summer.png" width="120"> | `bangdream_008_school_summer` | 上原绯玛丽 | `no_hard_or_soft_policy_tags` |
| <img src="samples/public/bangdream_008_special_5th.png" width="120"> | `bangdream_008_special_5th` | 上原绯玛丽 | `no_hard_or_soft_policy_tags` |
| <img src="samples/public/bangdream_009_birthday_2021.png" width="120"> | `bangdream_009_birthday_2021` | 宇田川巴 | `no_hard_or_soft_policy_tags` |
| <img src="samples/public/bangdream_009_casual.png" width="120"> | `bangdream_009_casual` | 宇田川巴 | `no_hard_or_soft_policy_tags` |
| <img src="samples/public/bangdream_009_dream_festival_2.png" width="120"> | `bangdream_009_dream_festival_2` | 宇田川巴 | `no_hard_or_soft_policy_tags` |
| <img src="samples/public/bangdream_009_event_107_story_01.png" width="120"> | `bangdream_009_event_107_story_01` | 宇田川巴 | `no_hard_or_soft_policy_tags` |
| <img src="samples/public/bangdream_009_2019_furisode.png" width="120"> | `bangdream_009_2019_furisode` | 宇田川巴 | `no_hard_or_soft_policy_tags` |
| <img src="samples/public/bangdream_009_live_event_06_r.png" width="120"> | `bangdream_009_live_event_06_r` | 宇田川巴 | `no_hard_or_soft_policy_tags` |
| <img src="samples/public/bangdream_009_live_r_2020.png" width="120"> | `bangdream_009_live_r_2020` | 宇田川巴 | `no_hard_or_soft_policy_tags` |
| <img src="samples/public/bangdream_009_2021af.png" width="120"> | `bangdream_009_2021af` | 宇田川巴 | `no_hard_or_soft_policy_tags` |

## easter_egg_candidate

- 总量：`126`
- 样例：`40`
- Contact sheet: ![](samples/easter/contact-sheet.jpg)

| 图 | 资源 | 角色 | 理由 |
| --- | --- | --- | --- |
| <img src="samples/easter/bangdream_006_event_122_story_01.png" width="120"> | `bangdream_006_event_122_story_01` | 美竹兰 | `bikini,hard_easter_tag,swimsuit` |
| <img src="samples/easter/bangdream_006_live_event_122_sr.png" width="120"> | `bangdream_006_live_event_122_sr` | 美竹兰 | `bikini,hard_easter_tag,swimsuit` |
| <img src="samples/easter/bangdream_007_event_122_story_01.png" width="120"> | `bangdream_007_event_122_story_01` | 青叶摩卡 | `bikini,hard_easter_tag,swimsuit` |
| <img src="samples/easter/bangdream_007_live_event_122_ssr.png" width="120"> | `bangdream_007_live_event_122_ssr` | 青叶摩卡 | `bikini,hard_easter_tag,swimsuit` |
| <img src="samples/easter/bangdream_008_event_122_story_01.png" width="120"> | `bangdream_008_event_122_story_01` | 上原绯玛丽 | `bikini,hard_easter_tag,swimsuit` |
| <img src="samples/easter/bangdream_008_live_event_122_r.png" width="120"> | `bangdream_008_live_event_122_r` | 上原绯玛丽 | `bikini,hard_easter_tag,swimsuit` |
| <img src="samples/easter/bangdream_008_live_r_2018.png" width="120"> | `bangdream_008_live_r_2018` | 上原绯玛丽 | `hard_easter_tag,underwear` |
| <img src="samples/easter/bangdream_009_event_122_story_01.png" width="120"> | `bangdream_009_event_122_story_01` | 宇田川巴 | `bikini,hard_easter_tag,swimsuit` |
| <img src="samples/easter/bangdream_009_live_event_122_sr.png" width="120"> | `bangdream_009_live_event_122_sr` | 宇田川巴 | `bikini,hard_easter_tag,swimsuit` |
| <img src="samples/easter/bangdream_010_event_122_story_01.png" width="120"> | `bangdream_010_event_122_story_01` | 羽泽鸫 | `bikini,hard_easter_tag,swimsuit` |
| <img src="samples/easter/bangdream_010_live_event_122_ssr.png" width="120"> | `bangdream_010_live_event_122_ssr` | 羽泽鸫 | `hard_easter_tag,swimsuit` |
| <img src="samples/easter/bangdream_011_event_266_story_01.png" width="120"> | `bangdream_011_event_266_story_01` | 弦卷心 | `bikini,hard_easter_tag,swimsuit` |
| <img src="samples/easter/bangdream_011_live_event_20_ssr.png" width="120"> | `bangdream_011_live_event_20_ssr` | 弦卷心 | `hard_easter_tag,underwear` |
| <img src="samples/easter/bangdream_011_halloween_without_lantern.png" width="120"> | `bangdream_011_halloween_without_lantern` | 弦卷心 | `hard_easter_tag,underwear` |
| <img src="samples/easter/bangdream_012_live_event_232_r.png" width="120"> | `bangdream_012_live_event_232_r` | 濑田薰 | `bikini,hard_easter_tag,swimsuit` |
| <img src="samples/easter/bangdream_012_swimsuit-2023.png" width="120"> | `bangdream_012_swimsuit-2023` | 濑田薰 | `bikini,hard_easter_tag,swimsuit` |
| <img src="samples/easter/bangdream_013_event_50_story_01.png" width="120"> | `bangdream_013_event_50_story_01` | 北泽育美 | `bikini,hard_easter_tag,swimsuit` |
| <img src="samples/easter/bangdream_013_live_event_232_ssr.png" width="120"> | `bangdream_013_live_event_232_ssr` | 北泽育美 | `bikini,hard_easter_tag,swimsuit` |
| <img src="samples/easter/bangdream_014_live_event_198.png" width="120"> | `bangdream_014_live_event_198` | 松原花音 | `hard_easter_tag,underwear` |
| <img src="samples/easter/bangdream_014_swimsuit-2023.png" width="120"> | `bangdream_014_swimsuit-2023` | 松原花音 | `bikini,hard_easter_tag,swimsuit` |
| <img src="samples/easter/bangdream_015_swimsuit-2023.png" width="120"> | `bangdream_015_swimsuit-2023` | 奥泽美咲 | `bikini,hard_easter_tag,swimsuit` |
| <img src="samples/easter/bangdream_026_event_194_story_01.png" width="120"> | `bangdream_026_event_194_story_01` | 仓田 真白 | `bikini,hard_easter_tag,swimsuit` |
| <img src="samples/easter/bangdream_026_live_event_194_ssr.png" width="120"> | `bangdream_026_live_event_194_ssr` | 仓田 真白 | `bikini,hard_easter_tag,swimsuit` |
| <img src="samples/easter/bangdream_027_event_194_story_01.png" width="120"> | `bangdream_027_event_194_story_01` | 桐谷 透子 | `bikini,hard_easter_tag,swimsuit` |
| <img src="samples/easter/bangdream_027_live_event_194_sr.png" width="120"> | `bangdream_027_live_event_194_sr` | 桐谷 透子 | `bikini,hard_easter_tag,swimsuit` |
| <img src="samples/easter/bangdream_028_event_194_story_01.png" width="120"> | `bangdream_028_event_194_story_01` | 广町 七深 | `bikini,hard_easter_tag,swimsuit` |
| <img src="samples/easter/bangdream_028_live_event_194_ssr.png" width="120"> | `bangdream_028_live_event_194_ssr` | 广町 七深 | `bikini,hard_easter_tag,swimsuit` |
| <img src="samples/easter/bangdream_029_event_194_story_01.png" width="120"> | `bangdream_029_event_194_story_01` | 二叶 筑紫 | `bikini,hard_easter_tag,swimsuit` |
| <img src="samples/easter/bangdream_029_live_event_194_r.png" width="120"> | `bangdream_029_live_event_194_r` | 二叶 筑紫 | `bikini,hard_easter_tag,swimsuit` |
| <img src="samples/easter/bangdream_029_swim_swit.png" width="120"> | `bangdream_029_swim_swit` | 二叶 筑紫 | `bikini,hard_easter_tag,swimsuit` |
| <img src="samples/easter/bangdream_030_event_194_story_01.png" width="120"> | `bangdream_030_event_194_story_01` | 八潮 瑠唯 | `bikini,hard_easter_tag,swimsuit` |
| <img src="samples/easter/bangdream_030_live_event_194_sr.png" width="120"> | `bangdream_030_live_event_194_sr` | 八潮 瑠唯 | `bikini,hard_easter_tag,swimsuit` |
| <img src="samples/easter/bangdream_016_event_86_story_01.png" width="120"> | `bangdream_016_event_86_story_01` | 丸山彩 | `bikini,hard_easter_tag,swimsuit` |
| <img src="samples/easter/bangdream_016_live_event_14_r.png" width="120"> | `bangdream_016_live_event_14_r` | 丸山彩 | `bikini,hard_easter_tag,swimsuit` |
| <img src="samples/easter/bangdream_016_swim_swit.png" width="120"> | `bangdream_016_swim_swit` | 丸山彩 | `bikini,hard_easter_tag,swimsuit` |
| <img src="samples/easter/bangdream_017_event_86_story_01.png" width="120"> | `bangdream_017_event_86_story_01` | 冰川日菜 | `bikini,hard_easter_tag,swimsuit` |
| <img src="samples/easter/bangdream_017_live_event_86_sr.png" width="120"> | `bangdream_017_live_event_86_sr` | 冰川日菜 | `bikini,hard_easter_tag,swimsuit` |
| <img src="samples/easter/bangdream_018_event_86_story_01.png" width="120"> | `bangdream_018_event_86_story_01` | 白鹭千圣 | `bikini,hard_easter_tag,swimsuit` |
| <img src="samples/easter/bangdream_018_live_event_86_ssr.png" width="120"> | `bangdream_018_live_event_86_ssr` | 白鹭千圣 | `bikini,hard_easter_tag,swimsuit` |
| <img src="samples/easter/bangdream_019_event_86_story_01.png" width="120"> | `bangdream_019_event_86_story_01` | 大和麻弥 | `bikini,hard_easter_tag,swimsuit` |

## soft_review

- 总量：`647`
- 样例：`40`
- Contact sheet: ![](samples/soft-review/contact-sheet.jpg)

| 图 | 资源 | 角色 | 理由 |
| --- | --- | --- | --- |
| <img src="samples/soft-review/bangdream_006_birthday_2022.png" width="120"> | `bangdream_006_birthday_2022` | 美竹兰 | `cleavage,garter_straps,soft_review_tag` |
| <img src="samples/soft-review/bangdream_006_collabo_d_3_ur.png" width="120"> | `bangdream_006_collabo_d_3_ur` | 美竹兰 | `cleavage,soft_review_tag` |
| <img src="samples/soft-review/bangdream_006_dream_festival.png" width="120"> | `bangdream_006_dream_festival` | 美竹兰 | `midriff,navel,soft_review_tag` |
| <img src="samples/soft-review/bangdream_006_live_event_129_ssr.png" width="120"> | `bangdream_006_live_event_129_ssr` | 美竹兰 | `crop_top,midriff,soft_review_tag` |
| <img src="samples/soft-review/bangdream_006_live_r_2018.png" width="120"> | `bangdream_006_live_r_2018` | 美竹兰 | `cleavage,soft_review_tag` |
| <img src="samples/soft-review/bangdream_006_live_sr_01.png" width="120"> | `bangdream_006_live_sr_01` | 美竹兰 | `crop_top,midriff,navel,soft_review_tag` |
| <img src="samples/soft-review/bangdream_006_2018_dog.png" width="120"> | `bangdream_006_2018_dog` | 美竹兰 | `qualification_review,variant_keyword:dog` |
| <img src="samples/soft-review/bangdream_007_birthday_2021.png" width="120"> | `bangdream_007_birthday_2021` | 青叶摩卡 | `garter_straps,soft_review_tag` |
| <img src="samples/soft-review/bangdream_007_dream_festival_2.png" width="120"> | `bangdream_007_dream_festival_2` | 青叶摩卡 | `crop_top,midriff,soft_review_tag` |
| <img src="samples/soft-review/bangdream_007_live_event_115_r.png" width="120"> | `bangdream_007_live_event_115_r` | 青叶摩卡 | `garter_straps,midriff,soft_review_tag` |
| <img src="samples/soft-review/bangdream_007_live_r_2018.png" width="120"> | `bangdream_007_live_r_2018` | 青叶摩卡 | `crop_top,midriff,navel,soft_review_tag` |
| <img src="samples/soft-review/bangdream_007_live_sr_01.png" width="120"> | `bangdream_007_live_sr_01` | 青叶摩卡 | `crop_top,midriff,navel,soft_review_tag` |
| <img src="samples/soft-review/bangdream_007_2018_dog.png" width="120"> | `bangdream_007_2018_dog` | 青叶摩卡 | `qualification_review,variant_keyword:dog` |
| <img src="samples/soft-review/bangdream_008_birthday_2022.png" width="120"> | `bangdream_008_birthday_2022` | 上原绯玛丽 | `cleavage,soft_review_tag` |
| <img src="samples/soft-review/bangdream_008_dream_festival.png" width="120"> | `bangdream_008_dream_festival` | 上原绯玛丽 | `midriff,navel,soft_review_tag` |
| <img src="samples/soft-review/bangdream_008_event_236_story_01.png" width="120"> | `bangdream_008_event_236_story_01` | 上原绯玛丽 | `cleavage,garter_straps,soft_review_tag` |
| <img src="samples/soft-review/bangdream_008_live_event_100_sr.png" width="120"> | `bangdream_008_live_event_100_sr` | 上原绯玛丽 | `garter_straps,soft_review_tag` |
| <img src="samples/soft-review/bangdream_008_live_r_2019.png" width="120"> | `bangdream_008_live_r_2019` | 上原绯玛丽 | `crop_top,midriff,navel,soft_review_tag` |
| <img src="samples/soft-review/bangdream_008_live_sr_01.png" width="120"> | `bangdream_008_live_sr_01` | 上原绯玛丽 | `crop_top,midriff,navel,soft_review_tag` |
| <img src="samples/soft-review/bangdream_008_2018_dog.png" width="120"> | `bangdream_008_2018_dog` | 上原绯玛丽 | `qualification_review,variant_keyword:dog` |
| <img src="samples/soft-review/bangdream_009_casual-2023.png" width="120"> | `bangdream_009_casual-2023` | 宇田川巴 | `crop_top,midriff,soft_review_tag` |
| <img src="samples/soft-review/bangdream_009_dream_festival.png" width="120"> | `bangdream_009_dream_festival` | 宇田川巴 | `midriff,navel,soft_review_tag` |
| <img src="samples/soft-review/bangdream_009_kirameki_festival.png" width="120"> | `bangdream_009_kirameki_festival` | 宇田川巴 | `crop_top,midriff,navel,soft_review_tag` |
| <img src="samples/soft-review/bangdream_009_live_default.png" width="120"> | `bangdream_009_live_default` | 宇田川巴 | `crop_top,midriff,navel,soft_review_tag` |
| <img src="samples/soft-review/bangdream_009_live_event_115_sr.png" width="120"> | `bangdream_009_live_event_115_sr` | 宇田川巴 | `garter_straps,midriff,soft_review_tag` |
| <img src="samples/soft-review/bangdream_009_live_r_2018.png" width="120"> | `bangdream_009_live_r_2018` | 宇田川巴 | `crop_top,midriff,navel,soft_review_tag` |
| <img src="samples/soft-review/bangdream_009_live_sr_01.png" width="120"> | `bangdream_009_live_sr_01` | 宇田川巴 | `crop_top,midriff,navel,soft_review_tag` |
| <img src="samples/soft-review/bangdream_009_2018_dog.png" width="120"> | `bangdream_009_2018_dog` | 宇田川巴 | `qualification_review,variant_keyword:dog` |
| <img src="samples/soft-review/bangdream_010_birthday_2022.png" width="120"> | `bangdream_010_birthday_2022` | 羽泽鸫 | `garter_straps,soft_review_tag` |
| <img src="samples/soft-review/bangdream_010_live_event_107_ssr.png" width="120"> | `bangdream_010_live_event_107_ssr` | 羽泽鸫 | `garter_straps,soft_review_tag` |
| <img src="samples/soft-review/bangdream_010_live_r_2019.png" width="120"> | `bangdream_010_live_r_2019` | 羽泽鸫 | `crop_top,midriff,navel,soft_review_tag` |
| <img src="samples/soft-review/bangdream_010_2018_dog.png" width="120"> | `bangdream_010_2018_dog` | 羽泽鸫 | `qualification_review,variant_keyword:dog` |
| <img src="samples/soft-review/bangdream_044_event_297_story_01.png" width="120"> | `bangdream_044_event_297_story_01` | 祐天寺 若麦 | `garter_straps,soft_review_tag` |
| <img src="samples/soft-review/bangdream_045_casual-2023.png" width="120"> | `bangdream_045_casual-2023` | 若叶 睦 | `cleavage,crop_top,soft_review_tag` |
| <img src="samples/soft-review/bangdream_011_dream_festival.png" width="120"> | `bangdream_011_dream_festival` | 弦卷心 | `mask,qualification_review` |
| <img src="samples/soft-review/bangdream_011_live_event_110_r.png" width="120"> | `bangdream_011_live_event_110_r` | 弦卷心 | `midriff,navel,soft_review_tag` |
| <img src="samples/soft-review/bangdream_011_live_r_2018.png" width="120"> | `bangdream_011_live_r_2018` | 弦卷心 | `cleavage,soft_review_tag` |
| <img src="samples/soft-review/bangdream_011_2018_dog.png" width="120"> | `bangdream_011_2018_dog` | 弦卷心 | `qualification_review,variant_keyword:dog` |
| <img src="samples/soft-review/bangdream_012_birthday_2022.png" width="120"> | `bangdream_012_birthday_2022` | 濑田薰 | `garter_straps,soft_review_tag` |
| <img src="samples/soft-review/bangdream_012_dream_festival_3_ur.png" width="120"> | `bangdream_012_dream_festival_3_ur` | 濑田薰 | `navel,soft_review_tag` |

## exclude

- 总量：`232`
- 样例：`40`
- Contact sheet: ![](samples/exclude/contact-sheet.jpg)

| 图 | 资源 | 角色 | 理由 |
| --- | --- | --- | --- |
| <img src="samples/exclude/bangdream_006_event_101_story_01.png" width="120"> | `bangdream_006_event_101_story_01` | 美竹兰 | `dedup_member,no_hard_or_soft_policy_tags` |
| <img src="samples/exclude/bangdream_006_2024_furisode.png" width="120"> | `bangdream_006_2024_furisode` | 美竹兰 | `dedup_member,no_hard_or_soft_policy_tags` |
| <img src="samples/exclude/bangdream_006_live_event_227_ur.png" width="120"> | `bangdream_006_live_event_227_ur` | 美竹兰 | `dedup_member,no_hard_or_soft_policy_tags` |
| <img src="samples/exclude/bangdream_006_pajamas-2023.png" width="120"> | `bangdream_006_pajamas-2023` | 美竹兰 | `dedup_member,no_hard_or_soft_policy_tags` |
| <img src="samples/exclude/bangdream_006_school_summer_v3.png" width="120"> | `bangdream_006_school_summer_v3` | 美竹兰 | `dedup_member,no_hard_or_soft_policy_tags` |
| <img src="samples/exclude/bangdream_006_swimsuit-2023.png" width="120"> | `bangdream_006_swimsuit-2023` | 美竹兰 | `bikini,dedup_member,hard_easter_tag,swimsuit` |
| <img src="samples/exclude/bangdream_007_event_65_story_01.png" width="120"> | `bangdream_007_event_65_story_01` | 青叶摩卡 | `dedup_member,no_hard_or_soft_policy_tags` |
| <img src="samples/exclude/bangdream_007_2024_furisode.png" width="120"> | `bangdream_007_2024_furisode` | 青叶摩卡 | `dedup_member,no_hard_or_soft_policy_tags` |
| <img src="samples/exclude/bangdream_007_live_event_200_ssr.png" width="120"> | `bangdream_007_live_event_200_ssr` | 青叶摩卡 | `dedup_member,no_hard_or_soft_policy_tags,non_decisive:thighhighs` |
| <img src="samples/exclude/bangdream_007_pajamas-2023.png" width="120"> | `bangdream_007_pajamas-2023` | 青叶摩卡 | `dedup_member,no_hard_or_soft_policy_tags` |
| <img src="samples/exclude/bangdream_007_school_summer_v3.png" width="120"> | `bangdream_007_school_summer_v3` | 青叶摩卡 | `dedup_member,no_hard_or_soft_policy_tags` |
| <img src="samples/exclude/bangdream_007_swimsuit-2023.png" width="120"> | `bangdream_007_swimsuit-2023` | 青叶摩卡 | `bikini,dedup_member,hard_easter_tag,swimsuit` |
| <img src="samples/exclude/bangdream_008_live_event_236_ur.png" width="120"> | `bangdream_008_live_event_236_ur` | 上原绯玛丽 | `cleavage,dedup_member,garter_straps,soft_review_tag` |
| <img src="samples/exclude/bangdream_008_swim_swit.png" width="120"> | `bangdream_008_swim_swit` | 上原绯玛丽 | `bikini,dedup_member,hard_easter_tag,swimsuit` |
| <img src="samples/exclude/bangdream_008_school_summer_v3.png" width="120"> | `bangdream_008_school_summer_v3` | 上原绯玛丽 | `dedup_member,no_hard_or_soft_policy_tags` |
| <img src="samples/exclude/bangdream_008_swimsuit-2023.png" width="120"> | `bangdream_008_swimsuit-2023` | 上原绯玛丽 | `bikini,dedup_member,hard_easter_tag,swimsuit` |
| <img src="samples/exclude/bangdream_009_event_216_story_01.png" width="120"> | `bangdream_009_event_216_story_01` | 宇田川巴 | `dedup_member,no_hard_or_soft_policy_tags` |
| <img src="samples/exclude/bangdream_009_2025_furisode.png" width="120"> | `bangdream_009_2025_furisode` | 宇田川巴 | `dedup_member,no_hard_or_soft_policy_tags` |
| <img src="samples/exclude/bangdream_009_live_event_200_ssr.png" width="120"> | `bangdream_009_live_event_200_ssr` | 宇田川巴 | `animal_companion:bird,dedup_member,qualification_review` |
| <img src="samples/exclude/bangdream_009_school_summer_v3.png" width="120"> | `bangdream_009_school_summer_v3` | 宇田川巴 | `dedup_member,no_hard_or_soft_policy_tags` |
| <img src="samples/exclude/bangdream_010_arbeit-2023.png" width="120"> | `bangdream_010_arbeit-2023` | 羽泽鸫 | `dedup_member,no_hard_or_soft_policy_tags` |
| <img src="samples/exclude/bangdream_010_memorial_middle_school.png" width="120"> | `bangdream_010_memorial_middle_school` | 羽泽鸫 | `dedup_member,no_hard_or_soft_policy_tags` |
| <img src="samples/exclude/bangdream_010_school_summer_v3.png" width="120"> | `bangdream_010_school_summer_v3` | 羽泽鸫 | `dedup_member,no_hard_or_soft_policy_tags` |
| <img src="samples/exclude/bangdream_010_swimsuit-2023.png" width="120"> | `bangdream_010_swimsuit-2023` | 羽泽鸫 | `bikini,dedup_member,hard_easter_tag,swimsuit` |
| <img src="samples/exclude/bangdream_011_event_141_story_01.png" width="120"> | `bangdream_011_event_141_story_01` | 弦卷心 | `dedup_member,no_hard_or_soft_policy_tags` |
| <img src="samples/exclude/bangdream_011_2024_furisode.png" width="120"> | `bangdream_011_2024_furisode` | 弦卷心 | `dedup_member,no_hard_or_soft_policy_tags` |
| <img src="samples/exclude/bangdream_011_live_event_244_r.png" width="120"> | `bangdream_011_live_event_244_r` | 弦卷心 | `dedup_member,no_hard_or_soft_policy_tags` |
| <img src="samples/exclude/bangdream_011_pajamas-2023.png" width="120"> | `bangdream_011_pajamas-2023` | 弦卷心 | `dedup_member,no_hard_or_soft_policy_tags` |
| <img src="samples/exclude/bangdream_011_school_summer-2023.png" width="120"> | `bangdream_011_school_summer-2023` | 弦卷心 | `dedup_member,no_hard_or_soft_policy_tags` |
| <img src="samples/exclude/bangdream_011_swimsuit-2023.png" width="120"> | `bangdream_011_swimsuit-2023` | 弦卷心 | `bikini,dedup_member,hard_easter_tag,swimsuit` |
| <img src="samples/exclude/bangdream_012_event_226_story_01.png" width="120"> | `bangdream_012_event_226_story_01` | 濑田薰 | `dedup_member,no_hard_or_soft_policy_tags` |
| <img src="samples/exclude/bangdream_012_live_event_179_r.png" width="120"> | `bangdream_012_live_event_179_r` | 濑田薰 | `dedup_member,no_hard_or_soft_policy_tags` |
| <img src="samples/exclude/bangdream_012_school_summer_v3.png" width="120"> | `bangdream_012_school_summer_v3` | 濑田薰 | `dedup_member,no_hard_or_soft_policy_tags` |
| <img src="samples/exclude/bangdream_013_event_153_story_01.png" width="120"> | `bangdream_013_event_153_story_01` | 北泽育美 | `dedup_member,no_hard_or_soft_policy_tags` |
| <img src="samples/exclude/bangdream_013_live_event_244_ur.png" width="120"> | `bangdream_013_live_event_244_ur` | 北泽育美 | `dedup_member,no_hard_or_soft_policy_tags` |
| <img src="samples/exclude/bangdream_013_pajamas-2023.png" width="120"> | `bangdream_013_pajamas-2023` | 北泽育美 | `dedup_member,no_hard_or_soft_policy_tags` |
| <img src="samples/exclude/bangdream_013_school_summer-2023.png" width="120"> | `bangdream_013_school_summer-2023` | 北泽育美 | `dedup_member,no_hard_or_soft_policy_tags` |
| <img src="samples/exclude/bangdream_013_swimsuit-2023.png" width="120"> | `bangdream_013_swimsuit-2023` | 北泽育美 | `bikini,dedup_member,hard_easter_tag,swimsuit` |
| <img src="samples/exclude/bangdream_014_live_event_215_ssr.png" width="120"> | `bangdream_014_live_event_215_ssr` | 松原花音 | `dedup_member,no_hard_or_soft_policy_tags` |
| <img src="samples/exclude/bangdream_014_school_winter_v3.png" width="120"> | `bangdream_014_school_winter_v3` | 松原花音 | `dedup_member,no_hard_or_soft_policy_tags` |

## dedup

- cluster 总量：`207`
- 展示 cluster：`20`

| Contact sheet | Cluster | 代表项 | 成员数 | 相似度 | 成员 |
| --- | --- | --- | ---: | --- | --- |
| <img src="samples/dedup/dedup-0001/contact-sheet.jpg" width="180"> | `dedup-0001` | `bangdream_001_2019_furisode` | 2 | `0.9946-1.0000` | `bangdream_001_2019_furisode`<br>`bangdream_001_2024_furisode` |
| <img src="samples/dedup/dedup-0002/contact-sheet.jpg" width="180"> | `dedup-0002` | `bangdream_001_casual` | 2 | `0.9993-1.0000` | `bangdream_001_casual`<br>`bangdream_001_event_147_story_01` |
| <img src="samples/dedup/dedup-0003/contact-sheet.jpg" width="180"> | `dedup-0003` | `bangdream_001_casual_winter` | 3 | `0.9991-1.0000` | `bangdream_001_casual_winter`<br>`bangdream_001_event_102_story_01`<br>`bangdream_001_event_65_story_01` |
| <img src="samples/dedup/dedup-0004/contact-sheet.jpg" width="180"> | `dedup-0004` | `bangdream_001_chapter0_pajamas` | 2 | `0.9936-1.0000` | `bangdream_001_chapter0_pajamas`<br>`bangdream_001_pajamas-2023` |
| <img src="samples/dedup/dedup-0005/contact-sheet.jpg" width="180"> | `dedup-0005` | `bangdream_001_event_124_story_01` | 3 | `0.9931-1.0000` | `bangdream_001_event_124_story_01`<br>`bangdream_001_event_160_story_01`<br>`bangdream_001_swimsuit-2023` |
| <img src="samples/dedup/dedup-0006/contact-sheet.jpg" width="180"> | `dedup-0006` | `bangdream_001_event_128_story_01` | 2 | `0.9985-1.0000` | `bangdream_001_event_128_story_01`<br>`bangdream_001_live_event_128_ssr` |
| <img src="samples/dedup/dedup-0007/contact-sheet.jpg" width="180"> | `dedup-0007` | `bangdream_001_event_216_story_01` | 4 | `0.9963-1.0000` | `bangdream_001_event_216_story_01`<br>`bangdream_001_school_winter`<br>`bangdream_001_school_winter-2023`<br>`bangdream_001_school_winter_v3` |
| <img src="samples/dedup/dedup-0008/contact-sheet.jpg" width="180"> | `dedup-0008` | `bangdream_001_school_summer` | 2 | `0.9969-1.0000` | `bangdream_001_school_summer`<br>`bangdream_001_school_summer-2023` |
| <img src="samples/dedup/dedup-0009/contact-sheet.jpg" width="180"> | `dedup-0009` | `bangdream_002_casual_winter` | 3 | `0.9994-1.0000` | `bangdream_002_casual_winter`<br>`bangdream_002_event_102_story_01`<br>`bangdream_002_event_99_story_01` |
| <img src="samples/dedup/dedup-0010/contact-sheet.jpg" width="180"> | `dedup-0010` | `bangdream_002_event_140_story_01` | 5 | `0.9951-1.0000` | `bangdream_002_event_140_story_01`<br>`bangdream_002_event_216_story_01`<br>`bangdream_002_event_99_story_02`<br>`bangdream_002_school_winter`<br>`bangdream_002_school_winter-2023` |
| <img src="samples/dedup/dedup-0011/contact-sheet.jpg" width="180"> | `dedup-0011` | `bangdream_002_event_160_story_01` | 3 | `0.9952-1.0000` | `bangdream_002_event_160_story_01`<br>`bangdream_002_event_50_story_01`<br>`bangdream_002_swimsuit-2023` |
| <img src="samples/dedup/dedup-0012/contact-sheet.jpg" width="180"> | `dedup-0012` | `bangdream_002_school_summer` | 2 | `0.9961-1.0000` | `bangdream_002_school_summer`<br>`bangdream_002_school_summer-2023` |
| <img src="samples/dedup/dedup-0013/contact-sheet.jpg" width="180"> | `dedup-0013` | `bangdream_003_2019_furisode` | 2 | `0.9925-1.0000` | `bangdream_003_2019_furisode`<br>`bangdream_003_2024_furisode` |
| <img src="samples/dedup/dedup-0014/contact-sheet.jpg" width="180"> | `dedup-0014` | `bangdream_003_chapter0_pajamas` | 2 | `0.9946-1.0000` | `bangdream_003_chapter0_pajamas`<br>`bangdream_003_event_233_story_01` |
| <img src="samples/dedup/dedup-0015/contact-sheet.jpg" width="180"> | `dedup-0015` | `bangdream_003_event_140_story_01` | 4 | `0.9923-1.0000` | `bangdream_003_event_140_story_01`<br>`bangdream_003_event_216_story_01`<br>`bangdream_003_school_winter`<br>`bangdream_003_school_winter-2023` |
| <img src="samples/dedup/dedup-0016/contact-sheet.jpg" width="180"> | `dedup-0016` | `bangdream_003_event_227_story_02` | 2 | `0.9997-1.0000` | `bangdream_003_event_227_story_02`<br>`bangdream_003_live_event_227_ssr` |
| <img src="samples/dedup/dedup-0017/contact-sheet.jpg" width="180"> | `dedup-0017` | `bangdream_003_school_summer` | 2 | `0.9949-1.0000` | `bangdream_003_school_summer`<br>`bangdream_003_school_summer-2023` |
| <img src="samples/dedup/dedup-0018/contact-sheet.jpg" width="180"> | `dedup-0018` | `bangdream_004_2019_furisode` | 2 | `0.9939-1.0000` | `bangdream_004_2019_furisode`<br>`bangdream_004_2025_furisode` |
| <img src="samples/dedup/dedup-0019/contact-sheet.jpg" width="180"> | `dedup-0019` | `bangdream_004_chapter0_pajamas` | 2 | `0.9944-1.0000` | `bangdream_004_chapter0_pajamas`<br>`bangdream_004_pajamas-2023` |
| <img src="samples/dedup/dedup-0020/contact-sheet.jpg" width="180"> | `dedup-0020` | `bangdream_004_event_216_story_01` | 3 | `0.9930-1.0000` | `bangdream_004_event_216_story_01`<br>`bangdream_004_school_winter`<br>`bangdream_004_school_winter-2023` |

