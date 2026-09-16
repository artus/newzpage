import { collapseWhitespace } from "@/lib/util/text";
import { isStopword, type SupportedLanguage } from "./stopwords";

/** Abbreviations after which a period never ends the sentence. */
const ALWAYS_MERGE = new Set(
  `mr mrs ms dr prof sr jr st mt gen sen rep gov pres lt col capt sgt cpl hon rev messrs mme mlle mgr dhr mevr mw hr
   e.g i.e cf viz resp approx dept univ assn bros ave blvd rd ft`.split(/\s+/),
);

/** Abbreviations after which a period does not end the sentence when a number follows. */
const MERGE_BEFORE_NUMBER = new Set(
  `jan feb mar apr jun jul aug sep sept oct nov dec no nos vol fig figs p pp ch sec art min hrs est ca nr abs par
   mln bn`.split(/\s+/),
);

const segmenters = new Map<string, Intl.Segmenter>();

function getSegmenter(lang: string, granularity: "sentence" | "word"): Intl.Segmenter | undefined {
  if (typeof Intl === "undefined" || typeof Intl.Segmenter !== "function") return undefined;
  const key = `${lang}:${granularity}`;
  let segmenter = segmenters.get(key);
  if (!segmenter) {
    segmenter = new Intl.Segmenter(lang, { granularity });
    segmenters.set(key, segmenter);
  }
  return segmenter;
}

/** Repairs text where scraping glued sentences together, e.g. "end.Start". */
function prepare(paragraph: string): string {
  return collapseWhitespace(paragraph)
    .replace(/([a-z\p{Ll}])([.!?])(?=[A-Z\p{Lu}][a-z\p{Ll}])/gu, "$1$2 ")
    .replace(/\s+([.!?,;:])/g, "$1");
}

function segmentRaw(text: string, lang: string): string[] {
  const segmenter = getSegmenter(lang, "sentence");
  if (segmenter) return Array.from(segmenter.segment(text), (part) => part.segment);
  return text.split(/(?<=[.!?…]["'”’)\]]*)\s+(?=[A-Z0-9"“(\[])/);
}

function lastTokenBeforePeriod(segment: string): string | undefined {
  const trimmed = segment.trimEnd();
  if (!trimmed.endsWith(".")) return undefined;
  const token = trimmed.slice(0, -1).split(/\s+/).pop() ?? "";
  return token.replace(/^[("'“‘[]+/, "").toLowerCase() || undefined;
}

function shouldMerge(previous: string, next: string): boolean {
  const nextStart = next.trimStart()[0];
  if (!nextStart) return false;
  if (/\p{Ll}/u.test(nextStart)) return true; // a sentence never starts with a lowercase letter
  const token = lastTokenBeforePeriod(previous);
  if (!token) return false;
  if (/^\p{L}$/u.test(token)) return true; // initials such as "J. K. Rowling"
  if (ALWAYS_MERGE.has(token)) return true;
  if (MERGE_BEFORE_NUMBER.has(token) && /\d/.test(nextStart)) return true;
  return false;
}

/** Splits one paragraph into sentences, tolerant of abbreviations and initials. */
export function splitSentences(paragraph: string, lang: string = "en"): string[] {
  const text = prepare(paragraph);
  if (!text) return [];
  const merged: string[] = [];
  for (const raw of segmentRaw(text, lang)) {
    const previous = merged[merged.length - 1];
    if (previous !== undefined && shouldMerge(previous, raw)) merged[merged.length - 1] = `${previous.trimEnd()} ${raw.trimStart()}`;
    else merged.push(raw);
  }
  return merged.map((sentence) => sentence.trim()).filter((sentence) => sentence.length > 0);
}

function normalizeToken(token: string): string {
  return token
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/^'+|'+$/g, "")
    .replace(/'s$/, "");
}

/** Lower-cased word tokens; punctuation dropped, numbers kept. */
export function tokenize(text: string, lang: string = "en"): string[] {
  const segmenter = getSegmenter(lang, "word");
  const raw = segmenter
    ? Array.from(segmenter.segment(text))
        .filter((part) => part.isWordLike)
        .map((part) => part.segment)
    : (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu) ?? []);
  return raw.map(normalizeToken).filter((token) => token.length > 1 || /\d/.test(token));
}

const undouble = (word: string) => (/([bdfgklmnprt])\1$/.test(word) ? word.slice(0, -1) : word);

/** A deliberately small suffix stripper. Consistency matters more than linguistic accuracy here. */
export function stem(word: string, lang: SupportedLanguage): string {
  if (lang !== "en" || word.length <= 3 || /\d/.test(word)) return word;
  if (word.endsWith("ies") && word.length > 4) return word.slice(0, -3) + "y";
  if (word.endsWith("sses")) return word.slice(0, -2);
  if (word.endsWith("ness") && word.length > 6) return word.slice(0, -4);
  if (word.endsWith("ing") && word.length > 5) return undouble(word.slice(0, -3));
  if (word.endsWith("ed") && word.length > 4) return undouble(word.slice(0, -2));
  if (word.endsWith("ly") && word.length > 5) return word.slice(0, -2);
  if (word.endsWith("es") && word.length > 4 && /([sxz]|[cs]h)es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("s") && !/(ss|us|is)$/.test(word)) return word.slice(0, -1);
  return word;
}

/** Tokens that carry meaning: stopwords removed and stemmed. */
export function contentTokens(text: string, lang: SupportedLanguage): string[] {
  return tokenize(text, lang)
    .filter((token) => !isStopword(token, lang))
    .map((token) => stem(token, lang));
}
