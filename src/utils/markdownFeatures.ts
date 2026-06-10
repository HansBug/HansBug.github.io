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
};

function isFenceClose(line: string, marker: string) {
  const closePattern = new RegExp(`^\\s*${marker[0]}{${marker.length},}\\s*$`);
  return closePattern.test(line);
}

/**
 * Detects only the documented Mermaid fence form for this site: an exact
 * lowercase backtick opener of ` ```mermaid` with no leading language space,
 * no meta string, and no tilde fence.
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
    if (delimiter === "$$" || shouldRenderInlineMath(value)) {
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

  return INLINE_MATH_SIGNAL_RE.test(trimmed);
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
  return (tree: unknown) => {
    walkTree(tree, (node, parent, index) => {
      if (!parent?.children || typeof index !== "number" || !isInlineMathNode(node)) {
        return;
      }

      if (shouldRenderInlineMath(node.value)) {
        return;
      }

      parent.children[index] = {
        type: "text",
        value: `$${node.value}$`,
      };
    });
  };
}
