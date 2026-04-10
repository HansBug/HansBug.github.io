# AGENTS.md

本文件用于未来继续维护本站的 agent / 协作者快速上手。

和 `README.md` 相比，这里更偏“维护约束 + 实际工作路径 + 不要做什么”。

## 一句话概述

这是 HansBug 的中文个人技术博客仓库，当前运行在：

- 仓库：`HansBug/HansBug.github.io`
- 线上：`https://hansbug.github.io`

站点定位不是个人介绍页，而是长期维护的中文技术写作与知识索引工作台。

## 维护优先级

1. 发布链路稳定
2. 新文章进入路径清晰
3. 标签、路线、归档等索引持续可用
4. 联系入口始终明确
5. 视觉克制、简洁、淡雅

## 当前架构摘要

### 主体栈

- Astro
- Vue
- TypeScript
- Chart.js
- GitHub Pages
- GitHub Actions

### 关键路径

- 站点配置：`src/config/site.ts`
- 内容 schema：`src/content.config.ts`
- 内容聚合逻辑：`src/utils/content.ts`
- 全局样式：`src/styles/global.css`
- GitHub Pages 工作流：`.github/workflows/deploy.yml`

### 旧站归档页

`old-blog` 现在不是纯 Astro 静态片段，而是：

- 页面入口：`src/pages/old-blog.astro`
- 主交互组件：`src/components/OldBlogExplorer.vue`
- 下拉筛选组件：`src/components/OldBlogFilterSelect.vue`

如果任务涉及 `old-blog` 的筛选、排序、趋势图或交互，优先改 Vue 组件，不要重新回退到：

- 原生浏览器默认 `select`
- 零散的内联 DOM 拼接
- 大段无类型的脚本状态管理

## 内容系统约定

### 博客文章

目录：`src/content/blog/`

schema 以 `src/content.config.ts` 为准，当前核心字段：

- `title`
- `description`
- `pubDate`
- `updatedDate`
- `tags`
- `difficulty`
- `excerpt`
- `series`
- `draft`
- `featured`
- `pinned`
- `routeSlugs`

行为规则：

- `draft: true` 不会被发布
- 排序规则是 `pinned` 优先，然后按 `pubDate` 倒序
- 文章详情页路由来自内容文件路径本身
- `routeSlugs` 用于把文章显式挂到路线

### 阅读路线

目录：`src/content/routes/`

行为规则：

- 路线按 `order` 升序
- 如果配置了 `recommendedPosts`，路线页优先使用它
- 否则回退到 `routeSlugs + 共享标签`

### 项目页

目录：`src/content/projects/`

行为规则：

- 项目按 `featured` 优先，再按 `order`

### 标签

- 标签元数据集中维护在 `src/data/tagMeta.ts`
- 新标签优先复用现有标签
- 如必须新增，必须补标签分组、描述和配色

## 新文章发布流程

### 推荐步骤

1. 在 `src/content/blog/` 下新建 Markdown 文件
2. 填完整 frontmatter
3. 优先复用现有标签；必要时补 `src/data/tagMeta.ts`
4. 如果文章属于某条路线，补 `routeSlugs`
5. 执行 `npm run build`
6. 本地检查首页、博客页、文章详情页、标签页
7. 推送到 `main`

### 路径建议

推荐使用稳定、可长期维护的路径，如：

- `src/content/blog/python/treevalue-overview.md`
- `src/content/blog/engineering/github-actions-notes.md`

不要把路径命名成临时口语化、难以长期维护的 slug。

## 旧博客园迁移策略

旧博客园地址：

- `https://www.cnblogs.com/HansBug/`

当前策略必须坚持：

- 不直接批量搬运旧正文
- 新站只保留入口、索引、时间、阅读量和结构化归纳
- 真正值得保留的主题，在新站重写

### 旧站数据源

旧站全量索引由脚本生成：

```bash
python3 scripts/fetch_old_blog.py
```

会更新：

- `src/data/oldBlogCatalog.json`
- `src/data/oldBlogCatalog.ts`

当前已知事实：

- 旧站共 `315` 篇文章
- 有真实阅读量、评论数、年份趋势、旧站分类
- `old-blog` 已支持趋势、筛选、检索和直接跳转博客园原文

### 改旧站归档页时不要做的事

- 不要把旧文伪装成最近新内容
- 不要把旧站怀旧模块重新塞回首页
- 不要直接复制博客园正文到新站
- 不要把旧站分类原样当成新站标签体系

## 首页和视觉约定

### 首页

- 首页只面向未来的新写作
- 只展示新文章、新入口和必要动作
- 不要再把旧站总结、迁移说明、历史归档大段挂回首页

### 视觉

- 保持轻工业感、低饱和、淡雅、克制
- 可以有轻度风格化气氛，但不要重度二次元
- 全站按钮、badge、标签、筛选器保持扁平、低厚度、轻边框
- 避免臃肿玻璃感、过高按钮、双层无意义边框
- 中文阅读舒适度优先于花哨装饰

## 部署与验证

### 本地命令

```bash
npm install
npm run dev
npm run check
npm run build
npm run preview
```

### 发布

- 推送 `main` 会触发 `.github/workflows/deploy.yml`
- GitHub Pages 自动发布 `dist/`

### 常用检查

```bash
gh run list --limit 5
gh run watch <run_id> --exit-status
```

### 提交前最低要求

默认至少执行：

```bash
npm run build
```

如果改动涉及 `old-blog`：

- 检查筛选器能否正常工作
- 检查年份趋势图是否正常
- 检查标题跳转、时间、阅读量显示是否还在
- 检查没有残留本地临时端口或测试文件

## 当前已知仓库特性

- 当前 `src/content/blog/`、`src/content/routes/`、`src/content/projects/` 可以为空
- 即使内容目录为空，页面也必须正常渲染空状态
- 旧站筛选器已迁到 Vue；当前不需要引入更重的前端框架
- `siteUrl`、仓库地址、导航等关键信息集中在 `src/config/site.ts`

## 如果未来要改域名或仓库名

至少同步检查：

- `astro.config.mjs`
- `src/config/site.ts`
- GitHub Pages 仓库设置
- `README.md`

## 联系入口

当前默认联系入口：

- 邮箱：`hansbug@buaa.edu.cn`
- GitHub Issue
- GitHub Discussions

任何改动都不要把联系入口藏得太深，至少首页、联系页、页脚应可找到。

## 推荐的阅读顺序

新协作者或 agent 建议按这个顺序建立上下文：

1. `README.md`
2. `AGENTS.md`
3. `src/content.config.ts`
4. `src/config/site.ts`
5. `src/utils/content.ts`
6. 目标页面与对应组件

如果只是发新文章，通常不需要通读全站实现。

如果只是改 `old-blog` 体验，优先从：

1. `src/pages/old-blog.astro`
2. `src/components/OldBlogExplorer.vue`
3. `src/components/OldBlogFilterSelect.vue`
4. `src/styles/global.css`

开始。
