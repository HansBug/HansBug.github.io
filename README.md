# HansBug 技术博客

这是 HansBug 的中文个人技术博客仓库，当前部署在 GitHub Pages：

- 线上地址：<https://hansbug.github.io>
- 仓库地址：<https://github.com/HansBug/HansBug.github.io>

这不是一个“随便摆几个静态页面”的仓库，而是一套长期维护的中文技术写作工作台。新文章、新标签体系、新路线页和旧站归档都在这里维护。

## 当前站点状态

- 首页只承接新站内容，不再混放旧站说明和怀旧模块。
- 博客、标签、归档、联系页已经可用。
- 旧博客园内容已经整理为独立的 `old-blog` 归档页。
- 当前允许 `src/content/blog/`、`src/content/routes/`、`src/content/projects/` 暂时为空，空站阶段也必须保证页面正常渲染。

## 技术栈

- Astro
- Vue
- TypeScript
- Chart.js
- GitHub Pages
- GitHub Actions

说明：

- 站点主体仍是 Astro。
- `old-blog` 页的筛选与交互已经迁到 Vue island，不要再回退到原生下拉或临时脚本拼接。

## 本地开发

先安装依赖：

```bash
npm install
```

常用命令：

```bash
npm run dev
npm run check
npm run build
npm run preview
```

推荐的最小自检流程：

1. `npm run build`
2. 打开本地页面看一眼关键入口
3. 再提交并推送到 `main`

## 目录结构

```text
.github/workflows/     GitHub Pages 自动部署
public/                静态资源，如头像、favicon
scripts/               维护脚本，当前主要用于抓取旧博客园索引
src/components/        公共组件与 Vue 交互组件
src/config/            站点配置与导航配置
src/content/           博客、路线、项目内容
src/data/              标签元数据、旧站归档数据
src/layouts/           页面布局
src/pages/             路由页面
src/styles/            全局样式
src/utils/             内容聚合与排序逻辑
```

当前和维护强相关的几个文件：

- `src/content.config.ts`：Astro Content Collections schema
- `src/config/site.ts`：站点标题、导航、仓库地址、联系信息
- `src/utils/content.ts`：文章排序、标签聚合、路线关联等规则
- `src/components/OldBlogExplorer.vue`：旧站归档页主交互组件
- `src/components/OldBlogFilterSelect.vue`：旧站筛选下拉组件
- `scripts/fetch_old_blog.py`：抓取博客园旧站全量索引

## 如何发布新的博客文章

### 1. 新建文章文件

在 `src/content/blog/` 下新建 Markdown 文件。

推荐路径风格：

```text
src/content/blog/python/treevalue-overview.md
src/content/blog/engineering/github-actions-notes.md
```

说明：

- Astro 文章路由来自内容文件的 `id`。
- 对于 `src/content/blog/python/treevalue-overview.md`，最终页面路径会接近 `/blog/python/treevalue-overview/`。
- 路径本身就是长期 URL 的一部分，所以文件名要稳定、克制、可长期复用。

### 2. 按 schema 写 frontmatter

博客文章 schema 定义在 `src/content.config.ts`。当前字段如下：

- `title`: 必填
- `description`: 必填
- `pubDate`: 必填
- `updatedDate`: 可选
- `tags`: 必填，至少一个
- `difficulty`: 可选，`入门 | 进阶 | 实践`
- `excerpt`: 可选
- `series`: 可选
- `draft`: 可选，默认 `false`
- `featured`: 可选，当前未作为主排序字段使用，但可以保留
- `pinned`: 可选，置顶文章会优先于其他文章排序
- `routeSlugs`: 可选，用于把文章明确挂到某条路线

示例：

```md
---
title: "用 GitHub Actions 自动发布 Astro 站点"
description: "从仓库结构、工作流配置到发布验证，整理一套可长期复用的 Pages 发布方案。"
pubDate: 2026-04-10
updatedDate: 2026-04-10
tags:
  - GitHub Actions
  - Astro
  - 工程实践
difficulty: "实践"
excerpt: "把部署链路写清楚，比单次跑通更重要。"
series: "站点工程化"
draft: false
pinned: false
routeSlugs:
  - site-engineering
---

正文从这里开始。
```

### 3. 标签不要乱长

新增文章前先检查 `src/data/tagMeta.ts`：

- 能复用已有标签就复用。
- 如果必须新增标签，记得同步补标签分组、描述和配色。
- 不要把旧站博客园分类直接照搬成新站标签体系。

### 4. 路线关联怎么写

路线内容放在 `src/content/routes/`。

- 路线文件的 `id` 来自路径本身。
- 博客文章里的 `routeSlugs` 应该填写路线文件的 `id`。

例如：

- 路线文件：`src/content/routes/site-engineering.md`
- 路线 id：`site-engineering`
- 博客文章里写：`routeSlugs: ["site-engineering"]`

如果文章没有显式写 `routeSlugs`，路线页仍可能通过标签自动把相关文章收进来，但显式绑定更稳。

### 5. 发布前检查

发新文章前至少做下面几步：

1. `npm run build`
2. 看一眼首页、博客页、文章详情页、标签页
3. 确认没有把 `draft: true` 的草稿误发出去
4. 确认文章标题、描述、标签、时间都不是占位内容

## 如何维护路线和项目页

### 路线

目录：`src/content/routes/`

字段：

- `title`
- `summary`
- `order`
- `stage`: `起步 | 进阶 | 体系化`
- `estimatedTime`
- `tags`
- `recommendedPosts`

适合放：

- 学习路径
- 专题导读
- 一组文章的推荐阅读顺序

### 项目

目录：`src/content/projects/`

字段：

- `title`
- `summary`
- `order`
- `status`: `进行中 | 持续维护 | 构思中`
- `stack`
- `featured`
- `repoUrl`
- `demoUrl`

适合放：

- 长期工程实践
- 开源项目记录
- 有状态变化的个人项目档案

## 旧博客园归档如何维护

旧博客园地址：

- <https://www.cnblogs.com/HansBug/>

当前策略：

- 不直接批量搬运旧正文。
- 新站只保留旧站入口、结构梳理、时间信息、阅读量信息和全量索引。
- 真正值得长期保留的主题，应该在新站里重写，而不是复制原文。

旧站索引数据维护命令：

```bash
python3 scripts/fetch_old_blog.py
```

这会更新：

- `src/data/oldBlogCatalog.json`
- `src/data/oldBlogCatalog.ts`

当前 `old-blog` 页面相关实现：

- `src/pages/old-blog.astro`
- `src/components/OldBlogExplorer.vue`
- `src/components/OldBlogFilterSelect.vue`

如果只是在修旧站筛选器、图表或结果列表，优先改 Vue 组件，不要再退回到大段内联 DOM 拼接。

## 排序与展示规则

这些规则由 `src/utils/content.ts` 控制：

- 博客文章排序：`pinned` 优先，然后按 `pubDate` 倒序
- 首页只展示最新博客文章
- 标签页按文章真实标签聚合
- 路线页优先使用 `recommendedPosts`；如果没配，则回退到 `routeSlugs + 共享标签`
- 项目页优先展示 `featured: true` 的项目

这意味着：

- 如果某篇文章要长期挂前面，应该显式设 `pinned: true`
- 如果某条路线要精确控制顺序，应该在路线 frontmatter 里写 `recommendedPosts`

## 部署

当前部署方式是 GitHub Pages 自动发布。

- 分支：`main`
- 工作流：`.github/workflows/deploy.yml`
- 触发方式：推送到 `main` 或手动触发 workflow

工作流主要步骤：

1. `npm ci`
2. `npm run build`
3. 上传 `dist/`
4. 部署到 GitHub Pages

推送后可用下面命令看状态：

```bash
gh run list --limit 5
gh run watch <run_id> --exit-status
```

## 域名与站点配置

当前站点按用户 Pages 仓库设计：

- 仓库：`HansBug/HansBug.github.io`
- 线上地址：`https://hansbug.github.io`

如果未来切换自定义域名或仓库名，至少要同步检查：

- `astro.config.mjs`
- `src/config/site.ts`
- GitHub Pages 仓库设置
- README 里的部署说明

## 视觉与内容风格约定

- 所有对外可见文字默认使用中文。
- 首页只服务新文章和新动态，不要把旧站说明重新塞回首页。
- 允许轻工业感、任务面板感和轻度风格化气氛，但不要做重度二次元。
- 全站按钮、badge、标签、筛选器保持扁平、低厚度、轻边框。
- 不要把旧站内容伪装成近期新写。

## 给 AI / 协作者的操作建议

如果你是未来接手这个仓库的 AI 或协作者，推荐按这个顺序理解仓库：

1. 先看 `README.md`
2. 再看 `AGENTS.md`
3. 然后看 `src/content.config.ts`
4. 再看 `src/config/site.ts`
5. 最后根据任务进入 `src/pages/`、`src/components/`、`src/utils/`

做完改动后，默认执行：

```bash
npm run build
```

如果改动涉及旧站归档页，还应额外检查：

- `old-blog` 的筛选是否可用
- 发布日期、阅读量、旧站链接是否仍清楚
- 不要重新引入首页怀旧内容

## 联系方式

- 邮箱：`hansbug@buaa.edu.cn`
- GitHub：<https://github.com/HansBug>
- 博客园：<https://www.cnblogs.com/HansBug/>
