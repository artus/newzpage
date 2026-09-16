"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import Colophon from "@/components/colophon";
import FeedSection from "@/components/feed-section";
import Masthead from "@/components/masthead";
import SectionSkeleton from "@/components/section-skeleton";
import { useConfig } from "@/lib/client/use-config";
import { useEdition } from "@/lib/client/use-edition";
import type { NewzpageConfig } from "@/lib/config-schema";
import { displayHost } from "@/lib/util/text";

/** A wire on its own gets a fuller reading than one among several: a lead package and a second band. */
export const WIRE_STORIES = 10;

interface SingleWireProps {
  /** The feed's address; without one the page can only say so. */
  feed?: string;
  /** The name to print until the feed announces its own title. */
  name?: string;
}

/**
 * One wire, printed under this reader's own masthead. It is composed like the front page but is not counted
 * as an edition: a detour into the directory is not the reader's paper.
 */
export default function SingleWire({ feed, name }: SingleWireProps) {
  const { config, error } = useConfig();
  const edition = useMemo<NewzpageConfig | undefined>(
    () => (feed ? { title: "", tagline: "", itemsPerFeed: WIRE_STORIES, feeds: [{ url: feed, name, limit: WIRE_STORIES }] } : undefined),
    [feed, name],
  );
  const { sections, printedAt, reader, loadMore } = useEdition(edition, { record: false });
  const state = sections[0];
  const wireName = state?.name ?? name ?? (feed ? displayHost(feed) : undefined) ?? "A single wire";

  useEffect(() => {
    document.title = config ? `${wireName} · ${config.title}` : wireName;
  }, [config, wireName]);

  return (
    <main className="paper">
      <Masthead title={config?.title ?? "Newzpage"} tagline={config?.tagline ?? ""} date={printedAt} feedCount={feed ? 1 : 0} reader={reader} />
      {error ? <p className="section__notice">{error}</p> : null}
      <p className="kicker">
        <Link href="/">← Front page</Link> · One wire on a page of its own
      </p>
      {!feed ? (
        <section className="notice">
          <h2 className="notice__title">No wire named</h2>
          <p>
            The address does not say which feed to print. <a href="/random">Draw one at random</a>, or <Link href="/">return to the front page</Link>.
          </p>
        </section>
      ) : null}
      {state ? (
        state.status === "done" && state.section ? (
          <FeedSection
            section={state.section}
            batches={state.batches}
            now={printedAt?.getTime() ?? 0}
            loadingMore={state.loadingMore}
            moreNote={state.moreNote}
            onLoadMore={() => loadMore(0)}
          />
        ) : (
          <SectionSkeleton name={state.name} done={state.done} total={state.total} />
        )
      ) : null}
      <Colophon printedAt={printedAt} />
    </main>
  );
}
