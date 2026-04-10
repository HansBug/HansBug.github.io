import rawCatalog from "./oldBlogCatalog.json";

export interface OldBlogProfile {
  motto: string;
  followers: number;
  following: number;
  gardenAge: string;
}

export interface OldBlogStats {
  totalPosts: number;
  totalComments: number;
  totalViews: number;
  totalViewsText: string;
}

export interface OldBlogArchiveMonth {
  month: string;
  count: number;
  url: string;
}

export interface OldBlogCategory {
  name: string;
  count: number;
  url: string;
}

export interface OldBlogTrendItem {
  year: number;
  count: number;
}

export interface OldBlogTrackCount {
  name: string;
  count: number;
}

export interface OldBlogRankItem {
  title: string;
  url: string;
  views?: number;
  comments?: number;
  likes?: number;
}

export interface OldBlogPost {
  id: number;
  title: string;
  url: string;
  dateTime: string;
  date: string;
  year: number;
  month: string;
  views: number;
  comments: number;
  summary: string;
  categories: string[];
  track: string;
}

export interface OldBlogCatalog {
  generatedAt: string;
  profile: OldBlogProfile;
  stats: OldBlogStats;
  archives: OldBlogArchiveMonth[];
  categories: OldBlogCategory[];
  yearlyTrend: OldBlogTrendItem[];
  trackCounts: OldBlogTrackCount[];
  topViewed: OldBlogRankItem[];
  topCommented: OldBlogRankItem[];
  topLiked: OldBlogRankItem[];
  posts: OldBlogPost[];
  integrity: {
    missingStatsFilledFromPostPage: number;
    postsWithoutExactCategory: number;
  };
}

export const oldBlogCatalog = rawCatalog as OldBlogCatalog;
