import type { ChosenImage } from "@/lib/articles/images";
import type { Analysis } from "@/lib/summarize/types";

export type ArticleSource = "page" | "content" | "description" | "none";

/** The cacheable result of analysing one article. Stored in readers' browsers. */
export interface ArticleRecord {
  url: string;
  version: number;
  fetchedAt: number;
  /** Where the summarised text came from. */
  source: ArticleSource;
  title?: string;
  byline?: string;
  siteName?: string;
  lang: string;
  publishedTime?: string;
  analysis: Analysis | null;
  image?: ChosenImage;
  wordCount: number;
  error?: string;
  /** When the record should be recomputed (set by the server, honoured by the browser cache). */
  expiresAt?: number;
}

/** A feed item as the API hands it to the browser: no HTML content, just what the page needs. */
export interface FeedItemSummary {
  id: string;
  title: string;
  link?: string;
  commentsLink?: string;
  published?: string;
  author?: string;
}

export interface FeedResponse {
  url: string;
  title: string;
  link?: string;
  language?: string;
  fetchedAt: number;
  /** True when the feed could not be refreshed and an older snapshot is served. */
  stale: boolean;
  items: FeedItemSummary[];
}

export interface Story {
  id: string;
  title: string;
  link?: string;
  commentsLink?: string;
  published?: string;
  author?: string;
  siteName?: string;
  lang: string;
  source: ArticleSource;
  analysis: Analysis | null;
  image?: ChosenImage;
  wordCount: number;
  error?: string;
}

export interface Section {
  name: string;
  url: string;
  link?: string;
  fetchedAt: number;
  stale: boolean;
  error?: string;
  stories: Story[];
}

/** Joins a feed item with its (possibly missing) analysis into what the page renders. */
export function storyFrom(item: FeedItemSummary, article: ArticleRecord | undefined): Story {
  return {
    id: item.id,
    title: item.title,
    link: item.link,
    commentsLink: item.commentsLink,
    published: item.published ?? article?.publishedTime,
    author: article?.byline ?? item.author,
    siteName: article?.siteName,
    lang: article?.lang ?? "en",
    source: article?.source ?? "none",
    analysis: article?.analysis ?? null,
    image: article?.image,
    wordCount: article?.wordCount ?? 0,
    error: article?.error,
  };
}
