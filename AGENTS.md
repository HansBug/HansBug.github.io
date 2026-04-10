# AGENTS.md

本文件用于未来继续维护本站的 agent / 协作者快速上手。

## 仓库目标

这是一个中文个人技术博客仓库。它不是单纯的静态展示页，而是一套长期维护的知识工作台。

维护时优先级如下：

1. 内容结构清晰
2. 发布链路稳定
3. 标签和路线系统持续可用
4. 联系入口始终明确
5. 视觉保持克制、简洁、淡雅

## 技术栈

- Astro
- TypeScript
- GitHub Pages
- GitHub Actions

## 常用命令

```bash
npm install
npm run dev
npm run check
npm run build
```

## 内容约定

### 博客文章

- 目录：`src/content/blog/`
- 所有对外可见文字默认使用中文。
- frontmatter 至少包含：`title`、`description`、`pubDate`、`tags`
- 如果文章属于某条路线，记得补 `routeSlugs`

### 阅读路线

- 目录：`src/content/routes/`
- 路线负责“专题导航”和“推荐阅读顺序”
- 如果新增路线，尽量同时补充首页入口或相关文章引用

### 项目页

- 目录：`src/content/projects/`
- 项目页用于承接长期实践，不要把它写成纯宣传文案

### 标签

- 标签元数据集中维护在 `src/data/tagMeta.ts`
- 新标签优先复用已有主题；确实需要新增时，必须补分组、描述和配色

## 视觉约定

- 不要做重度二次元风格
- 允许保留轻工业感和任务面板感，但要克制
- 颜色保持低饱和，避免大面积高对比炫色
- 优先保证中文阅读舒适度

## 部署约定

- GitHub Pages 通过 `.github/workflows/deploy.yml` 自动部署
- 当前站点按用户仓库 `HansBug.github.io` 设计
- 如果修改 Pages 域名或仓库名，必须同步更新：
  - `astro.config.mjs`
  - `src/config/site.ts`
  - README 中的部署说明

## 联系入口

当前默认联系入口：

- 邮箱：`hansbug@buaa.edu.cn`
- GitHub Issue
- GitHub Discussions

任何改动都不要把联系入口藏得太深，至少首页、关于页、联系页应能找到。
