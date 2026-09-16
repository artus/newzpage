import { collapseWhitespace, countWords } from "@/lib/util/text";
import { contentTokens, splitSentences, tokenize } from "./segment";
import { detectLanguage } from "./stopwords";
import { rankSentences } from "./textrank";

export { compose, type ComposeOptions, type Composed } from "./compose";
export { SUMMARIZER_VERSION, type Analysis, type AnalyzedSentence } from "./types";
import { SUMMARIZER_VERSION, type Analysis } from "./types";

export interface AnalyzeOptions {
  title?: string;
  /** Declared language, e.g. from `<html lang>` or the feed. */
  langHint?: string;
  /** Sentences beyond this are ignored; long reads are summarised from their first part. */
  maxInputSentences?: number;
  /** How many ranked sentences to keep in the analysis (24 keeps browser storage small). */
  keep?: number;
}

const BOILERPLATE =
  /\b(cookies?|subscribe|subscription|newsletter|sign (up|in)|log ?in|click here|read more|advertisement|all rights reserved|privacy policy|terms of (use|service)|follow us|share this|related:|photo(graph)?:|image:|credit:|getty images|copyright|©|javascript|your browser|enable|download the app|listen to this article|min read|continue reading|this article was|originally published|affiliate)\b/i;

const dropFirst = (text: string, char: string) => {
  const at = text.indexOf(char);
  return at < 0 ? text : text.slice(0, at) + text.slice(at + 1);
};

const dropLast = (text: string, char: string) => {
  const at = text.lastIndexOf(char);
  return at < 0 ? text : text.slice(0, at) + text.slice(at + 1);
};

/** Drops the dangling half of a quotation that was split across sentences. */
function balanceQuotes(text: string): string {
  let result = text;
  const count = (char: string) => result.split(char).length - 1;
  const opening = count("“");
  const closing = count("”");
  if (opening > closing) result = dropFirst(result, "“");
  else if (closing > opening) result = dropLast(result, "”");
  if (count('"') % 2 === 1) result = result.startsWith('"') ? dropFirst(result, '"') : dropLast(result, '"');
  return collapseWhitespace(result);
}

function cleanSentence(text: string): string {
  return balanceQuotes(
    collapseWhitespace(
      text
        .replace(/\[(\d+|[a-z]|citation needed|edit)\]/gi, "")
        .replace(/\s+([,.;:!?])/g, "$1")
        .replace(/^[-–—•*]+\s*/, ""),
    ),
  );
}

const AUTHOR_BIO =
  /^(?:\S+\s+){1,3}is (?:an?|the) (?:\S+\s+){0,3}(editor|reporter|writer|correspondent|journalist|columnist|critic|contributor|analyst|blogger|producer)\b/i;

const startsLikeASentence = (text: string) => /^[\p{Lu}\p{N}"“‘'(\[¿¡]/u.test(text);

/**
 * An author bio is a paragraph of its own; when its first sentence gives it away, every sentence in it goes.
 * The same holds for a paragraph that starts mid-sentence: its opening words sat in another element.
 */
function isJunkParagraph(firstSentence: string): boolean {
  return !startsLikeASentence(firstSentence) || AUTHOR_BIO.test(firstSentence);
}

function isJunk(text: string, words: number): boolean {
  if (words < 4 || words > 70) return true;
  if (!startsLikeASentence(text)) return true; // fragments never start a sentence
  if (/https?:\/\/|www\.|@\w+\.\w{2,}/i.test(text)) return true;
  if (BOILERPLATE.test(text) || AUTHOR_BIO.test(text)) return true;
  if (/[{}<>|]/.test(text)) return true;
  if (!/[.!?…]["”’')\]]*$/.test(text)) return true;
  const letters = (text.match(/\p{L}/gu) ?? []).length;
  if (letters / text.length < 0.6) return true;
  const upper = (text.match(/\p{Lu}/gu) ?? []).length;
  if (upper / letters > 0.5) return true;
  return false;
}

/** Runs the whole pipeline: segmentation, junk removal, language detection and TextRank scoring. */
export function analyze(paragraphs: string[], options: AnalyzeOptions = {}): Analysis {
  const maxInput = options.maxInputSentences ?? 400;
  const keep = options.keep ?? 24;

  const sample = paragraphs.join(" ").slice(0, 20_000);
  const lang = detectLanguage(tokenize(sample), options.langHint);

  const candidates: Array<{ text: string; p: number }> = [];
  const seen = new Set<string>();
  paragraphs.forEach((paragraph, p) => {
    const sentences = splitSentences(paragraph, lang).map(cleanSentence);
    if (sentences.length > 0 && isJunkParagraph(sentences[0])) return;
    for (const text of sentences) {
      const key = text.toLowerCase();
      if (seen.has(key) || isJunk(text, countWords(text))) continue;
      seen.add(key);
      candidates.push({ text, p });
    }
  });

  const titleTokens = options.title ? contentTokens(options.title, lang) : [];
  const titleKey = new Set(titleTokens);
  const input = candidates.slice(0, maxInput).map((candidate) => ({
    ...candidate,
    words: countWords(candidate.text),
    tokens: contentTokens(candidate.text, lang),
  }));
  // A repeated headline or deck is not a summary sentence.
  const withoutTitle = input.filter((sentence) => {
    if (titleKey.size < 3) return true;
    const own = new Set(sentence.tokens);
    let shared = 0;
    for (const term of titleKey) if (own.has(term)) shared++;
    return !(shared / titleKey.size >= 0.9 && own.size <= titleKey.size + 3);
  });

  const totalWords = withoutTitle.reduce((sum, sentence) => sum + sentence.words, 0);
  const { scores, pick } = rankSentences(withoutTitle, { lang, titleTokens });

  const kept = new Set(
    scores
      .map((score, index) => ({ score, index }))
      .sort((a, b) => b.score - a.score)
      .slice(0, keep)
      .map((entry) => entry.index),
  );

  return {
    version: SUMMARIZER_VERSION,
    lang,
    sentences: withoutTitle
      .map((sentence, index) => ({ i: index, p: sentence.p, text: sentence.text, words: sentence.words, score: scores[index] }))
      .filter((sentence) => kept.has(sentence.i))
      .map((sentence) => ({ ...sentence, score: Number(sentence.score.toFixed(4)) })),
    pick: pick.filter((index) => kept.has(index)),
    totalWords,
    totalSentences: withoutTitle.length,
  };
}
