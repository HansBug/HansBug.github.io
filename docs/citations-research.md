# 论文式引用系统调研与实现记录

## 结论

本站采用 `rehype-citation@2.3.2` 作为 BibTeX / CSL 渲染核心，外面包一层本站自己的校验、路径解析、HTML 后处理和 dev HMR 兜底。

用户可见目标是：

- 每篇文章维护自己的 `.bib`
- 正文写 `[@key]` 与 `[@a; @b]`
- 页面展示右上角 `[1][2]`
- 数字链接跳到同页文末 `#bib-key`
- 缺 key、重复 key、错误 BibTeX、错误语法都给清晰硬报错

## 方案对照

### 方案 A：rehype-citation + BibTeX / CSL + 本站包装

本 PR 采用。

已验证事实：

- `rehype-citation@2.3.2` 可在 Astro 当前 unified 11 pipeline 中运行。
- 它会读取 `file.data.astro.frontmatter.bibliography`，也支持通过 options 传入 `path`、`bibliography`、`csl`。
- `linkCitations: true` 会让正文 citation 链接到 bibliography entry。
- `inlineClass: ["article-citation"]` 可避免默认空 class wrapper。
- `[^ref]` 可以控制 bibliography 插入位置。
- 缺失 key 默认不会硬失败，所以必须加本站 preflight。
- `[@a, @b]` 在 upstream 行为上不适合作为多引用写法，本站 preflight 直接拒绝并提示用分号。
- 裸 `@key` 在 numeric CSL 下可能产生不适合本站的输出，本站第一阶段对“命中当前文章 `.bib` key 的裸写法”直接拒绝；普通社交 mention 或邮箱地址不应被误判成 citation。

### 其他候选

- `@benrbray/remark-cite` / `@benrbray/rehype-cite`：适合作 parser 参考，但 bibliography 格式不是论文级主线。
- Citation.js / citeproc 自研：控制力强，但需要自己维护 parser、编号、CSL 调用和 HTML 输出，第一阶段成本过高。
- `@sgawarat/remark-pandoc-citation`：更像轻量 tooltip / author-year 输出，不适合作本站主线。
- `astroprint`：面向 print-ready / PDF 场景，不是普通博客 citation pipeline。

## 固定文件与路径约定

固定 CSL：

```text
src/citations/styles/hansbug-numeric-superscript.csl
```

该文件基于完整 Nature CSL，保留 bibliography layout，只把 citation layout 改为：

```xml
<layout vertical-align="sup" delimiter="">
  <text variable="citation-number" prefix="[" suffix="]"/>
</layout>
```

文章和 bibliography 推荐同目录：

```text
src/content/blog/engineering/example-post.md
src/content/blog/engineering/example-post.bib
```

frontmatter：

```yaml
bibliography: ./example-post.bib
citationStyle: hansbug-numeric-superscript
```

`bibliography` 只允许文章目录内相对路径。`citationStyle` 第一阶段只允许 `hansbug-numeric-superscript`。

## 校验策略

本站在 `rehype-citation` 之前执行 preflight：

- 正文有 citation 但无 `bibliography`：fail
- 找不到 `.bib`：fail
- BibTeX 语法错误：fail
- 正文引用不存在的 key：fail
- `.bib` 重复 key：fail
- `.bib` key 只靠大小写区分：fail
- `[@a, @b]`：fail，提示 `[@a; @b]`
- 裸 `@key` 且 key 存在于当前文章 `.bib`：fail，提示 `[@key]`
- 普通 `@mention`、邮箱链接、Markdown 链接文本：忽略，不要求补 bibliography
- inline code、fenced code、缩进代码块、raw HTML `<pre>` / `<code>` 中的 `[@key]` / `@key`：忽略
- 未引用 `.bib` 条目：warning

典型错误格式：

```text
[citations] Missing bibliography entry
Markdown: src/content/blog/engineering/example-post.md:42
Bibliography: src/content/blog/engineering/example-post.bib
Missing key: nash1950
Fix: add @...{nash1950, ...} to the article bibliography, or correct the citation key in Markdown.
```

## dev HMR 方案

仅监听 `.bib` 并 full reload 不够，因为 Astro content store 可能复用旧 rendered HTML。

本 PR 的处理方式是两层：

- `contentHmr` 监听 `src/content/blog/**/*.bib`，根据同目录同 slug 或目录内唯一 Markdown 找 owning article，触发 content refresh 和 full reload。
- `renderFreshContent()` 在 dev 且 blog entry 带 `bibliography` 时，用当前 Markdown body 与 `.bib` mtime / size 组成 cache key，重新执行 Markdown render，再把结果交给 Astro `render()`。

这样即使 `.md` 内容没变、Astro content digest 没变，只改 `.bib` title / author / URL，页面请求阶段也会得到新 bibliography。

## fixture 覆盖

单元测试覆盖：

- `[@a]`
- `[@a; @b]`
- `[@a, p. 12]`
- `[-@a]`
- `[@a, @b]` 错误
- 裸 `@a` 错误
- 普通 `@mention` 和邮箱链接不误判
- 缺失 key
- 重复 key
- 大小写冲突
- 无效 BibTeX
- 找不到 `.bib`
- 未引用条目 warning
- code / inline code / 缩进代码块 / raw HTML code 字面量保护
- `.bib` 在文章目录、CSL 在全站固定目录
- 两篇文章路径不串台的路径解析基础

浏览器验收使用 dev-only 页面：

```text
/citation-fixture/
```

对应内容：

```text
src/content/blog/engineering/citation-latex-mermaid-fixture.md
src/content/blog/engineering/citation-latex-mermaid-fixture.bib
```

该页面同时包含 citation、LaTeX、Mermaid 和增强 code block，用于真实浏览器检查点击跳转、高亮和同页共存。

生产构建仍会生成 `/citation-fixture/` 的 noindex redirect 兜底页，但 sitemap 显式过滤该 URL，避免内部验收入口进入正式 sitemap。
