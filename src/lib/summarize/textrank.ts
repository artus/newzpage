import { ANAPHORIC_STARTS, type SupportedLanguage } from "./stopwords";

export interface RankableSentence {
  text: string;
  tokens: string[];
  words: number;
}

export interface RankOptions {
  lang: SupportedLanguage;
  titleTokens?: string[];
  /** Damping factor of the PageRank iteration. */
  damping?: number;
  /** Trade-off between relevance and novelty when ordering picks (1 = relevance only). */
  lambda?: number;
  /** How many of the best sentences take part in the pick ordering. */
  pickPoolSize?: number;
}

export interface RankResult {
  /** Score per sentence in input order, normalised so the best sentence scores 1. */
  scores: number[];
  /** Sentence indices in the order they should be picked: relevant first, redundant ones pushed back. */
  pick: number[];
}

type Vector = Map<string, number>;

function buildVectors(sentences: RankableSentence[]): Vector[] {
  const n = sentences.length;
  const documentFrequency = new Map<string, number>();
  for (const sentence of sentences) {
    for (const term of new Set(sentence.tokens)) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }
  return sentences.map((sentence) => {
    const counts = new Map<string, number>();
    for (const term of sentence.tokens) counts.set(term, (counts.get(term) ?? 0) + 1);
    const vector: Vector = new Map();
    let norm = 0;
    for (const [term, count] of counts) {
      const idf = Math.log((n + 1) / ((documentFrequency.get(term) ?? 0) + 1)) + 1;
      const weight = (1 + Math.log(count)) * idf;
      vector.set(term, weight);
      norm += weight * weight;
    }
    norm = Math.sqrt(norm);
    if (norm > 0) for (const [term, weight] of vector) vector.set(term, weight / norm);
    return vector;
  });
}

function cosine(a: Vector, b: Vector): number {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [term, weight] of small) {
    const other = large.get(term);
    if (other) dot += weight * other;
  }
  return dot;
}

function pageRank(similarity: Float64Array, n: number, damping: number): Float64Array {
  const rowSums = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) if (i !== j) sum += similarity[i * n + j];
    rowSums[i] = sum;
  }
  let scores = new Float64Array(n).fill(1 / n);
  for (let iteration = 0; iteration < 100; iteration++) {
    const next = new Float64Array(n);
    let delta = 0;
    for (let i = 0; i < n; i++) {
      let incoming = 0;
      for (let j = 0; j < n; j++) {
        if (i === j || rowSums[j] === 0) continue;
        incoming += (similarity[j * n + i] / rowSums[j]) * scores[j];
      }
      next[i] = (1 - damping) / n + damping * incoming;
      delta = Math.max(delta, Math.abs(next[i] - scores[i]));
    }
    scores = next;
    if (delta < 1e-6) break;
  }
  return scores;
}

function firstWord(text: string): string {
  return (text.match(/^\W*(\p{L}+)/u)?.[1] ?? "").toLowerCase();
}

/** Multiplicative priors that encode what makes a sentence a good stand-alone summary sentence. */
function prior(sentence: RankableSentence, index: number, n: number, options: RankOptions): number {
  let weight = 1;

  // News is written top-down: the lead paragraph carries the gist.
  const position = n > 1 ? index / (n - 1) : 0;
  weight *= 1 + 0.45 * Math.exp(-index / 5) + 0.15 * (1 - position);

  // Sentences that share vocabulary with the headline are on topic.
  const title = options.titleTokens ?? [];
  if (title.length >= 2) {
    const own = new Set(sentence.tokens);
    let shared = 0;
    for (const term of new Set(title)) if (own.has(term)) shared++;
    weight *= 1 + 0.6 * (shared / new Set(title).size);
  }

  // Very short sentences carry little; very long ones eat the word budget.
  const words = sentence.words;
  weight *= words < 6 ? 0.4 : words < 10 ? 0.85 : words <= 32 ? 1 : words <= 45 ? 0.9 : 0.7;

  // "He said…" or "This means…" reads badly without the sentence it refers to.
  if (ANAPHORIC_STARTS[options.lang].has(firstWord(sentence.text))) weight *= 0.8;

  if (/\?["”’)]*$/.test(sentence.text)) weight *= 0.6;
  if (/^["“‘']/.test(sentence.text)) weight *= 0.9;

  return weight;
}

export function rankSentences(sentences: RankableSentence[], options: RankOptions): RankResult {
  const n = sentences.length;
  if (n === 0) return { scores: [], pick: [] };
  if (n === 1) return { scores: [1], pick: [0] };

  const vectors = buildVectors(sentences);
  const similarity = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const value = cosine(vectors[i], vectors[j]);
      similarity[i * n + j] = value;
      similarity[j * n + i] = value;
    }
  }

  const centrality = pageRank(similarity, n, options.damping ?? 0.85);
  const raw = Array.from(centrality, (value, index) => value * prior(sentences[index], index, n, options));
  const max = Math.max(...raw);
  const scores = raw.map((value) => (max > 0 ? value / max : 0));

  // Maximal marginal relevance: order candidates so that each next pick adds something new.
  const lambda = options.lambda ?? 0.75;
  const poolSize = options.pickPoolSize ?? 60;
  const remaining = scores
    .map((score, index) => ({ score, index }))
    .sort((a, b) => b.score - a.score)
    .slice(0, poolSize)
    .map((entry) => entry.index);
  const pick: number[] = [];
  while (remaining.length > 0) {
    let bestAt = 0;
    let bestValue = -Infinity;
    for (let candidate = 0; candidate < remaining.length; candidate++) {
      const index = remaining[candidate];
      let redundancy = 0;
      for (const chosen of pick) redundancy = Math.max(redundancy, similarity[index * n + chosen]);
      const value = lambda * scores[index] - (1 - lambda) * redundancy;
      if (value > bestValue) {
        bestValue = value;
        bestAt = candidate;
      }
    }
    pick.push(remaining[bestAt]);
    remaining.splice(bestAt, 1);
  }

  return { scores, pick };
}
