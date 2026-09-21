import { isHttpUrl, type FeedConfig, type NewzpageConfig } from "@/lib/config-schema";
import { collapseWhitespace, decodeEntities, displayHost } from "@/lib/util/text";

export interface OpmlDocument {
  title?: string;
  /** Every subscription in the file, in document order, folders flattened, each address once. */
  feeds: FeedConfig[];
}

/** True for anything that looks like an OPML file, which is how an import tells it from a Newzpage configuration. */
export function looksLikeOpml(text: string): boolean {
  return /<opml[\s>]/i.test(text.slice(0, 4000));
}

function attributes(tag: string): Record<string, string> {
  const found: Record<string, string> = {};
  for (const match of tag.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    found[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? "");
  }
  return found;
}

/**
 * Reads the subscriptions out of an OPML file, the format every feed reader exports. Outlines nested in
 * folders are flattened; an outline counts when it has an `xmlUrl`. The grammar is small enough that a scan
 * for outline tags does the job without an XML parser in the browser.
 */
export function parseOpml(xml: string): OpmlDocument {
  if (!looksLikeOpml(xml)) throw new Error("it is not an OPML file");
  const head = /<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(xml)?.[1] ?? "";
  const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1];
  const feeds: FeedConfig[] = [];
  const seen = new Set<string>();
  for (const match of xml.matchAll(/<outline\b([^>]*)>/gi)) {
    const attribute = attributes(match[1]);
    const url = attribute.xmlurl?.trim();
    if (!isHttpUrl(url) || seen.has(url)) continue;
    seen.add(url);
    const name = collapseWhitespace(attribute.text ?? attribute.title ?? "");
    feeds.push(name ? { url, name } : { url });
  }
  return { title: title ? collapseWhitespace(decodeEntities(title)) || undefined : undefined, feeds };
}

const escapeXml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

/** Writes the page's wires as OPML 2.0, one outline per wire in printing order, for any other reader. */
export function toOpml(config: Pick<NewzpageConfig, "title" | "feeds">, now = new Date()): string {
  const outlines = config.feeds.map((feed) => {
    const name = escapeXml(feed.name ?? displayHost(feed.url) ?? feed.url);
    return `    <outline text="${name}" title="${name}" type="rss" xmlUrl="${escapeXml(feed.url)}"/>`;
  });
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<opml version="2.0">`,
    `  <head>`,
    `    <title>${escapeXml(config.title)}</title>`,
    `    <dateCreated>${now.toUTCString()}</dateCreated>`,
    `  </head>`,
    `  <body>`,
    ...outlines,
    `  </body>`,
    `</opml>`,
    ``,
  ].join("\n");
}
