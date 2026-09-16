/** Bump when the algorithm changes so cached analyses (in readers' browsers) are recomputed. */
export const SUMMARIZER_VERSION = 3;

export interface AnalyzedSentence {
  /** Position in the article (after junk removal). */
  i: number;
  /** Paragraph the sentence came from. */
  p: number;
  text: string;
  words: number;
  /** 0..1, best sentence scores 1. */
  score: number;
}

/** Everything a caller needs to compose a summary of any length without touching the article again. */
export interface Analysis {
  version: number;
  lang: string;
  sentences: AnalyzedSentence[];
  /** Indices (`i`) in pick order: most relevant first, redundant sentences pushed back. */
  pick: number[];
  totalWords: number;
  totalSentences: number;
}
