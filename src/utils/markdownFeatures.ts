const FENCE_OPEN_RE = /^(\s*)(`{3,}|~{3,})(.*)$/;
const ESCAPED_HTML_CHARS_RE = /[&<>"']/g;
const DOLLAR_MATH_RE = /(?<!\\)(\${1,2})([\s\S]+?)(?<!\\)\1/g;
const INLINE_MATH_SIGNAL_RE = /(?:\\[a-zA-Z]+|[=^_{}+\-*/<>|()[\]]|[α-ωΑ-Ω])/u;

type ParentNode = {
  children?: unknown[];
};

type CodeNode = {
  type: "code";
  lang?: string | null;
  meta?: string | null;
  value: string;
  position?: {
    start?: { offset?: number };
  };
};

type InlineMathNode = {
  type: "inlineMath";
  value: string;
  data?: unknown;
  position?: {
    start?: { line?: number; column?: number; offset?: number };
    end?: { line?: number; column?: number; offset?: number };
  };
};

type HtmlElementNode = {
  type: "element";
  tagName: string;
  properties?: Record<string, unknown>;
  children?: unknown[];
};

type TextNode = {
  type: "text";
  value: string;
};

type MarkdownFile = {
  value?: unknown;
  data?: Record<string, unknown>;
};

const CODE_COPY_LITERAL_PAGE_URLS_KEY = "codeCopyLiteralPageUrls";

function isFenceClose(line: string, marker: string) {
  const closePattern = new RegExp(`^\\s*${marker[0]}{${marker.length},}\\s*$`);
  return closePattern.test(line);
}

/**
 * Detects only the documented Mermaid fence form for this site: a lowercase
 * backtick opener with at least three backticks, an info string exactly equal
 * to `mermaid`, no leading language space, no meta string, and no tilde fence.
 */
export function hasMermaidFence(markdown: string): boolean {
  let activeFence: string | undefined;

  for (const line of markdown.split(/\r?\n/)) {
    if (activeFence) {
      if (isFenceClose(line, activeFence)) {
        activeFence = undefined;
      }
      continue;
    }

    const match = line.match(FENCE_OPEN_RE);
    if (!match) {
      continue;
    }

    const [, indent, marker, info] = match;
    if (indent.length > 3) {
      continue;
    }

    if (marker.startsWith("`") && info === "mermaid") {
      return true;
    }

    activeFence = marker;
  }

  return false;
}

export function hasMathSyntax(markdown: string): boolean {
  for (const match of markdown.matchAll(DOLLAR_MATH_RE)) {
    const [, delimiter, value] = match;
    if (delimiter === "$$" || shouldRenderInlineMath(value) || isSpacedInlineMathSource(match[0])) {
      return true;
    }
  }

  return false;
}

export function shouldRenderInlineMath(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return false;
  }

  if (/^[a-zA-Z]$/.test(trimmed)) {
    return true;
  }

  if (isLikelyShellVariableName(trimmed)) {
    return false;
  }

  // This heuristic is deliberately conservative: false negatives such as
  // `$xy$` are preferable to turning regular prose into KaTeX. Writers can
  // force ambiguous short formulas with the spaced form, such as `$ xy $`.
  return INLINE_MATH_SIGNAL_RE.test(trimmed);
}

function isLikelyShellVariableName(value: string) {
  return /^[A-Z_][A-Z0-9_]*$/.test(value);
}

function escapeHtml(value: string) {
  return value.replace(ESCAPED_HTML_CHARS_RE, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

function walkTree(node: unknown, visitor: (node: unknown, parent?: ParentNode, index?: number) => void) {
  function visit(current: unknown, parent?: ParentNode, index?: number) {
    visitor(current, parent, index);

    if (current && typeof current === "object" && Array.isArray((current as ParentNode).children)) {
      for (const [childIndex, child] of (current as ParentNode).children!.entries()) {
        visit(child, current as ParentNode, childIndex);
      }
    }
  }

  visit(node);
}

function isCodeNode(node: unknown): node is CodeNode {
  return Boolean(node && typeof node === "object" && (node as { type?: unknown }).type === "code");
}

function isInlineMathNode(node: unknown): node is InlineMathNode {
  return Boolean(node && typeof node === "object" && (node as { type?: unknown }).type === "inlineMath");
}

function isHtmlElementNode(node: unknown): node is HtmlElementNode {
  return Boolean(node && typeof node === "object" && (node as { type?: unknown }).type === "element");
}

function isTextNode(node: unknown): node is TextNode {
  return Boolean(node && typeof node === "object" && (node as { type?: unknown }).type === "text");
}

function isParagraphNode(node: unknown): node is ParentNode & { type: "paragraph" } {
  return Boolean(node && typeof node === "object" && (node as { type?: unknown }).type === "paragraph");
}

function getOpeningFenceLine(source: string, node: CodeNode) {
  const offset = node.position?.start?.offset;
  if (typeof offset !== "number") {
    return "";
  }

  const lineEnd = source.indexOf("\n", offset);
  return source.slice(offset, lineEnd === -1 ? source.length : lineEnd).replace(/\r$/, "");
}

function isStandardMermaidCodeNode(source: string, node: CodeNode) {
  if (node.lang !== "mermaid" || node.meta) {
    return false;
  }

  return /^ {0,3}`{3,}mermaid$/.test(getOpeningFenceLine(source, node));
}

function getSourceSlice(source: string, node: InlineMathNode) {
  const start = node.position?.start?.offset;
  const end = node.position?.end?.offset;
  if (typeof start !== "number" || typeof end !== "number") {
    return "";
  }

  return source.slice(start, end);
}

function getSourceLength(node: InlineMathNode) {
  const start = node.position?.start?.offset;
  const end = node.position?.end?.offset;
  if (typeof start === "number" && typeof end === "number" && end >= start) {
    return end - start;
  }

  const startLine = node.position?.start?.line;
  const endLine = node.position?.end?.line;
  const startColumn = node.position?.start?.column;
  const endColumn = node.position?.end?.column;
  if (
    typeof startLine === "number" &&
    typeof endLine === "number" &&
    startLine === endLine &&
    typeof startColumn === "number" &&
    typeof endColumn === "number" &&
    endColumn >= startColumn
  ) {
    return endColumn - startColumn;
  }

  return undefined;
}

function isSingleLineDisplayMath(source: string, node: InlineMathNode, parent: ParentNode) {
  if (!isParagraphNode(parent) || parent.children?.length !== 1) {
    return false;
  }

  const sourceSlice = getSourceSlice(source, node).trim();
  if (sourceSlice) {
    return sourceSlice.startsWith("$$") && sourceSlice.endsWith("$$");
  }

  const sourceLength = getSourceLength(node);
  return typeof sourceLength === "number" && sourceLength - node.value.length >= 6;
}

function isSpacedInlineMathSource(sourceSlice: string) {
  return /^\$[\t ]+\S[\s\S]*\S[\t ]+\$$/.test(sourceSlice);
}

function isSpacedInlineMath(source: string, node: InlineMathNode) {
  const sourceSlice = getSourceSlice(source, node);
  if (sourceSlice) {
    return isSpacedInlineMathSource(sourceSlice);
  }

  const sourceLength = getSourceLength(node);
  return typeof sourceLength === "number" && sourceLength - node.value.length >= 4;
}

function getClassList(properties: Record<string, unknown> | undefined) {
  const className = properties?.className ?? properties?.class;
  if (Array.isArray(className)) {
    return className.filter((item): item is string => typeof item === "string");
  }
  if (typeof className === "string") {
    return className.split(/\s+/).filter(Boolean);
  }
  return [];
}

function getStringProperty(properties: Record<string, unknown> | undefined, name: string) {
  const value = properties?.[name] ?? properties?.[toCamelCase(name)];
  return typeof value === "string" ? value : "";
}

function toCamelCase(name: string) {
  return name.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
}

function collectText(node: unknown): string {
  if (isTextNode(node)) {
    return node.value;
  }

  if (isHtmlElementNode(node) && Array.isArray(node.children)) {
    return node.children.map((child) => collectText(child)).join("");
  }

  return "";
}

function createCopyButton(rawCode: string): HtmlElementNode {
  return {
    type: "element",
    tagName: "button",
    properties: {
      className: ["code-block__copy"],
      type: "button",
      "data-code-copy-button": "true",
      "aria-label": rawCode.length === 0 ? "空代码块，无可复制内容" : "复制代码",
      ...(rawCode.length === 0 ? { disabled: true } : {}),
    },
    children: [{ type: "text", value: rawCode.length === 0 ? "空代码" : "复制" }],
  };
}

function shouldCopyPageUrlPlaceholderLiterally(meta: string | null | undefined) {
  return /\bcopy-literal-page-url\b/.test(meta ?? "");
}

function isShikiPreNode(node: unknown): node is HtmlElementNode {
  if (!isHtmlElementNode(node) || node.tagName !== "pre") {
    return false;
  }

  const classList = getClassList(node.properties);
  return classList.includes("astro-code") && Boolean(getStringProperty(node.properties, "data-language"));
}

function getPreCodeChild(node: HtmlElementNode) {
  return node.children?.find(
    (child): child is HtmlElementNode => isHtmlElementNode(child) && child.tagName === "code",
  );
}

function getShikiLineNodes(codeNode: HtmlElementNode) {
  return (codeNode.children ?? []).filter(
    (child): child is HtmlElementNode =>
      isHtmlElementNode(child) && child.tagName === "span" && getClassList(child.properties).includes("line"),
  );
}

function createLineNode(lineNode: HtmlElementNode, lineNumber: number): HtmlElementNode {
  return {
    type: "element",
    tagName: "span",
    properties: {
      className: [
        "code-block__line",
        lineNumber % 2 === 0 ? "code-block__line--even" : "code-block__line--odd",
      ],
      "data-line-number": String(lineNumber),
    },
    children: [
      {
        type: "element",
        tagName: "span",
        properties: {
          className: ["code-block__line-number"],
          "aria-hidden": "true",
        },
        children: [{ type: "text", value: String(lineNumber) }],
      },
      {
        type: "element",
        tagName: "span",
        properties: { className: ["code-block__line-code"] },
        children: lineNode.children ?? [],
      },
    ],
  };
}

export function rehypeEnhancedCodeBlocks() {
  return (tree: unknown, file?: MarkdownFile) => {
    const copyLiteralPageUrls = Array.isArray(file?.data?.[CODE_COPY_LITERAL_PAGE_URLS_KEY])
      ? ([...(file.data[CODE_COPY_LITERAL_PAGE_URLS_KEY] as boolean[])] as boolean[])
      : [];

    walkTree(tree, (node, parent, index) => {
      if (!parent?.children || typeof index !== "number" || !isShikiPreNode(node)) {
        return;
      }

      const codeNode = getPreCodeChild(node);
      if (!codeNode) {
        return;
      }

      const lineNodes = getShikiLineNodes(codeNode);
      if (lineNodes.length === 0) {
        return;
      }

      const rawCode = lineNodes.map((lineNode) => collectText(lineNode)).join("\n");
      const language = getStringProperty(node.properties, "data-language") || "plaintext";
      const preClassList = getClassList(node.properties);
      const copyLiteralPageUrl = copyLiteralPageUrls.shift() ?? false;

      const enhancedPre: HtmlElementNode = {
        ...node,
        properties: {
          className: [...preClassList.filter((className) => className !== "astro-code"), "code-block__pre"],
          style: node.properties?.style,
          tabIndex: node.properties?.tabindex ?? node.properties?.tabIndex,
          dataLanguage: language,
        },
        children: [
          {
            ...codeNode,
            properties: {
              ...codeNode.properties,
              className: [...getClassList(codeNode.properties), "code-block__code"],
            },
            children: lineNodes.map((lineNode, lineIndex) => createLineNode(lineNode, lineIndex + 1)),
          },
        ],
      };

      parent.children[index] = {
        type: "element",
        tagName: "figure",
        properties: {
          className: ["code-block"],
          "data-enhanced-code-block": "true",
          "data-code-language": language,
          "data-code-raw": rawCode,
          ...(copyLiteralPageUrl ? { "data-code-literal-page-url": "true" } : {}),
        },
        children: [
          {
            type: "element",
            tagName: "figcaption",
            properties: { className: ["code-block__header"] },
            children: [
              {
                type: "element",
                tagName: "span",
                properties: { className: ["code-block__language"] },
                children: [{ type: "text", value: language }],
              },
              {
                ...createCopyButton(rawCode),
              },
            ],
          },
          enhancedPre,
        ],
      };
    });
  };
}

export function remarkCodeCopyOptions() {
  return (tree: unknown, file: MarkdownFile) => {
    const source = typeof file.value === "string" ? file.value : "";
    const copyLiteralPageUrls: boolean[] = [];

    walkTree(tree, (node) => {
      if (!isCodeNode(node)) {
        return;
      }

      if (isStandardMermaidCodeNode(source, node)) {
        return;
      }

      copyLiteralPageUrls.push(shouldCopyPageUrlPlaceholderLiterally(node.meta));
    });

    file.data = {
      ...file.data,
      [CODE_COPY_LITERAL_PAGE_URLS_KEY]: copyLiteralPageUrls,
    };
  };
}

export function remarkStandardMermaid() {
  return (tree: unknown, file: { value?: unknown }) => {
    const source = typeof file.value === "string" ? file.value : "";

    walkTree(tree, (node, parent, index) => {
      if (!parent?.children || typeof index !== "number" || !isCodeNode(node)) {
        return;
      }

      if (!isStandardMermaidCodeNode(source, node)) {
        return;
      }

      parent.children[index] = {
        type: "html",
        value: `<pre class="mermaid-source-block" data-standard-mermaid="true"><code class="language-mermaid">${escapeHtml(
          node.value,
        )}</code></pre>`,
      };
    });
  };
}

export function remarkProtectDollarText() {
  return (tree: unknown, file: { value?: unknown }) => {
    const source = typeof file.value === "string" ? file.value : "";

    walkTree(tree, (node, parent, index) => {
      if (!parent?.children || typeof index !== "number" || !isInlineMathNode(node)) {
        return;
      }

      if (isSingleLineDisplayMath(source, node, parent)) {
        Object.assign(parent, {
          type: "math",
          meta: null,
          value: node.value,
          data: {
            hName: "pre",
            hChildren: [
              {
                type: "element",
                tagName: "code",
                properties: { className: ["language-math", "math-display"] },
                children: [{ type: "text", value: node.value }],
              },
            ],
          },
        });
        delete parent.children;
        return;
      }

      if (shouldRenderInlineMath(node.value) || isSpacedInlineMath(source, node)) {
        return;
      }

      parent.children[index] = {
        type: "text",
        value: `$${node.value}$`,
      };
    });
  };
}
