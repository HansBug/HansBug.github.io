import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import { render, type CollectionEntry } from "astro:content";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { parse } from "devalue";
import { remarkArticleCitationPreflight, rehypeArticleCitations, getCitationCacheKey } from "./citations";
import {
  remarkCodeCopyOptions,
  rehypeEnhancedCodeBlocks,
  remarkProtectDollarText,
  remarkStandardMermaid,
} from "./markdownFeatures";

type RenderableCollection = "blog" | "routes" | "projects";
type RenderableEntry = CollectionEntry<RenderableCollection>;

const dataStoreUrl = new URL("../../.astro/data-store.json", import.meta.url);
const markdownCache = new Map<string, unknown>();

async function createFreshMarkdownProcessor() {
  return createMarkdownProcessor({
    syntaxHighlight: "shiki",
    shikiConfig: { theme: "github-dark" },
    remarkPlugins: [
      remarkGfm,
      remarkMath,
      remarkCodeCopyOptions,
      remarkProtectDollarText,
      remarkStandardMermaid,
      remarkArticleCitationPreflight,
    ],
    rehypePlugins: [rehypeKatex, rehypeEnhancedCodeBlocks, rehypeArticleCitations],
  });
}

async function getFreshDevEntry<TEntry extends RenderableEntry>(entry: TEntry): Promise<TEntry> {
  if (!import.meta.env.DEV) {
    return entry;
  }

  try {
    const serializedStore = await readFile(dataStoreUrl, "utf8");
    const store = parse(serializedStore) as Map<string, Map<string, Omit<TEntry, "collection">>>;
    const freshEntry = store.get(entry.collection)?.get(entry.id);

    if (!freshEntry) {
      return entry;
    }

    return {
      ...freshEntry,
      collection: entry.collection,
    } as TEntry;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[hansbug-content-hmr] failed to read fresh content store, falling back to stale entry: ${message}`);
    return entry;
  }
}

export async function renderFreshContent<TEntry extends RenderableEntry>(entry: TEntry) {
  const freshEntry = await getFreshDevEntry(entry);
  if (freshEntry.collection === "blog" && freshEntry.data.bibliography && freshEntry.filePath) {
    const citationCacheKey = getCitationCacheKey(freshEntry.filePath, freshEntry.data.bibliography);
    const cacheKey = `${freshEntry.filePath}:${freshEntry.body}:${citationCacheKey}`;
    let processor = markdownCache.get(cacheKey) as Awaited<ReturnType<typeof createFreshMarkdownProcessor>> | undefined;
    if (!processor) {
      markdownCache.clear();
      processor = await createFreshMarkdownProcessor();
      markdownCache.set(cacheKey, processor);
    }
    const renderedMarkdown = await processor.render(freshEntry.body ?? "", {
      fileURL: pathToFileURL(freshEntry.filePath),
      frontmatter: freshEntry.data,
    });
    const rerenderedEntry = {
      ...freshEntry,
      rendered: {
        html: renderedMarkdown.code,
        metadata: {
          ...freshEntry.rendered?.metadata,
          headings: renderedMarkdown.metadata.headings,
          frontmatter: renderedMarkdown.metadata.frontmatter,
          imagePaths: [
            ...(renderedMarkdown.metadata.localImagePaths ?? []),
            ...(renderedMarkdown.metadata.remoteImagePaths ?? []),
          ],
        },
      },
    } as TEntry;
    const rendered = await render(rerenderedEntry);

    return {
      entry: freshEntry,
      ...rendered,
    };
  }

  const rendered = await render(freshEntry);

  return {
    entry: freshEntry,
    ...rendered,
  };
}
