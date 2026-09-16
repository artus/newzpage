import { XMLParser } from "fast-xml-parser";
import { hashId } from "@/lib/util/hash";
import { collapseWhitespace, countWords, htmlToText } from "@/lib/util/text";

export type FeedImageSource = "media" | "thumbnail" | "enclosure" | "content" | "itunes";

export interface FeedImage {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
  source: FeedImageSource;
}

export interface FeedItem {
  id: string;
  title: string;
  link?: string;
  commentsLink?: string;
  /** ISO 8601 */
  published?: string;
  author?: string;
  /** Plain text description. */
  summary?: string;
  /** Full HTML body when the feed carries one. */
  content?: string;
  images: FeedImage[];
  categories: string[];
}

export interface ParsedFeed {
  title: string;
  link?: string;
  description?: string;
  language?: string;
  ttlMinutes?: number;
  items: FeedItem[];
}

type XmlNode = string | number | boolean | null | undefined | XmlObject | XmlNode[];
interface XmlObject {
  [key: string]: XmlNode;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
  htmlEntities: true,
  ignoreDeclaration: true,
  ignorePiTags: true,
});

const asArray = (node: XmlNode): XmlNode[] => (node === undefined || node === null ? [] : Array.isArray(node) ? node : [node]);

const isObject = (node: XmlNode): node is XmlObject => typeof node === "object" && node !== null && !Array.isArray(node);

/** Text content of a node, whether it is a bare string or an element with attributes. */
function text(node: XmlNode): string | undefined {
  if (node === undefined || node === null) return undefined;
  if (Array.isArray(node)) return text(node[0]);
  if (isObject(node)) return text(node["#text"]);
  const value = String(node).trim();
  return value.length > 0 ? value : undefined;
}

function attr(node: XmlNode, name: string): string | undefined {
  return isObject(node) ? text(node[`@_${name}`]) : undefined;
}

const clean = (value: string | undefined) => (value ? collapseWhitespace(htmlToText(value)) : undefined);

const toNumber = (value: string | undefined) => {
  const parsed = value ? parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

function parseDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function isHttpUrl(value: string | undefined): value is string {
  return !!value && /^https?:\/\//i.test(value);
}

function imagesFromHtml(html: string | undefined, source: FeedImageSource): FeedImage[] {
  if (!html) return [];
  const images: FeedImage[] = [];
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const src = tag.match(/\ssrc=["']([^"']+)["']/i)?.[1];
    if (!isHttpUrl(src)) continue;
    images.push({
      url: src.replace(/&amp;/g, "&"),
      width: toNumber(tag.match(/\swidth=["']?(\d+)/i)?.[1]),
      height: toNumber(tag.match(/\sheight=["']?(\d+)/i)?.[1]),
      alt: clean(tag.match(/\salt=["']([^"']*)["']/i)?.[1]),
      source,
    });
  }
  return images;
}

/** Media RSS, enclosures and iTunes artwork; recurses into media:group. */
function mediaImages(node: XmlObject): FeedImage[] {
  const images: FeedImage[] = [];
  for (const group of asArray(node["media:group"])) if (isObject(group)) images.push(...mediaImages(group));
  for (const content of asArray(node["media:content"])) {
    const url = attr(content, "url");
    const medium = attr(content, "medium");
    const type = attr(content, "type");
    const looksLikeImage = medium === "image" || type?.startsWith("image/") || /\.(jpe?g|png|webp|avif)(\?|$)/i.test(url ?? "");
    if (isHttpUrl(url) && looksLikeImage) {
      images.push({ url, width: toNumber(attr(content, "width")), height: toNumber(attr(content, "height")), source: "media" });
    }
  }
  for (const thumbnail of asArray(node["media:thumbnail"])) {
    const url = attr(thumbnail, "url");
    if (isHttpUrl(url)) {
      images.push({ url, width: toNumber(attr(thumbnail, "width")), height: toNumber(attr(thumbnail, "height")), source: "thumbnail" });
    }
  }
  for (const enclosure of asArray(node.enclosure)) {
    const url = attr(enclosure, "url");
    if (isHttpUrl(url) && attr(enclosure, "type")?.startsWith("image/")) images.push({ url, source: "enclosure" });
  }
  const itunes = attr(node["itunes:image"], "href");
  if (isHttpUrl(itunes)) images.push({ url: itunes, source: "itunes" });
  return images;
}

/** A description is usable as the article body when it is real HTML of some length. */
function contentFromDescription(description: string | undefined): string | undefined {
  if (!description || !/<(p|br|div|h\d)[\s>/]/i.test(description)) return undefined;
  return countWords(htmlToText(description)) >= 120 ? description : undefined;
}

function itemId(guid: string | undefined, link: string | undefined, title: string, published: string | undefined): string {
  return guid ?? link ?? hashId(`${title}|${published ?? ""}`);
}

function parseRssItem(item: XmlObject): FeedItem {
  const title = clean(text(item.title)) ?? "Untitled";
  const guid = text(item.guid);
  const guidIsLink = attr(item.guid, "isPermaLink") !== "false" && isHttpUrl(guid);
  const link = text(item.link) ?? (guidIsLink ? guid : undefined);
  const published = parseDate(text(item.pubDate) ?? text(item["dc:date"]) ?? text(item.published));
  const description = text(item.description);
  const encoded = text(item["content:encoded"]);
  const content = encoded ?? contentFromDescription(description);
  return {
    id: itemId(guid, link, title, published),
    title,
    link: isHttpUrl(link) ? link : undefined,
    commentsLink: text(item.comments),
    published,
    author: clean(text(item["dc:creator"]) ?? text(item.author)),
    summary: clean(description),
    content,
    images: [...mediaImages(item), ...imagesFromHtml(encoded, "content"), ...imagesFromHtml(description, "content")],
    categories: asArray(item.category).map((category) => clean(text(category))).filter((c): c is string => !!c),
  };
}

function parseRss(channel: XmlObject): ParsedFeed {
  return {
    title: clean(text(channel.title)) ?? "Untitled feed",
    link: text(channel.link),
    description: clean(text(channel.description)),
    language: text(channel.language),
    ttlMinutes: toNumber(text(channel.ttl)),
    items: asArray(channel.item).filter(isObject).map(parseRssItem),
  };
}

function atomLink(node: XmlNode, rel: string): string | undefined {
  const links = asArray(node).filter(isObject);
  const match =
    links.find((link) => (attr(link, "rel") ?? "alternate") === rel && (attr(link, "type") ?? "text/html").includes("html")) ??
    links.find((link) => (attr(link, "rel") ?? "alternate") === rel);
  return attr(match, "href");
}

function parseAtomEntry(entry: XmlObject): FeedItem {
  const title = clean(text(entry.title)) ?? "Untitled";
  const link = atomLink(entry.link, "alternate") ?? attr(asArray(entry.link)[0], "href");
  const published = parseDate(text(entry.published) ?? text(entry.updated));
  const contentNode = entry.content;
  const content = isObject(contentNode) && attr(contentNode, "type") === "xhtml" ? undefined : text(contentNode);
  const summaryHtml = text(entry.summary);
  const author = asArray(entry.author)
    .map((a) => clean(text(isObject(a) ? a.name : a)))
    .filter(Boolean)
    .join(", ");
  const enclosures = asArray(entry.link)
    .filter(isObject)
    .filter((l) => attr(l, "rel") === "enclosure" && attr(l, "type")?.startsWith("image/"))
    .map((l) => attr(l, "href"))
    .filter(isHttpUrl)
    .map((url): FeedImage => ({ url, source: "enclosure" }));
  return {
    id: text(entry.id) ?? itemId(undefined, link, title, published),
    title,
    link: isHttpUrl(link) ? link : undefined,
    published,
    author: author || undefined,
    summary: clean(summaryHtml),
    content: content ?? contentFromDescription(summaryHtml),
    images: [...mediaImages(entry), ...enclosures, ...imagesFromHtml(content, "content"), ...imagesFromHtml(summaryHtml, "content")],
    categories: asArray(entry.category)
      .map((category) => attr(category, "label") ?? attr(category, "term"))
      .filter((c): c is string => !!c),
  };
}

function parseAtom(feed: XmlObject): ParsedFeed {
  return {
    title: clean(text(feed.title)) ?? "Untitled feed",
    link: atomLink(feed.link, "alternate"),
    description: clean(text(feed.subtitle)),
    language: attr(feed, "xml:lang"),
    items: asArray(feed.entry).filter(isObject).map(parseAtomEntry),
  };
}

function parseRdf(root: XmlObject): ParsedFeed {
  const channel = isObject(root.channel) ? root.channel : {};
  return {
    title: clean(text(channel.title)) ?? "Untitled feed",
    link: text(channel.link),
    description: clean(text(channel.description)),
    language: text(channel["dc:language"]),
    items: asArray(root.item).filter(isObject).map(parseRssItem),
  };
}

/** Parses RSS 2.0, Atom 1.0 and RSS 1.0 (RDF) into one normalised shape. */
export function parseFeed(xml: string): ParsedFeed {
  const document = parser.parse(xml.replace(/^﻿/, "").trimStart()) as XmlObject;
  const rss = isObject(document.rss) ? document.rss : undefined;
  if (rss && isObject(rss.channel)) return parseRss(rss.channel);
  if (isObject(document.feed)) return parseAtom(document.feed);
  if (isObject(document["rdf:RDF"])) return parseRdf(document["rdf:RDF"]);
  throw new Error("Unrecognised feed format (expected RSS 2.0, Atom or RSS 1.0)");
}
