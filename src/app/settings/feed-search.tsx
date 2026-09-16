"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/client/api";
import type { FeedProposal, FeedSearch as FeedSearchResult } from "@/lib/feeds/search";

/** Site addresses are probed on the server, which is slow, so they get a longer pause before searching. */
const looksLikeSite = (terms: string) => /^\S+\.\S+$/.test(terms);
const MIN_TERMS = 2;

interface FeedSearchProps {
  /** URLs already on the page. */
  existing: Set<string>;
  onAdd: (proposal: FeedProposal) => void;
}

const SOURCE_LABEL: Record<FeedProposal["source"], string> = {
  site: "found on the site",
  directory: "house directory",
  feedly: "via feedly.com",
};

function readers(count: number | undefined): string | undefined {
  if (!count) return undefined;
  return count >= 1000 ? `${(count / 1000).toFixed(count >= 10_000 ? 0 : 1)}k readers` : `${count} readers`;
}

export default function FeedSearch({ existing, onAdd }: FeedSearchProps) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<FeedSearchResult>();
  const [error, setError] = useState<string>();
  const cache = useRef(new Map<string, FeedSearchResult>());
  const latest = useRef(0);
  const controller = useRef<AbortController | null>(null);

  /** Runs one search; answers to older searches are ignored and their requests aborted. */
  const runSearch = useCallback(async (terms: string) => {
    const id = ++latest.current;
    controller.current?.abort();
    const cached = cache.current.get(terms);
    if (cached) {
      setResult(cached);
      setError(undefined);
      setSearching(false);
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setSearching(true);
    setError(undefined);
    try {
      const found = await api.search(terms, abort.signal);
      if (id !== latest.current) return;
      cache.current.set(terms, found);
      setResult(found);
    } catch (caught) {
      if (abort.signal.aborted || id !== latest.current) return;
      setError(`The search failed: ${(caught as Error).message}`);
    } finally {
      if (id === latest.current) setSearching(false);
    }
  }, []);

  // Search as the reader types, after a short pause.
  useEffect(() => {
    const terms = query.trim();
    if (terms.length < MIN_TERMS) return;
    const timer = setTimeout(() => void runSearch(terms), looksLikeSite(terms) ? 800 : 350);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  useEffect(() => () => controller.current?.abort(), []);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const terms = query.trim();
    if (terms) void runSearch(terms);
  };

  const terms = query.trim();
  const visible = terms.length >= MIN_TERMS ? result : undefined;
  const stale = !!visible && visible.query !== terms;

  return (
    <div className="settings__form settings__form--search">
      <h3>Find a wire</h3>
      <form onSubmit={onSubmit} className="search" role="search">
        <label className="field field--url">
          <span>Search terms</span>
          <input name="q" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="cycling · dutch news · python · theguardian.com" autoComplete="off" />
        </label>
        <button type="submit" className="button button--primary">
          Search
        </button>
        <span className="search__status" role="status" aria-live="polite">
          {searching ? "Searching…" : ""}
        </span>
      </form>
      <p className="settings__hint">
        Results appear as you type. Matches the house directory and, unless the server switched it off, the wider web via feedly.com; a site address is
        probed for the feeds it announces.
      </p>
      {error ? <p className="settings__notice settings__notice--error">{error}</p> : null}
      {visible ? (
        <div className={`proposals${stale ? " proposals--stale" : ""}`} aria-busy={searching}>
          {visible.site ? (
            <p className="proposals__note">
              {visible.site.error
                ? `Could not read ${visible.site.host}: ${visible.site.error}.`
                : `${visible.proposals.filter((p) => p.source === "site").length || "No"} feed(s) announced by ${visible.site.host}.`}
            </p>
          ) : null}
          {visible.proposals.length === 0 ? (
            <p className="settings__empty">
              Nothing found for “{visible.query}”.{" "}
              {visible.wider === "unavailable" ? "The wider search at feedly.com was unavailable; only the house directory was searched." : "Try another topic, a language, or a site address."}
            </p>
          ) : (
            <ol className="proposals__list">
              {visible.proposals.map((proposal) => {
                const added = existing.has(proposal.url);
                const meta = [proposal.site, proposal.category, proposal.language?.toUpperCase(), readers(proposal.subscribers), SOURCE_LABEL[proposal.source]].filter(Boolean);
                return (
                  <li key={proposal.url} className="proposal">
                    <div className="proposal__text">
                      <p className="proposal__name">{proposal.name}</p>
                      {proposal.description ? <p className="proposal__description">{proposal.description}</p> : null}
                      <p className="proposal__meta">{meta.join(" · ")}</p>
                    </div>
                    {added ? (
                      <span className="badge">On the page</span>
                    ) : (
                      <button type="button" className="button button--primary" onClick={() => onAdd(proposal)}>
                        Add
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          {visible.wider === "unavailable" && visible.proposals.length > 0 ? (
            <p className="proposals__note">The wider search at feedly.com was unavailable; these come from the house directory.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
