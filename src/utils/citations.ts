import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Cite } from "@citation-js/core";
import "@citation-js/plugin-bibtex";
import rehypeCitation from "rehype-citation";

const SUPPORTED_CITATION_STYLE = "hansbug-numeric-superscript";
const DEFAULT_CSL_PATH = "src/citations/styles/hansbug-numeric-superscript.csl";
const CONTENT_BLOG_ROOT = "src/content/blog";
const BRACKET_CITATION_RE = /\[((?:[^\[\]]|\[[^\]]*\])*@(?:[^\[\]]|\[[^\]]*\])*)\]/g;
const BARE_CITATION_RE = /(^|[\s([{"'，。；：、])@([A-Za-z0-9_][A-Za-z0-9_:.#$%&+?<>~/-]*)/g;
const CITE_KEY_RE = /@([A-Za-z0-9_][A-Za-z0-9_:.#$%&+?<>~/-]*)/g;
const BIB_ENTRY_RE = /@([A-Za-z]+)\s*{\s*([^,\s]+)\s*,/g;

type ParentNode = {
  children?: unknown[];
};

type HastElement = ParentNode & {
  type?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
};

type MarkdownFile = {
  value?: unknown;
  path?: unknown;
  cwd?: string;
  data?: {
    astro?: {
      frontmatter?: Record<string, unknown>;
    };
    matter?: Record<string, unknown>;
    frontmatter?: Record<string, unknown>;
  };
  message?: (reason: string) => unknown;
};

type CitationPathInput = {
  root?: string;
  markdownPath: string;
  bibliography: string;
  csl?: string;
};

type ArticleCitationOptions = {
  root?: string;
  csl?: string;
};

type CitationUse = {
  key: string;
  raw: string;
  line?: number;
  column?: number;
};

type CitationScan = {
  citations: CitationUse[];
};

type BibEntryIndex = {
  keys: Set<string>;
};

type RehypeCitationTransformer = (tree: unknown, file: MarkdownFile) => unknown | Promise<unknown>;

const rehypeCitationFactory = rehypeCitation as unknown as (
  options: Record<string, unknown>,
) => RehypeCitationTransformer;

export type ArticleCitationPaths = {
  root: string;
  markdownAbsPath: string;
  bibliographyAbsPath: string;
  bibliographyRelativePath: string;
  cslAbsPath: string;
  cslRelativePath: string;
};

export function hasArticleCitationSyntax(markdown: string): boolean {
  const masked = maskCodeRanges(markdown);
  BRACKET_CITATION_RE.lastIndex = 0;
  BARE_CITATION_RE.lastIndex = 0;
  return BRACKET_CITATION_RE.test(masked) || BARE_CITATION_RE.test(masked);
}

export function resolveArticleCitationPaths(input: CitationPathInput): ArticleCitationPaths {
  const root = resolve(input.root ?? process.cwd());
  const markdownAbsPath = pathFromMaybeFileUrl(input.markdownPath);
  const articleDir = dirname(markdownAbsPath);
  const bibliographyValue = input.bibliography.trim();

  if (bibliographyValue.length === 0) {
    throw new Error(formatCitationError("Empty bibliography path", { markdownPath: markdownAbsPath }));
  }
  if (isAbsolute(bibliographyValue)) {
    throw new Error(
      formatCitationError("Invalid bibliography path", {
        markdownPath: markdownAbsPath,
        bibliographyPath: bibliographyValue,
        fix: "Use an article-relative bibliography path such as ./example-post.bib.",
      }),
    );
  }

  const bibliographyAbsPath = resolve(articleDir, bibliographyValue);
  const articleDirRelative = toPosix(relative(articleDir, bibliographyAbsPath));
  if (articleDirRelative.startsWith("../") || articleDirRelative === "..") {
    throw new Error(
      formatCitationError("Bibliography path must stay in the article directory", {
        markdownPath: markdownAbsPath,
        bibliographyPath: bibliographyAbsPath,
        fix: "Move the .bib file next to the Markdown article, or change bibliography to ./<article>.bib.",
      }),
    );
  }

  const blogRoot = resolve(root, CONTENT_BLOG_ROOT);
  const blogRelative = toPosix(relative(blogRoot, bibliographyAbsPath));
  if (blogRelative.startsWith("../") || blogRelative === "..") {
    throw new Error(
      formatCitationError("Bibliography file must stay under src/content/blog", {
        markdownPath: markdownAbsPath,
        bibliographyPath: bibliographyAbsPath,
        fix: "Keep per-article bibliography files under src/content/blog beside their Markdown article.",
      }),
    );
  }

  const cslRelativePath = input.csl ?? DEFAULT_CSL_PATH;
  const cslAbsPath = resolve(root, cslRelativePath);

  return {
    root,
    markdownAbsPath,
    bibliographyAbsPath,
    bibliographyRelativePath: toPosix(relative(root, bibliographyAbsPath)),
    cslAbsPath,
    cslRelativePath: toPosix(relative(root, cslAbsPath)),
  };
}

export function remarkArticleCitationPreflight(options: ArticleCitationOptions = {}) {
  return (_tree: unknown, file: MarkdownFile) => {
    const source = typeof file.value === "string" ? file.value : "";
    const markdownPath = getMarkdownPath(file);
    const frontmatter = getFrontmatter(file);
    const bibliography = getStringFrontmatter(frontmatter, "bibliography");
    const citationStyle = getStringFrontmatter(frontmatter, "citationStyle");
    const scan = scanCitationUses(source);

    if (citationStyle && citationStyle !== SUPPORTED_CITATION_STYLE) {
      throw new Error(
        formatCitationError("Unsupported citation style", {
          markdownPath,
          key: citationStyle,
          fix: `Use citationStyle: ${SUPPORTED_CITATION_STYLE}, or omit citationStyle to use the site default.`,
        }),
      );
    }

    if (!bibliography) {
      if (scan.citations.length > 0) {
        throw new Error(
          formatCitationError("Missing bibliography frontmatter", {
            markdownPath,
            key: scan.citations[0]?.key,
            position: formatPosition(scan.citations[0]),
            context: scan.citations[0]?.raw,
            fix: "Add bibliography: ./<article>.bib to this article frontmatter.",
          }),
        );
      }
      return;
    }

    const paths = resolveArticleCitationPaths({
      root: options.root,
      markdownPath,
      bibliography,
      csl: options.csl,
    });

    validateCitationFiles(paths);
    const bibtex = readBibtex(paths);
    const bibIndex = parseBibtexIndex(bibtex, paths);
    const usedKeys = new Set(scan.citations.map((citation) => citation.key));

    for (const citation of scan.citations) {
      if (!bibIndex.keys.has(citation.key)) {
        throw new Error(
          formatCitationError("Missing bibliography entry", {
            markdownPath: paths.markdownAbsPath,
            bibliographyPath: paths.bibliographyAbsPath,
            key: citation.key,
            position: formatPosition(citation),
            context: citation.raw,
            fix: `add @...{${citation.key}, ...} to the article bibliography, or correct the citation key in Markdown.`,
          }),
        );
      }
    }

    for (const key of bibIndex.keys) {
      if (!usedKeys.has(key)) {
        console.warn(
          formatCitationError("Unused bibliography entry", {
            markdownPath: paths.markdownAbsPath,
            bibliographyPath: paths.bibliographyAbsPath,
            key,
            fix: "Remove the unused .bib entry, or cite it from Markdown with [@key].",
          }),
        );
      }
    }
  };
}

export function rehypeArticleCitations(options: ArticleCitationOptions = {}) {
  return async (tree: unknown, file: MarkdownFile) => {
    const frontmatter = getFrontmatter(file);
    const bibliography = getStringFrontmatter(frontmatter, "bibliography");
    if (!bibliography) {
      return;
    }

    const paths = resolveArticleCitationPaths({
      root: options.root,
      markdownPath: getMarkdownPath(file),
      bibliography,
      csl: options.csl,
    });

    const transformer = rehypeCitationFactory({
      path: paths.root,
      bibliography: paths.bibliographyRelativePath,
      csl: paths.cslRelativePath,
      lang: "en-US",
      linkCitations: true,
      inlineClass: ["article-citation"],
    });

    await transformer(tree, file);
    enhanceCitationHtml(tree);
  };
}

export function getCitationCacheKey(markdownPath: string, bibliography?: string, root?: string) {
  if (!bibliography) {
    return "";
  }

  const paths = resolveArticleCitationPaths({ root, markdownPath, bibliography });
  if (!existsSync(paths.bibliographyAbsPath)) {
    return `${paths.bibliographyAbsPath}:missing`;
  }

  const stat = statSync(paths.bibliographyAbsPath);
  return `${paths.bibliographyAbsPath}:${stat.mtimeMs}:${stat.size}`;
}

function validateCitationFiles(paths: ArticleCitationPaths) {
  if (!existsSync(paths.bibliographyAbsPath)) {
    throw new Error(
      formatCitationError("Bibliography file not found", {
        markdownPath: paths.markdownAbsPath,
        bibliographyPath: paths.bibliographyAbsPath,
        fix: "Create this .bib file beside the Markdown article, or fix the bibliography frontmatter path.",
      }),
    );
  }
  if (!existsSync(paths.cslAbsPath)) {
    throw new Error(
      formatCitationError("Citation style file not found", {
        markdownPath: paths.markdownAbsPath,
        bibliographyPath: paths.bibliographyAbsPath,
        fix: `Restore ${DEFAULT_CSL_PATH}, or update the citation wrapper configuration.`,
      }),
    );
  }
}

function readBibtex(paths: ArticleCitationPaths) {
  try {
    return readFileSync(paths.bibliographyAbsPath, "utf8");
  } catch (error) {
    throw new Error(
      formatCitationError("Cannot read bibliography file", {
        markdownPath: paths.markdownAbsPath,
        bibliographyPath: paths.bibliographyAbsPath,
        fix: "Check the .bib file path and filesystem permissions.",
        cause: error,
      }),
    );
  }
}

function parseBibtexIndex(bibtex: string, paths: ArticleCitationPaths): BibEntryIndex {
  const keys = new Set<string>();
  const duplicateKeys: string[] = [];
  const caseGroups = new Map<string, string[]>();
  let match: RegExpExecArray | null;

  BIB_ENTRY_RE.lastIndex = 0;
  while ((match = BIB_ENTRY_RE.exec(bibtex))) {
    const key = match[2];
    if (keys.has(key)) {
      duplicateKeys.push(key);
    }
    keys.add(key);
    const lowerKey = key.toLowerCase();
    caseGroups.set(lowerKey, [...(caseGroups.get(lowerKey) ?? []), key]);
  }

  for (const duplicateKey of duplicateKeys) {
    throw new Error(
      formatCitationError("Duplicate BibTeX key", {
        markdownPath: paths.markdownAbsPath,
        bibliographyPath: paths.bibliographyAbsPath,
        key: duplicateKey,
        fix: "Keep exactly one BibTeX entry for each key.",
      }),
    );
  }

  const caseConflicts = new Map(
    [...caseGroups.entries()].filter(([, values]) => new Set(values).size > 1),
  );
  for (const [lowerKey, values] of caseConflicts) {
    throw new Error(
      formatCitationError("BibTeX key case conflict", {
        markdownPath: paths.markdownAbsPath,
        bibliographyPath: paths.bibliographyAbsPath,
        key: lowerKey,
        context: values.join(", "),
        fix: "Use one exact key spelling only; keys that differ only by case are not allowed.",
      }),
    );
  }

  try {
    new Cite(bibtex);
  } catch (error) {
    throw new Error(
      formatCitationError("Invalid BibTeX", {
        markdownPath: paths.markdownAbsPath,
        bibliographyPath: paths.bibliographyAbsPath,
        fix: "Fix the BibTeX syntax in this file before rendering the article.",
        cause: error,
      }),
    );
  }

  return { keys };
}

function scanCitationUses(markdown: string): CitationScan {
  const masked = maskCodeRanges(markdown);
  const bracketRanges: Array<[number, number]> = [];
  const citations: CitationUse[] = [];
  let bracketMatch: RegExpExecArray | null;

  BRACKET_CITATION_RE.lastIndex = 0;
  while ((bracketMatch = BRACKET_CITATION_RE.exec(masked))) {
    const raw = bracketMatch[0];
    const body = bracketMatch[1];
    bracketRanges.push([bracketMatch.index, bracketMatch.index + raw.length]);
    if (/@[A-Za-z0-9_][A-Za-z0-9_:.#$%&+?<>~/-]*\s*,\s*@/.test(body)) {
      throw new Error(
        formatCitationError("Invalid comma-separated citation", {
          position: formatOffset(markdown, bracketMatch.index),
          context: raw,
          fix: "逗号不是多引用分隔符，多引用请写 `[@a; @b]`；逗号只用于 locator / suffix，例如 `[@a, p. 12]`。",
        }),
      );
    }

    CITE_KEY_RE.lastIndex = 0;
    let keyMatch: RegExpExecArray | null;
    while ((keyMatch = CITE_KEY_RE.exec(body))) {
      citations.push({
        key: keyMatch[1],
        raw,
        ...offsetToPosition(markdown, bracketMatch.index + keyMatch.index + 1),
      });
    }
  }

  let bareMatch: RegExpExecArray | null;
  BARE_CITATION_RE.lastIndex = 0;
  while ((bareMatch = BARE_CITATION_RE.exec(masked))) {
    const key = bareMatch[2];
    const atOffset = bareMatch.index + bareMatch[1].length;
    if (bracketRanges.some(([start, end]) => atOffset >= start && atOffset < end)) {
      continue;
    }
    throw new Error(
      formatCitationError("Bare citation syntax is not supported", {
        key,
        position: formatOffset(markdown, atOffset),
        context: `@${key}`,
        fix: `replace \`@${key}\` with \`[@${key}]\`.`,
      }),
    );
  }

  return { citations };
}

function maskCodeRanges(markdown: string) {
  const chars = [...markdown];
  const maskRange = (start: number, end: number) => {
    for (let index = start; index < end; index += 1) {
      if (chars[index] !== "\n" && chars[index] !== "\r") {
        chars[index] = " ";
      }
    }
  };

  let offset = 0;
  let inFence: { marker: string; length: number } | undefined;
  for (const line of markdown.split(/(\r?\n)/)) {
    const isNewline = line === "\n" || line === "\r\n";
    if (isNewline) {
      offset += line.length;
      continue;
    }

    const fence = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fence) {
      const marker = fence[1][0];
      const length = fence[1].length;
      maskRange(offset, offset + line.length);
      if (inFence) {
        if (marker === inFence.marker && length >= inFence.length) {
          inFence = undefined;
        }
      } else {
        inFence = { marker, length };
      }
    } else if (inFence) {
      maskRange(offset, offset + line.length);
    }

    offset += line.length;
  }

  const masked = chars.join("");
  return masked.replace(/`[^`\n]+`/g, (value) => " ".repeat(value.length));
}

function enhanceCitationHtml(tree: unknown) {
  walkTree(tree, (node) => {
    if (!isElementNode(node)) {
      return;
    }

    const classList = getClassList(node.properties);
    node.properties ??= {};
    if (node.tagName === "a" && typeof node.properties.href === "string" && node.properties.href.startsWith("#bib-")) {
      node.properties.className = mergeClassNames(classList, ["article-citation__link"]);
      node.properties["aria-label"] = `跳转到参考文献 ${node.properties.href.slice(5)}`;
    }

    if (node.tagName === "div" && classList.includes("csl-entry")) {
      node.properties.className = mergeClassNames(classList, ["article-reference-entry"]);
      if (typeof node.properties.id === "string" && node.properties.id.startsWith("bib-")) {
        node.properties.tabIndex = "-1";
      }
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

function isElementNode(node: unknown): node is HastElement {
  return Boolean(node && typeof node === "object" && (node as HastElement).type === "element");
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

function mergeClassNames(current: string[], extra: string[]) {
  return [...new Set([...current, ...extra])];
}

function getFrontmatter(file: MarkdownFile) {
  return file.data?.astro?.frontmatter ?? file.data?.frontmatter ?? file.data?.matter ?? {};
}

function getStringFrontmatter(frontmatter: Record<string, unknown>, key: string) {
  const value = frontmatter[key];
  return typeof value === "string" ? value : "";
}

function getMarkdownPath(file: MarkdownFile) {
  if (typeof file.path === "string" && file.path.length > 0) {
    return pathFromMaybeFileUrl(file.path);
  }
  return join(file.cwd ?? process.cwd(), "unknown.md");
}

function pathFromMaybeFileUrl(value: string) {
  if (value.startsWith("file://")) {
    return fileURLToPath(value);
  }
  return value;
}

function formatPosition(citation?: CitationUse) {
  if (!citation?.line || !citation.column) {
    return undefined;
  }
  return `${citation.line}:${citation.column}`;
}

function formatOffset(markdown: string, offset: number) {
  const position = offsetToPosition(markdown, offset);
  return `${position.line}:${position.column}`;
}

function offsetToPosition(markdown: string, offset: number): { line: number; column: number } {
  const slice = markdown.slice(0, Math.max(0, offset));
  const lines = slice.split(/\r?\n/);
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

function formatCitationError(
  title: string,
  details: {
    markdownPath?: string;
    bibliographyPath?: string;
    key?: string;
    position?: string;
    context?: string;
    fix?: string;
    cause?: unknown;
  } = {},
) {
  const lines = [`[citations] ${title}`];
  if (details.markdownPath) {
    lines.push(`Markdown: ${details.markdownPath}${details.position ? `:${details.position}` : ""}`);
  } else if (details.position) {
    lines.push(`Markdown position: ${details.position}`);
  }
  if (details.bibliographyPath) {
    lines.push(`Bibliography: ${details.bibliographyPath}`);
  }
  if (details.key) {
    lines.push(`${title === "Missing bibliography entry" ? "Missing key" : "Key"}: ${details.key}`);
  }
  if (details.context) {
    lines.push(`Context: ${details.context}`);
  }
  if (details.fix) {
    lines.push(`Fix: ${details.fix}`);
  }
  if (details.cause) {
    const message = details.cause instanceof Error ? details.cause.message : String(details.cause);
    lines.push(`Cause: ${message}`);
  }
  return lines.join("\n");
}

function toPosix(path: string) {
  return path.replaceAll("\\", "/");
}
