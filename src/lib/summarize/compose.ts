import type { Analysis, AnalyzedSentence } from "./types";

export interface ComposeOptions {
  maxWords: number;
  maxSentences?: number;
  maxParagraphs?: number;
}

export interface Composed {
  paragraphs: string[];
  words: number;
  sentences: number;
  /** True when every available sentence was used; a bigger budget would add nothing. */
  exhausted: boolean;
  /** The smallest budget that prints one more sentence; undefined when exhausted. */
  nextWords?: number;
}

const EMPTY: Composed = { paragraphs: [], words: 0, sentences: 0, exhausted: true };

/** Picks the best sentences that fit the word budget and returns them in reading order. Pure; runs anywhere. */
export function compose(analysis: Analysis | null | undefined, options: ComposeOptions): Composed {
  if (!analysis || analysis.sentences.length === 0) return EMPTY;
  const maxSentences = options.maxSentences ?? 8;
  const maxParagraphs = options.maxParagraphs ?? 3;
  const byIndex = new Map(analysis.sentences.map((sentence) => [sentence.i, sentence]));

  const selected: AnalyzedSentence[] = [];
  const chosen = new Set<number>();
  let words = 0;
  for (const index of analysis.pick) {
    const sentence = byIndex.get(index);
    if (!sentence) continue;
    if (selected.length >= maxSentences) break;
    if (words + sentence.words > options.maxWords) {
      if (selected.length === 0 && sentence.words <= options.maxWords * 1.6) {
        selected.push(sentence);
        chosen.add(sentence.i);
        words += sentence.words;
        break;
      }
      continue;
    }
    selected.push(sentence);
    chosen.add(sentence.i);
    words += sentence.words;
    if (options.maxWords - words < 6) break;
  }
  if (selected.length === 0) return EMPTY;
  // The next sentence in pick order that was left out tells the fitter how much budget it takes to add copy.
  const nextIndex = analysis.pick.find((index) => !chosen.has(index) && byIndex.has(index));
  const nextWords = nextIndex === undefined ? undefined : words + byIndex.get(nextIndex)!.words;
  selected.sort((a, b) => a.i - b.i);

  const groups: AnalyzedSentence[][] = [];
  for (const sentence of selected) {
    const last = groups[groups.length - 1];
    if (last && last[0].p === sentence.p) last.push(sentence);
    else groups.push([sentence]);
  }
  while (groups.length > maxParagraphs) {
    let at = 0;
    let smallest = Infinity;
    for (let k = 0; k < groups.length - 1; k++) {
      const size = groups[k].length + groups[k + 1].length;
      if (size < smallest) {
        smallest = size;
        at = k;
      }
    }
    groups.splice(at, 2, [...groups[at], ...groups[at + 1]]);
  }

  return {
    paragraphs: groups.map((group) => group.map((sentence) => sentence.text).join(" ")),
    words,
    sentences: selected.length,
    exhausted: nextWords === undefined,
    nextWords,
  };
}
