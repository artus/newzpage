const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  laquo: "«",
  raquo: "»",
  copy: "©",
  reg: "®",
  trade: "™",
  euro: "€",
  pound: "£",
  yen: "¥",
  deg: "°",
  middot: "·",
  bull: "•",
  times: "×",
  eacute: "é",
  egrave: "è",
  ecirc: "ê",
  euml: "ë",
  aacute: "á",
  agrave: "à",
  acirc: "â",
  auml: "ä",
  aring: "å",
  iacute: "í",
  iuml: "ï",
  oacute: "ó",
  ocirc: "ô",
  ouml: "ö",
  oslash: "ø",
  uacute: "ú",
  uuml: "ü",
  ccedil: "ç",
  ntilde: "ñ",
  szlig: "ß",
};

/** Decodes numeric and the most common named HTML entities. */
export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : match;
    }
    const named = NAMED_ENTITIES[entity.toLowerCase()];
    return named ?? match;
  });
}

/** Collapses all runs of whitespace to a single space and trims. */
export function collapseWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

/**
 * Converts an HTML fragment into plain-text paragraphs. Block-level closing
 * tags become paragraph breaks; everything else is stripped.
 */
export function htmlToParagraphs(html: string): string[] {
  const withBreaks = html
    .replace(/<(script|style|noscript|template|svg|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|blockquote|section|article|figcaption|tr|dd|dt|pre)>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(withBreaks)
    .split(/\n\s*\n|\n/)
    .map(collapseWhitespace)
    .filter((paragraph) => paragraph.length > 0);
}

/** Strips all HTML and returns a single line of text. */
export function htmlToText(html: string): string {
  return htmlToParagraphs(html).join(" ");
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function truncateWords(text: string, maxWords: number, suffix = "…"): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(" ").replace(/[,;:\-–—]$/, "") + suffix;
}

/** Hostname without a leading "www." for datelines and captions. */
export function displayHost(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}
