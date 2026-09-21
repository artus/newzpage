"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/client/api";
import { browserStorage } from "@/lib/client/storage";
import { SummaryCache } from "@/lib/client/summary-cache";
import { useConfig } from "@/lib/client/use-config";
import { isHttpUrl, moveFeed, normalizeConfig, removeFeed, reorderFeeds, upsertFeed, type FeedConfig } from "@/lib/config-schema";
import { looksLikeOpml, parseOpml, toOpml } from "@/lib/feeds/opml";
import type { FeedProposal } from "@/lib/feeds/search";
import FeedSearch from "./feed-search";
import WireList from "./wire-list";

const positiveInt = (value: FormDataEntryValue | null): number | undefined => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? Math.min(number, 50) : undefined;
};

const text = (value: FormDataEntryValue | null): string | undefined => (typeof value === "string" && value.trim() ? value.trim() : undefined);

/** Everything here edits the configuration kept in this browser; nothing is sent to the server except searches and feed checks. */
export default function ComposingRoom() {
  const { config, ready, error: loadError, save } = useConfig();
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const [undo, setUndo] = useState<{ feed: FeedConfig; position: number }>();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  /** Bumped when the whole configuration is replaced, so uncontrolled fields pick up the new values. */
  const [generation, setGeneration] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
      if (pageTimer.current) clearTimeout(pageTimer.current);
    },
    [],
  );

  if (!ready || !config) {
    return (
      <main className="paper settings">
        <p className="settings__empty">Opening the composing room…</p>
      </main>
    );
  }

  const say = (message: string) => {
    setNotice(message);
    setError(undefined);
    setUndo(undefined);
  };
  const complain = (message: string) => {
    setError(message);
    setNotice(undefined);
  };
  const flashSaved = () => {
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 1500);
  };
  const setFeeds = (feeds: FeedConfig[]) => {
    save({ ...config, feeds });
    flashSaved();
  };

  const onReorder = (urls: string[]) => {
    const feeds = reorderFeeds(config.feeds, urls);
    if (feeds) setFeeds(feeds);
  };
  const onMove = (url: string, direction: "up" | "down") => setFeeds(moveFeed(config.feeds, url, direction));
  const onUpdate = (url: string, name: string | undefined, limit: number | undefined) => setFeeds(upsertFeed(config.feeds, { url, name, limit }));
  const onRemove = (url: string) => {
    const position = config.feeds.findIndex((feed) => feed.url === url);
    if (position < 0) return;
    const feed = config.feeds[position];
    setFeeds(removeFeed(config.feeds, url));
    setNotice(`${feed.name ?? feed.url} has been taken off the page.`);
    setError(undefined);
    setUndo({ feed, position });
  };
  const onRestore = () => {
    if (!undo) return;
    setFeeds(upsertFeed(config.feeds, undo.feed, undo.position));
    say(`${undo.feed.name ?? undo.feed.url} is back on the page.`);
  };

  const onAddProposal = (proposal: FeedProposal) => {
    if (config.feeds.some((feed) => feed.url === proposal.url)) return complain("That wire is already on the page.");
    setFeeds(upsertFeed(config.feeds, { url: proposal.url, name: proposal.name }));
    say(`${proposal.name} has been added to the page.`);
  };

  const onAddByAddress = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const url = text(data.get("url"));
    if (!isHttpUrl(url)) return complain(`"${url ?? ""}" is not an http(s) URL.`);
    if (config.feeds.some((feed) => feed.url === url)) return complain("That wire is already on the page.");
    setBusy(true);
    try {
      const checked = await api.feed(url, 1);
      const name = text(data.get("name")) ?? checked.title;
      setFeeds(upsertFeed(config.feeds, { url, name, limit: positiveInt(data.get("limit")) }));
      say(`${name} has been added to the page.`);
      form.reset();
    } catch (caught) {
      complain(`Could not read a feed at ${url}: ${(caught as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  /** Saves the page settings when they differ from what is stored; an empty title keeps the old one. */
  const commitPage = (form: HTMLFormElement) => {
    if (pageTimer.current) clearTimeout(pageTimer.current);
    pageTimer.current = null;
    const data = new FormData(form);
    const next = {
      ...config,
      title: text(data.get("title")) ?? config.title,
      tagline: typeof data.get("tagline") === "string" ? (data.get("tagline") as string).trim() : config.tagline,
    };
    if (next.title === config.title && next.tagline === config.tagline) return;
    save(next);
    flashSaved();
  };
  const schedulePage = (form: HTMLFormElement) => {
    if (pageTimer.current) clearTimeout(pageTimer.current);
    pageTimer.current = setTimeout(() => commitPage(form), 500);
  };
  const onSavePage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    commitPage(event.currentTarget);
  };

  const download = (name: string, contents: string, type: string) => {
    const href = URL.createObjectURL(new Blob([contents], { type }));
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(href);
  };
  const onExport = () => download("newzpage-wires.json", `${JSON.stringify(config, null, 2)}\n`, "application/json");
  /** OPML is what every other reader speaks: the wires in order, without the page settings. */
  const onExportOpml = () => download("newzpage-wires.opml", toOpml(config), "text/x-opml");

  /** A Newzpage file replaces the page; an OPML file, being a subscription list, joins its wires to it. */
  const onImport = async (file: File | undefined) => {
    if (!file) return;
    const contents = await file.text();
    if (looksLikeOpml(contents)) {
      try {
        const { feeds } = parseOpml(contents);
        const fresh = feeds.filter((feed) => !config.feeds.some((wire) => wire.url === feed.url));
        if (feeds.length === 0) return complain(`No feeds were found in ${file.name}.`);
        if (fresh.length > 0) setFeeds([...config.feeds, ...fresh]);
        const known = feeds.length - fresh.length;
        say(
          `${fresh.length} ${fresh.length === 1 ? "wire was" : "wires were"} added from ${file.name}` +
            (known > 0 ? `; ${known} ${known === 1 ? "was" : "were"} already on the page.` : "."),
        );
      } catch (caught) {
        complain(`${file.name} could not be read: ${(caught as Error).message}.`);
      }
      return;
    }
    try {
      const imported = normalizeConfig(JSON.parse(contents));
      save(imported);
      setGeneration((n) => n + 1);
      say(`${imported.feeds.length} wires were imported from ${file.name}.`);
    } catch (caught) {
      complain(`${file.name} is neither a Newzpage configuration nor an OPML file: ${(caught as Error).message}`);
    }
  };

  const onForgetSummaries = () => {
    const storage = browserStorage();
    if (!storage) return complain("This browser keeps no summaries to forget.");
    const cache = new SummaryCache(storage);
    const { entries } = cache.stats();
    cache.clear();
    say(entries === 0 ? "There were no cached summaries." : `${entries} cached ${entries === 1 ? "summary was" : "summaries were"} forgotten; the next edition is summarised afresh.`);
  };

  const onReset = async () => {
    const wires = config.feeds.length;
    const question =
      `Replace your ${wires} ${wires === 1 ? "wire" : "wires"} and page settings with the house defaults?\n\n` +
      "The configuration kept in this browser will be lost. Export it first if you want to keep a copy.";
    if (!window.confirm(question)) return;
    setBusy(true);
    try {
      const defaults = await api.defaults();
      save(defaults);
      setGeneration((n) => n + 1);
      say("The house defaults are back.");
    } catch (caught) {
      complain(`The house defaults could not be loaded: ${(caught as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const existing = new Set(config.feeds.map((feed) => feed.url));

  return (
    <main className="paper settings">
      <header className="settings__head">
        <p className="settings__kicker">
          <Link href="/">← Back to the front page</Link>
        </p>
        <h1 className="settings__title">The composing room</h1>
        <p className="settings__lede">
          Wires are printed in the order below. Changes are saved in this browser as you make them; export them to take them to another one.
        </p>
        <p className="settings__autosave" role="status" aria-live="polite">
          {saved ? "Saved" : "\u00a0"}
        </p>
      </header>

      {loadError ? <p className="settings__notice settings__notice--error">{loadError}</p> : null}
      {error ? (
        <p className="settings__notice settings__notice--error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <div className="settings__notice" role="status">
          <span>{notice}</span>
          {undo ? (
            <button type="button" className="button" onClick={onRestore}>
              Put it back
            </button>
          ) : null}
        </div>
      ) : null}

      <section className="settings__section" aria-labelledby="wires-heading">
        <h2 id="wires-heading">Wires</h2>
        {config.feeds.length === 0 ? <p className="settings__empty">No wires are connected. Find or add one below.</p> : null}
        <WireList
          key={`${generation}:${config.feeds.map((feed) => feed.url).join("|")}`}
          feeds={config.feeds}
          itemsPerFeed={config.itemsPerFeed}
          onReorder={onReorder}
          onMove={onMove}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
        <div className="settings__toolbar">
          <button type="button" className="button" onClick={onExport} title="The whole page as a Newzpage file: wires, story counts, title and tagline">
            Export wires
          </button>
          <button type="button" className="button" onClick={onExportOpml} title="The wires as OPML, for any other feed reader">
            Export OPML
          </button>
          <button type="button" className="button" onClick={() => fileInput.current?.click()} title="A Newzpage file replaces the page; an OPML file from another reader adds its feeds to it">
            Import wires
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json,.opml,.xml,text/xml,application/xml,text/x-opml"
            hidden
            onChange={(event) => {
              void onImport(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <button type="button" className="button" onClick={onReset} disabled={busy}>
            Back to the house defaults
          </button>
          <button type="button" className="button" onClick={onForgetSummaries} title="Drop every cached summary so the next edition summarises everything again">
            Forget cached summaries
          </button>
        </div>

        <FeedSearch existing={existing} onAdd={onAddProposal} />

        <form onSubmit={onAddByAddress} className="settings__form">
          <h3>Add a wire by address</h3>
          <label className="field field--url">
            <span>Feed URL</span>
            <input name="url" type="url" required placeholder="https://example.com/feed.xml" />
          </label>
          <label className="field field--name">
            <span>Name (optional)</span>
            <input name="name" placeholder="Taken from the feed" />
          </label>
          <label className="field field--limit">
            <span>Stories</span>
            <input name="limit" type="number" min={1} max={50} defaultValue={config.itemsPerFeed} />
          </label>
          <button type="submit" className="button button--primary" disabled={busy}>
            {busy ? "Checking…" : "Add"}
          </button>
        </form>
      </section>

      <section className="settings__section" aria-labelledby="page-heading">
        <h2 id="page-heading">Page</h2>
        <form key={generation} onSubmit={onSavePage} className="settings__form">
          <label className="field field--name">
            <span>Title</span>
            <input
              name="title"
              defaultValue={config.title}
              required
              onChange={(event) => schedulePage(event.currentTarget.form!)}
              onBlur={(event) => {
                if (!event.currentTarget.value.trim()) event.currentTarget.value = config.title;
                commitPage(event.currentTarget.form!);
              }}
            />
          </label>
          <label className="field field--url">
            <span>Tagline</span>
            <input name="tagline" defaultValue={config.tagline} onChange={(event) => schedulePage(event.currentTarget.form!)} onBlur={(event) => commitPage(event.currentTarget.form!)} />
          </label>
        </form>
      </section>
    </main>
  );
}
