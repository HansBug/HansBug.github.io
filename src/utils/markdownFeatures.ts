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
