import { defineCollection } from "astro/content/config";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.md" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).min(1),
    difficulty: z.enum(["入门", "进阶", "实践"]).default("入门"),
    excerpt: z.string().optional(),
    series: z.string().optional(),
    draft: z.boolean().default(false),
    featured: z.boolean().default(false),
    pinned: z.boolean().default(false),
    routeSlugs: z.array(z.string()).default([]),
  }),
});

const routes = defineCollection({
  loader: glob({ base: "./src/content/routes", pattern: "**/*.md" }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    order: z.number().int().nonnegative(),
    stage: z.enum(["起步", "进阶", "体系化"]),
    estimatedTime: z.string(),
    tags: z.array(z.string()).min(1),
    recommendedPosts: z.array(z.string()).default([]),
  }),
});

const projects = defineCollection({
  loader: glob({ base: "./src/content/projects", pattern: "**/*.md" }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    order: z.number().int().nonnegative(),
    status: z.enum(["进行中", "持续维护", "构思中"]),
    stack: z.array(z.string()).min(1),
    featured: z.boolean().default(false),
    repoUrl: z.url().optional(),
    demoUrl: z.url().optional(),
  }),
});

export const collections = {
  blog,
  routes,
  projects,
};
