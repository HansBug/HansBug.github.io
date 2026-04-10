# HansBug 的个人技术博客

这是 HansBug 的中文个人技术博客，基于 Astro 构建，部署到 GitHub Pages。

## 设计目标

- 以中文写作为主，聚焦工程实践、AI 应用与知识沉淀。
- 不做重二次元视觉，而是保留轻工业感、秩序感和留白。
- 用标签、路线、归档和项目页组织内容，而不是只靠时间线。
- 保留明确的联系入口，便于勘误、交流和合作。

## 当前功能

- 博客文章列表与详情页
- 多标签体系与标签索引页
- 年度归档页
- 路线页与专题式阅读指引
- 项目页
- 联系页
- 站内搜索
- RSS
- GitHub Pages 自动部署工作流

当前仓库也支持“内容暂时为空”的新站阶段：即使 `src/content/blog/`、`src/content/routes/`、`src/content/projects/` 里没有文章，首页和各索引页仍然应该正常渲染空状态。

## 本地开发

```bash
npm install
npm run dev
```

常用命令：

```bash
npm run check
npm run build
npm run preview
```

## 目录结构

```text
src/
  components/     公共组件
  config/         站点配置
  content/        博客、路线、项目内容
  data/           标签元数据
  layouts/        页面布局
  pages/          路由页面
  styles/         全局样式
  utils/          内容处理工具
```

## 内容组织方式

- `src/content/blog/`：博客文章
- `src/content/routes/`：阅读路线与指引
- `src/content/projects/`：项目档案

## 旧博客说明

- 旧博客园入口：<https://www.cnblogs.com/HansBug/>
- 当前迁移策略是不直接整批搬运旧文，而是在新站保留旧站入口，并按新的结构逐步重写、整理和归档。

标签元数据集中放在 `src/data/tagMeta.ts`。如果新增标签，优先同步补充描述和分组，而不是只在文章 frontmatter 里随手加。

## 部署

默认推送到 `main` 分支后，由 `.github/workflows/deploy.yml` 自动发布到 GitHub Pages。

当前站点地址按用户 Pages 设计：

- `https://hansbug.github.io`

如果未来要切换为组织或自定义域名，需要同步更新：

- `astro.config.mjs`
- `src/config/site.ts`
- GitHub Pages 设置

## 联系方式

- 邮箱：`hansbug@buaa.edu.cn`
- GitHub：<https://github.com/HansBug>
