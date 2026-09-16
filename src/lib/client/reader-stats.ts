import { browserStorage, readJson, writeJson, type StorageLike } from "./storage";

export const READER_KEY = "newzpage.reader.v1";

/** What this browser knows about its reader: when they first came, and how many editions were printed. */
export interface ReaderStats {
  /** ISO date of the first edition printed here. */
  since: string;
  /** Editions printed in this browser, this one included. */
  editions: number;
  /** Fingerprint of the stories in the last edition; a reload that brings nothing new is the same edition. */
  fingerprint?: string;
}

function valid(value: unknown): value is ReaderStats {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ReaderStats).since === "string" &&
    !Number.isNaN(Date.parse((value as ReaderStats).since)) &&
    Number.isInteger((value as ReaderStats).editions) &&
    (value as ReaderStats).editions >= 0
  );
}

export function readReaderStats(storage: StorageLike | undefined = browserStorage()): ReaderStats | undefined {
  const raw = readJson<unknown>(storage, READER_KEY);
  return valid(raw) ? raw : undefined;
}

/**
 * Counts an edition, identified by a fingerprint of its stories: the record starts on a first visit, the
 * count goes up when the fingerprint differs from the last one, and stays put when the wires brought
 * nothing new. Returns the figures to print.
 */
export function recordEdition(fingerprint: string, storage: StorageLike | undefined = browserStorage(), now = new Date()): ReaderStats {
  const current = readReaderStats(storage);
  if (current && current.fingerprint === fingerprint) return current;
  const next: ReaderStats = current ? { ...current, editions: current.editions + 1, fingerprint } : { since: now.toISOString(), editions: 1, fingerprint };
  writeJson(storage, READER_KEY, next);
  return next;
}

/** Volumes are counted in months since the first edition: a new volume opens on that day of each month. */
export function volumeOf(stats: ReaderStats, now = new Date()): number {
  const since = new Date(stats.since);
  let months = (now.getUTCFullYear() - since.getUTCFullYear()) * 12 + (now.getUTCMonth() - since.getUTCMonth());
  if (now.getUTCDate() < since.getUTCDate()) months -= 1;
  return Math.max(1, months + 1);
}
