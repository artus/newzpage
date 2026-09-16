import entries from "./directory.json";

export interface DirectoryEntry {
  name: string;
  url: string;
  site: string;
  description: string;
  language: string;
  category: string;
  tags: string[];
}

export const DIRECTORY: DirectoryEntry[] = entries as DirectoryEntry[];

export const CATEGORIES: string[] = [...new Set(DIRECTORY.map((entry) => entry.category))].sort();

const tokenize = (text: string) => text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((token) => token.length > 1);

interface Indexed {
  entry: DirectoryEntry;
  fields: Array<{ words: string[]; weight: number }>;
}

const INDEX: Indexed[] = DIRECTORY.map((entry) => ({
  entry,
  fields: [
    { words: tokenize(entry.name), weight: 5 },
    { words: [...tokenize(entry.site), ...tokenize(entry.category), ...entry.tags.flatMap(tokenize)], weight: 3 },
    { words: tokenize(entry.description), weight: 1 },
  ],
}));

function matchWeight(token: string, field: { words: string[]; weight: number }): number {
  let best = 0;
  for (const word of field.words) {
    if (word === token) return field.weight;
    if (token.length >= 3 && word.startsWith(token)) best = Math.max(best, field.weight * 0.6);
  }
  return best;
}

/**
 * Ranks the bundled directory against free-text search terms. Every term must match somewhere (name, site,
 * category, tags or description); names and tags count more than descriptions, prefixes count a little less.
 */
export function searchDirectory(query: string, limit = 12): DirectoryEntry[] {
  const tokens = [...new Set(tokenize(query))];
  if (tokens.length === 0) return [];

  const scored: Array<{ entry: DirectoryEntry; score: number }> = [];
  for (const { entry, fields } of INDEX) {
    let score = 0;
    let matched = 0;
    for (const token of tokens) {
      const weight = Math.max(...fields.map((field) => matchWeight(token, field)));
      if (weight > 0) {
        matched++;
        score += weight;
      }
    }
    if (matched === tokens.length) scored.push({ entry, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name))
    .slice(0, limit)
    .map((item) => item.entry);
}
