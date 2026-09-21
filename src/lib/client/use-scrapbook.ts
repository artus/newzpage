import { useSyncExternalStore } from "react";
import { CLIPPINGS_KEY, Scrapbook, type Clipping } from "./scrapbook";
import { browserStorage } from "./storage";

let instance: Scrapbook | undefined;
let followingOtherTabs = false;

/** This browser's one scrapbook, created on first use; other tabs' changes are followed through storage events. */
export function scrapbook(): Scrapbook {
  if (!instance) instance = new Scrapbook(browserStorage());
  if (!followingOtherTabs && typeof window !== "undefined") {
    followingOtherTabs = true;
    window.addEventListener("storage", (event) => {
      if (event.key === null || event.key === CLIPPINGS_KEY) instance?.reload();
    });
  }
  return instance;
}

const subscribe = (listener: () => void) => scrapbook().subscribe(listener);
const NONE: Clipping[] = [];
const noClippings = () => NONE;
const notClipped = () => false;
const nothingRemoved = () => undefined;

/** Every clipping, newest first; empty on the server and until hydration. */
export function useClippings(): Clipping[] {
  return useSyncExternalStore(subscribe, () => scrapbook().list(), noClippings);
}

export function useClipped(id: string): boolean {
  return useSyncExternalStore(subscribe, () => scrapbook().has(id), notClipped);
}

export function useLastRemoved(): Clipping | undefined {
  return useSyncExternalStore(subscribe, () => scrapbook().lastRemoved(), nothingRemoved);
}
