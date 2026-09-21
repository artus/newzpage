import type { ChosenImage } from "@/lib/articles/images";
import { isHttpUrl } from "@/lib/config-schema";
import { compose } from "@/lib/summarize/compose";
import { displayHost, truncateWords } from "@/lib/util/text";
import type { ArticleRecord } from "./types";

/** What a cutting's address carries: the story, the wire it came from, and the headline the reader saw. */
export interface CuttingRequest {
  url: string;
  feed?: string;
  title?: string;
}

const TITLE_LENGTH = 160;

/** The query a cutting and its preview image share. */
export function cuttingQuery(request: CuttingRequest): string {
  const query = new URLSearchParams({ url: request.url });
  if (request.feed) query.set("feed", request.feed);
  if (request.title) query.set("title", request.title.slice(0, TITLE_LENGTH));
  return query.toString();
}

/** The page address of a story's cutting; undefined for a story without a link. */
export function cuttingPath(story: { link?: string; title: string; feedUrl?: string }): string | undefined {
  if (!story.link) return undefined;
  return `/story?${cuttingQuery({ url: story.link, feed: story.feedUrl, title: story.title })}`;
}

/** Reads a cutting's address; undefined when it names no story. */
export function cuttingRequest(params: Record<string, string | string[] | undefined>): CuttingRequest | undefined {
  const url = typeof params.url === "string" ? params.url.trim() : "";
  if (!isHttpUrl(url)) return undefined;
  const feed = typeof params.feed === "string" && isHttpUrl(params.feed.trim()) ? params.feed.trim() : undefined;
  const title = typeof params.title === "string" && params.title.trim() ? params.title.trim().slice(0, TITLE_LENGTH) : undefined;
  return { url, feed, title };
}

export interface Cutting {
  url: string;
  title: string;
  host?: string;
  byline?: string;
  /** ISO time the story was published, when known. */
  published?: string;
  lang: string;
  paragraphs: string[];
  image?: ChosenImage;
  /** The first lines of the copy, for the link preview. */
  excerpt: string;
  /** True when no copy could be cut from the page. */
  missing: boolean;
  error?: string;
}

/** A cutting is read on its own, so it gets a fuller summary than a column allows. */
export const CUTTING_WORDS = 320;

/** Cuts the story out of its analysis: headline, dateline, photograph and copy. */
export function cutStory(record: ArticleRecord, request: CuttingRequest): Cutting {
  const summary = compose(record.analysis, { maxWords: CUTTING_WORDS, maxSentences: 16, maxParagraphs: 5 });
  const host = displayHost(request.url);
  const title = request.title ?? record.title?.trim() ?? host ?? request.url;
  const missing = summary.paragraphs.length === 0;
  const excerpt = missing ? (host ? `A story from ${host}, cut from Newzpage.` : "A story cut from Newzpage.") : truncateWords(summary.paragraphs.join(" "), 40);
  return {
    url: request.url,
    title,
    host,
    byline: record.byline,
    published: record.publishedTime,
    lang: record.lang,
    paragraphs: summary.paragraphs,
    image: record.image,
    excerpt,
    missing,
    error: record.error,
  };
}

/** A record for a story that could not be read at all, so a cutting can still be printed around its headline. */
export function unreadable(request: CuttingRequest, error: string): ArticleRecord {
  return { url: request.url, version: 0, fetchedAt: Date.now(), source: "none", lang: "en", analysis: null, wordCount: 0, error };
}
