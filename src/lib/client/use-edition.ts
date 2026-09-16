import { useEffect, useState, useSyncExternalStore } from "react";
import type { FeedConfig, NewzpageConfig } from "@/lib/config-schema";
import { storyFrom, type Section } from "@/lib/edition/types";
import { fnv1a } from "@/lib/util/hash";
import { createLimiter } from "@/lib/util/limit";
import { displayHost } from "@/lib/util/text";
import { api } from "./api";
import { readReaderStats, recordEdition, type ReaderStats } from "./reader-stats";
import { browserStorage, MemoryStorage } from "./storage";
import { SummaryCache } from "./summary-cache";

export interface SectionState {
  feed: FeedConfig;
  name: string;
  status: "loading" | "done";
  section?: Section;
  /** Stories summarised so far, for the skeleton's progress line. */
  done: number;
  total: number;
}

export interface EditionState {
  sections: SectionState[];
  printedAt?: Date;
  /** This reader's edition count, updated once the whole edition is in. */
  reader?: ReaderStats;
}

const EMPTY: EditionState = { sections: [] };

/**
 * Composes the edition in the browser: feeds come from the server, analyses from this browser's cache when
 * it has them and from the server otherwise, and everything is planned and typeset client-side. A store
 * rather than component state, so the work can be started from an effect and followed by subscription.
 */
export class EditionRunner {
  private state: EditionState = EMPTY;
  private readonly listeners = new Set<() => void>();
  private controller?: AbortController;
  private cache?: SummaryCache;

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly getSnapshot = () => this.state;

  private set(patch: Partial<EditionState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  private updateSection(index: number, patch: Partial<SectionState>) {
    this.set({ sections: this.state.sections.map((state, i) => (i === index ? { ...state, ...patch } : state)) });
    if (this.state.sections.every((state) => state.status === "done")) this.recordEdition();
  }

  /** An edition is new when the wires brought other stories than last time; a plain reload is not. */
  private recordEdition() {
    const sections = this.state.sections;
    const stories = sections.flatMap((state) => state.section?.stories ?? []);
    if (stories.length === 0) return;
    const fingerprint = fnv1a(sections.map((state) => `${state.feed.url}:${(state.section?.stories ?? []).map((story) => story.id).join(",")}`).join("|")).toString(36);
    this.set({ reader: recordEdition(fingerprint) });
  }

  stop() {
    this.controller?.abort();
    this.controller = undefined;
  }

  start(config: NewzpageConfig) {
    this.stop();
    const controller = new AbortController();
    this.controller = controller;
    const signal = controller.signal;
    this.cache ??= new SummaryCache(browserStorage() ?? new MemoryStorage());
    const store = this.cache;
    const limit = createLimiter(6);

    this.set({
      printedAt: new Date(),
      reader: readReaderStats(),
      sections: config.feeds.map((feed) => ({ feed, name: feed.name ?? displayHost(feed.url) ?? feed.url, status: "loading", done: 0, total: 0 })),
    });

    config.feeds.forEach(async (feed, index) => {
      const fallbackName = feed.name ?? displayHost(feed.url) ?? feed.url;
      try {
        const response = await api.feed(feed.url, feed.limit ?? config.itemsPerFeed, signal);
        if (signal.aborted) return;
        const name = feed.name ?? response.title;
        this.updateSection(index, { name, total: response.items.length });
        let done = 0;
        const stories = await Promise.all(
          response.items.map((item) =>
            limit(async () => {
              let article = item.link ? store.get(item.link) : undefined;
              if (!article && item.link) {
                try {
                  article = await api.article(item.link, feed.url, item.title, signal);
                  store.set(article);
                } catch {
                  // the story is printed with a placeholder line
                }
              }
              if (signal.aborted) return storyFrom(item, article);
              done++;
              this.updateSection(index, { done });
              return storyFrom(item, article);
            }),
          ),
        );
        if (signal.aborted) return;
        store.flush();
        this.updateSection(index, {
          status: "done",
          section: { name, url: feed.url, link: response.link, fetchedAt: response.fetchedAt, stale: response.stale, stories },
        });
      } catch (error) {
        if (signal.aborted) return;
        this.updateSection(index, {
          status: "done",
          section: { name: fallbackName, url: feed.url, fetchedAt: Date.now(), stale: false, error: (error as Error).message, stories: [] },
        });
      }
    });
  }
}

const serverSnapshot = () => EMPTY;

export function useEdition(config: NewzpageConfig | undefined): EditionState {
  const [runner] = useState(() => new EditionRunner());
  const state = useSyncExternalStore(runner.subscribe, runner.getSnapshot, serverSnapshot);

  useEffect(() => {
    if (!config) return;
    runner.start(config);
    return () => runner.stop();
  }, [config, runner]);

  return state;
}
