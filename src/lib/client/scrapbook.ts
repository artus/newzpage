import { hasCopy, type Story } from "@/lib/edition/types";
import type { Analysis } from "@/lib/summarize/types";
import { readJson, writeJson, type StorageLike } from "./storage";

export const CLIPPINGS_KEY = "newzpage.clippings.v1";
/** Sentences kept per clipping: more than the longest summary the page prints (sixteen), so it fills any slot. */
export const KEPT_SENTENCES = 24;
/** A scrapbook, not an archive: enough for a year of clipping something most days. */
export const MAX_CLIPPINGS = 300;

export interface Wire {
  name: string;
  url: string;
}

export interface Clipping {
  /** The story as printed, with the sentences and photograph it needs; it outlives the rolling summary cache. */
  story: Story;
  wire: Wire;
  /** ISO time of the clipping. */
  clippedAt: string;
}

export interface ClippingsFile {
  newzpage: "clippings";
  exportedAt: string;
  clippings: Clipping[];
}

export type ScrapbookResult = { ok: true } | { ok: false; reason: string };

/** Keeps the sentences the paper can print and drops the rest: a clipping is a cutting, not the whole article. */
export function trimAnalysis(analysis: Analysis | null, keep = KEPT_SENTENCES): Analysis | null {
  if (!analysis) return null;
  const pick = analysis.pick.slice(0, keep);
  const wanted = new Set(pick);
  return { ...analysis, pick, sentences: analysis.sentences.filter((sentence) => wanted.has(sentence.i)) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validClipping(value: unknown): value is Clipping {
  if (!isRecord(value) || !isRecord(value.story) || !isRecord(value.wire)) return false;
  return (
    typeof value.story.id === "string" &&
    typeof value.story.title === "string" &&
    typeof value.wire.name === "string" &&
    typeof value.wire.url === "string" &&
    typeof value.clippedAt === "string" &&
    !Number.isNaN(Date.parse(value.clippedAt))
  );
}

const newestFirst = (a: Clipping, b: Clipping) => Date.parse(b.clippedAt) - Date.parse(a.clippedAt);

/**
 * The reader's clippings, kept in this browser under one key, newest first. A cutting carries its own copy of
 * the summary and photograph, so it stays readable after the rolling cache has forgotten the article. Deliberate
 * saves are never dropped on their own: when the book is full or the browser refuses, the reader is told.
 */
export class Scrapbook {
  private clippings: Clipping[] | undefined;
  private removed: Clipping | undefined;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly storage: StorageLike | undefined) {}

  private load(): Clipping[] {
    if (!this.clippings) {
      const raw = readJson<unknown>(this.storage, CLIPPINGS_KEY);
      this.clippings = Array.isArray(raw) ? raw.filter(validClipping) : [];
    }
    return this.clippings;
  }

  /** The same array while nothing changed, as useSyncExternalStore requires. */
  list(): Clipping[] {
    return this.load();
  }

  has(id: string): boolean {
    return this.load().some((clipping) => clipping.story.id === id);
  }

  /** The clipping let go most recently, until the book changes again. */
  lastRemoved(): Clipping | undefined {
    return this.removed;
  }

  add(story: Story, wire: Wire, now = new Date()): ScrapbookResult {
    if (!hasCopy(story)) return { ok: false, reason: "There is no copy to clip." };
    const current = this.load();
    if (current.some((clipping) => clipping.story.id === story.id)) return { ok: true };
    if (current.length >= MAX_CLIPPINGS) return { ok: false, reason: `The scrapbook holds ${MAX_CLIPPINGS} clippings; let some go first.` };
    const clipping: Clipping = { story: { ...story, analysis: trimAnalysis(story.analysis) }, wire, clippedAt: now.toISOString() };
    return this.write([clipping, ...current], undefined);
  }

  remove(id: string): ScrapbookResult {
    const current = this.load();
    const clipping = current.find((entry) => entry.story.id === id);
    if (!clipping) return { ok: true };
    return this.write(
      current.filter((entry) => entry !== clipping),
      clipping,
    );
  }

  /** Puts the clipping let go most recently back where it was. */
  undo(): ScrapbookResult {
    const clipping = this.removed;
    if (!clipping) return { ok: true };
    const current = this.load();
    if (current.some((entry) => entry.story.id === clipping.story.id)) {
      this.removed = undefined;
      this.notify();
      return { ok: true };
    }
    return this.write([...current, clipping].sort(newestFirst), undefined);
  }

  clear(): ScrapbookResult {
    return this.write([], undefined);
  }

  /** Merges a clippings file into the book; clippings already here are kept as they are. Throws on a foreign file. */
  import(raw: unknown): { added: number; total: number } {
    const entries = Array.isArray(raw) ? raw : isRecord(raw) && raw.newzpage === "clippings" && Array.isArray(raw.clippings) ? raw.clippings : undefined;
    if (!entries) throw new Error("it is not a Newzpage clippings file");
    const valid = entries.filter(validClipping);
    if (valid.length === 0 && entries.length > 0) throw new Error("none of its clippings could be read");
    const current = this.load();
    const known = new Set(current.map((clipping) => clipping.story.id));
    const fresh: Clipping[] = [];
    for (const clipping of valid) {
      if (known.has(clipping.story.id)) continue;
      known.add(clipping.story.id);
      fresh.push(clipping);
    }
    const added = fresh.slice(0, Math.max(0, MAX_CLIPPINGS - current.length));
    if (added.length > 0) {
      const result = this.write([...current, ...added].sort(newestFirst), undefined);
      if (!result.ok) throw new Error(result.reason);
    }
    return { added: added.length, total: this.load().length };
  }

  export(now = new Date()): ClippingsFile {
    return { newzpage: "clippings", exportedAt: now.toISOString(), clippings: this.load() };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Forgets what was read so the storage is read again: for changes made in another tab. */
  reload(): void {
    this.clippings = undefined;
    this.removed = undefined;
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  private write(next: Clipping[], removed: Clipping | undefined): ScrapbookResult {
    if (!writeJson(this.storage, CLIPPINGS_KEY, next)) {
      return {
        ok: false,
        reason: this.storage ? "This browser refuses to keep more clippings; its storage is full." : "This browser keeps no clippings; its storage is disabled.",
      };
    }
    this.clippings = next;
    this.removed = removed;
    this.notify();
    return { ok: true };
  }
}
