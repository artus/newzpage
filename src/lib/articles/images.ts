import type { FeedItem } from "@/lib/feeds/parse-feed";

export type ImageSource = "og" | "twitter" | "link" | "media" | "thumbnail" | "enclosure" | "content" | "itunes";

export interface ImageCandidate {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
  source: ImageSource;
}

export interface ChosenImage {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  source: ImageSource;
}

/** Where an image came from says a lot about whether it is the story's photo or a widget. */
const SOURCE_SCORE: Record<ImageSource, number> = {
  og: 50,
  media: 46,
  twitter: 42,
  link: 38,
  enclosure: 36,
  content: 28,
  itunes: 24,
  thumbnail: 20,
};

const BLOCKED_WORDS =
  /(^|[/._\-?=&])(pixel|pixels|tracking|tracker|1x1|spacer|blank|logo|logos|icon|icons|avatar|avatars|gravatar|badge|badges|sprite|sprites|emoji|feedburner|doubleclick|ads?|counter|share|sharing|button|buttons|rating|loading|loader|placeholder|smiley|favicon|beacon|comments)(?=[/._\-?=&]|$)/i;
const BLOCKED_EXTENSIONS = /\.(svg|gif|ico|bmp)$/i;

export function isUsableImage(candidate: ImageCandidate): boolean {
  let url: URL;
  try {
    url = new URL(candidate.url);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (BLOCKED_EXTENSIONS.test(url.pathname)) return false;
  if (BLOCKED_WORDS.test(url.pathname + url.search)) return false;
  if (candidate.width !== undefined && candidate.width < 200) return false;
  if (candidate.height !== undefined && candidate.height < 120) return false;
  if (candidate.width && candidate.height) {
    const ratio = candidate.width / candidate.height;
    if (ratio > 3.5 || ratio < 0.4) return false; // banners and skyscrapers are never the story's photo
  }
  return true;
}

function score(candidate: ImageCandidate, position: number): number {
  let value = SOURCE_SCORE[candidate.source] - position * 0.01;
  if (candidate.width) value += Math.min(candidate.width, 1600) / 80;
  return value;
}

/** Picks the candidate most likely to be the story's own photograph. */
export function chooseImage(candidates: ImageCandidate[]): ChosenImage | undefined {
  let best: ImageCandidate | undefined;
  let bestScore = -Infinity;
  candidates.forEach((candidate, position) => {
    if (!isUsableImage(candidate)) return;
    const value = score(candidate, position);
    if (value > bestScore) {
      best = candidate;
      bestScore = value;
    }
  });
  if (!best) return undefined;
  return { url: best.url, alt: best.alt || undefined, width: best.width, height: best.height, source: best.source };
}

export function feedImageCandidates(item: FeedItem): ImageCandidate[] {
  return item.images.map((image) => ({ ...image }));
}
