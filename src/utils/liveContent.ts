import { readFile } from "node:fs/promises";
import { render, type CollectionEntry } from "astro:content";
import { parse } from "devalue";

type RenderableCollection = "blog" | "routes" | "projects";
type RenderableEntry = CollectionEntry<RenderableCollection>;

const dataStoreUrl = new URL("../../.astro/data-store.json", import.meta.url);

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
  } catch {
    return entry;
  }
}

export async function renderFreshContent<TEntry extends RenderableEntry>(entry: TEntry) {
  const freshEntry = await getFreshDevEntry(entry);
  const rendered = await render(freshEntry);

  return {
    entry: freshEntry,
    ...rendered,
  };
}
