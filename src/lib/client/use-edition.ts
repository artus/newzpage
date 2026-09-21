import { useEffect, useState, useSyncExternalStore } from "react";
import { CONFIG_DEFAULTS, type FeedConfig, type NewzpageConfig } from "@/lib/config-schema";
import { storyFrom, type Section, type Story } from "@/lib/edition/types";
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
  /** The stories in the order they were loaded: the first batch is the edition, later ones came on request. */
  batches: Story[][];
  /** Items requested from the feed so far. */
  requested: number;
  loadingMore: boolean;
  /** What the last "more" request came back with, when it brought nothing new. */
  moreNote?: string;
}

export interface EditionState {
  sections: SectionState[];
  printedAt?: Date;
  /** This reader's edition count, updated once the whole edition is in. */
  reader?: ReaderStats;
}

const EMPTY: EditionState = { sections: [] };

export interface EditionOptions {
  /** Count the composed edition in the reader's record: the front page does, a single wire read on the side does not. */
  record?: boolean;
}

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
  private limit = createLimiter(6);

  constructor(private readonly options: EditionOptions = {}) {}

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
    if (this.options.record !== false && this.state.sections.every((state) => state.status === "done")) this.recordEdition();
  }

  /** An edition is new when the wires brought other stories than last time; a plain reload is not. */
  private recordEdition() {
    const sections = this.state.sections;
    if (sections.every((state) => (state.batches[0]?.length ?? 0) === 0)) return;
    const fingerprint = fnv1a(sections.map((state) => `${state.feed.url}:${(state.batches[0] ?? []).map((story) => story.id).join(",")}`).join("|")).toString(36);
    this.set({ reader: recordEdition(fingerprint) });
  }

  /**
   * Fetches the feed's items and the analyses of the wanted ones, through the browser cache. With a list of
   * known ids only the items that follow the last known one are taken: further down the wire, never newer.
   */
  private async loadStories(
    feed: FeedConfig,
    requested: number,
    known: Set<string> | undefined,
    onProgress: (done: number, total: number, title: string) => void,
    signal: AbortSignal,
  ) {
    const response = await api.feed(feed.url, requested, signal);
    let items = response.items;
    if (known) {
      let last = -1;
      response.items.forEach((item, index) => {
        if (known.has(item.id)) last = index;
      });
      items = last < 0 ? [] : response.items.slice(last + 1).filter((item) => !known.has(item.id));
    }
    let done = 0;
    onProgress(0, items.length, response.title);
    const stories = await Promise.all(
      items.map((item) =>
        this.limit(async () => {
          let article = item.link ? this.cache?.get(item.link) : undefined;
          if (!article && item.link) {
            try {
              article = await api.article(item.link, feed.url, item.title, signal);
              this.cache?.set(article);
            } catch {
              // the story is printed with a placeholder line
            }
          }
          if (!signal.aborted) onProgress(++done, items.length, response.title);
          return { ...storyFrom(item, article), feedUrl: feed.url };
        }),
      ),
    );
    this.cache?.flush();
    return { response, stories };
  }

  /**
   * "More from this wire": asks the feed for a larger slice and typesets the items that come after the last
   * one already on the page, further down the wire. Items that arrived since the edition was printed are left
   * for the next edition. The button stays; when the wire has nothing older it says so.
   */
  async loadMore(index: number) {
    const state = this.state.sections[index];
    const controller = this.controller;
    if (!state || !controller || state.status !== "done" || state.loadingMore) return;
    const step = state.feed.limit ?? CONFIG_DEFAULTS.itemsPerFeed;
    const requested = Math.min(50, state.requested + step);
    this.updateSection(index, { loadingMore: true, moreNote: undefined });
    try {
      const known = new Set(state.batches.flat().map((story) => story.id));
      const { stories } = await this.loadStories(state.feed, requested, known, () => undefined, controller.signal);
      if (controller.signal.aborted) return;
      const current = this.state.sections[index];
      const batches = stories.length > 0 ? [...current.batches, stories] : current.batches;
      this.updateSection(index, {
        loadingMore: false,
        requested,
        batches,
        moreNote: stories.length === 0 ? "Nothing older on this wire." : undefined,
        section: current.section ? { ...current.section, stories: batches.flat() } : current.section,
      });
    } catch (error) {
      if (!controller.signal.aborted) this.updateSection(index, { loadingMore: false, moreNote: `The wire did not answer: ${(error as Error).message}` });
    }
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
    this.limit = createLimiter(6);

    this.set({
      printedAt: new Date(),
      reader: readReaderStats(),
      sections: config.feeds.map((feed) => ({
        feed,
        name: feed.name ?? displayHost(feed.url) ?? feed.url,
        status: "loading",
        done: 0,
        total: 0,
        batches: [],
        requested: 0,
        loadingMore: false,
      })),
    });

    config.feeds.forEach(async (feed, index) => {
      const fallbackName = feed.name ?? displayHost(feed.url) ?? feed.url;
      const requested = feed.limit ?? config.itemsPerFeed;
      try {
        const { response, stories } = await this.loadStories(
          feed,
          requested,
          undefined,
          (done, total, title) => {
            if (!signal.aborted) this.updateSection(index, { done, total, name: feed.name ?? title });
          },
          signal,
        );
        if (signal.aborted) return;
        const name = feed.name ?? response.title;
        this.updateSection(index, {
          status: "done",
          name,
          requested,
          batches: [stories],
          section: { name, url: feed.url, link: response.link, description: response.description, fetchedAt: response.fetchedAt, stale: response.stale, stories },
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

export function useEdition(config: NewzpageConfig | undefined, options?: EditionOptions): EditionState & { loadMore: (index: number) => void } {
  const [runner] = useState(() => new EditionRunner(options));
  const state = useSyncExternalStore(runner.subscribe, runner.getSnapshot, serverSnapshot);

  useEffect(() => {
    if (!config) return;
    runner.start(config);
    return () => runner.stop();
  }, [config, runner]);

  return { ...state, loadMore: (index) => void runner.loadMore(index) };
}
