import { getCollection, type CollectionEntry } from "astro:content";
import { fallbackTagMeta, tagMeta } from "../data/tagMeta";

export type BlogEntry = CollectionEntry<"blog">;
export type RouteEntry = CollectionEntry<"routes">;
export type ProjectEntry = CollectionEntry<"projects">;

export async function getAllBlogPosts(): Promise<BlogEntry[]> {
  const posts = await getCollection("blog", ({ data }) => !data.draft);
  return sortBlogPosts(posts);
}

export async function getAllRoutes(): Promise<RouteEntry[]> {
  const routes = await getCollection("routes");
  return [...routes].sort((left, right) => left.data.order - right.data.order);
}

export async function getAllProjects(): Promise<ProjectEntry[]> {
  const projects = await getCollection("projects");
  return [...projects].sort((left, right) => {
    return (
      Number(right.data.featured) - Number(left.data.featured) ||
      left.data.order - right.data.order
    );
  });
}

export function sortBlogPosts(posts: BlogEntry[]): BlogEntry[] {
  return [...posts].sort((left, right) => {
    return (
      Number(right.data.pinned) - Number(left.data.pinned) ||
      right.data.pubDate.getTime() - left.data.pubDate.getTime()
    );
  });
}

export function calculateReadingMinutes(body: string): number {
  const condensed = body.replace(/\s+/g, "");
  return Math.max(1, Math.round(condensed.length / 420));
}

export function getAllTags(posts: BlogEntry[]) {
  const counts = new Map<string, number>();

  for (const post of posts) {
    for (const tag of post.data.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([tag, count]) => ({
      tag,
      slug: tagToSlug(tag),
      count,
      meta: tagMeta[tag] ?? fallbackTagMeta(tag),
    }))
    .sort((left, right) => {
      return right.count - left.count || left.tag.localeCompare(right.tag, "zh-CN");
    });
}

export function tagToSlug(tag: string): string {
  return tag.trim().toLowerCase().replaceAll("/", "-").replace(/\s+/g, "-");
}

export function groupTagsByGroup(posts: BlogEntry[]) {
  const grouped = new Map<
    string,
    ReturnType<typeof getAllTags>[number][]
  >();

  for (const item of getAllTags(posts)) {
    const key = item.meta.group;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)?.push(item);
  }

  return [...grouped.entries()].sort(([left], [right]) =>
    left.localeCompare(right, "zh-CN"),
  );
}

export function groupPostsByYear(posts: BlogEntry[]) {
  const grouped = new Map<string, BlogEntry[]>();

  for (const post of posts) {
    const year = String(post.data.pubDate.getFullYear());
    if (!grouped.has(year)) {
      grouped.set(year, []);
    }
    grouped.get(year)?.push(post);
  }

  return [...grouped.entries()]
    .sort((left, right) => Number(right[0]) - Number(left[0]))
    .map(([year, yearPosts]) => ({
      year,
      posts: sortBlogPosts(yearPosts),
    }));
}

export function getRelatedPosts(
  current: BlogEntry,
  posts: BlogEntry[],
  limit = 3,
): BlogEntry[] {
  const currentTags = new Set(current.data.tags);

  return posts
    .filter((post) => post.id !== current.id)
    .map((post) => ({
      post,
      score: post.data.tags.filter((tag) => currentTags.has(tag)).length,
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((item) => item.post);
}

export function getTagPosts(posts: BlogEntry[], tag: string): BlogEntry[] {
  return posts.filter((post) => post.data.tags.includes(tag));
}

export function getTagRoutes(routes: RouteEntry[], tag: string): RouteEntry[] {
  return routes.filter((route) => route.data.tags.includes(tag));
}

export function getRoutePosts(route: RouteEntry, posts: BlogEntry[]): BlogEntry[] {
  const recommended = route.data.recommendedPosts;

  if (recommended.length > 0) {
    return recommended
      .map((slug) => posts.find((post) => post.id === slug))
      .filter((post): post is BlogEntry => Boolean(post));
  }

  return posts.filter(
    (post) =>
      post.data.routeSlugs.includes(route.id) ||
      post.data.tags.some((tag) => route.data.tags.includes(tag)),
  );
}

export function getPrevNextPosts(current: BlogEntry, posts: BlogEntry[]) {
  const index = posts.findIndex((post) => post.id === current.id);

  return {
    newer: index > 0 ? posts[index - 1] : undefined,
    older: index >= 0 && index < posts.length - 1 ? posts[index + 1] : undefined,
  };
}
