import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { siteConfig } from "../config/site";
import { getAllBlogPosts } from "../utils/content";

export const GET: APIRoute = async (context) => {
  const posts = await getAllBlogPosts();

  return rss({
    title: siteConfig.title,
    description: siteConfig.description,
    site: context.site ?? siteConfig.siteUrl,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/blog/${post.id}/`,
    })),
    customData: "<language>zh-cn</language>",
  });
};
