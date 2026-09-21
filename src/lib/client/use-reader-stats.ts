import { useSyncExternalStore } from "react";
import { READER_KEY, readReaderStats, type ReaderStats } from "./reader-stats";
import { browserStorage, type StorageLike } from "./storage";

let storage: StorageLike | undefined | null = null;
let cachedRaw: string | null | undefined;
let cached: ReaderStats | undefined;

/** Stable while the stored text is unchanged, as useSyncExternalStore requires. */
function snapshot(): ReaderStats | undefined {
  if (storage === null) storage = browserStorage();
  let raw: string | null = null;
  try {
    raw = storage?.getItem(READER_KEY) ?? null;
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = readReaderStats(storage);
  }
  return cached;
}

const unknown = () => undefined;
const subscribe = () => () => {};

/** The reader's record for pages that print no edition of their own and so never change it. */
export function useReaderStats(): ReaderStats | undefined {
  return useSyncExternalStore(subscribe, snapshot, unknown);
}
