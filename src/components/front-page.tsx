"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useConfig } from "@/lib/client/use-config";
import { useEdition } from "@/lib/client/use-edition";
import Colophon from "./colophon";
import FeedSection from "./feed-section";
import Masthead from "./masthead";
import SectionSkeleton from "./section-skeleton";

/** The whole edition is composed in the browser from this browser's configuration and summary cache. */
export default function FrontPage() {
  const { config, ready, error } = useConfig();
  const { sections, printedAt, reader, loadMore } = useEdition(config);

  useEffect(() => {
    if (config?.title) document.title = config.title;
  }, [config?.title]);

  return (
    <main className="paper">
      <Masthead title={config?.title ?? "Newzpage"} tagline={config?.tagline ?? ""} date={printedAt} feedCount={config?.feeds.length ?? 0} reader={reader} />
      {error ? <p className="section__notice">{error}</p> : null}
      {ready && config && config.feeds.length === 0 ? (
        <section className="notice">
          <h2 className="notice__title">The wires are silent</h2>
          <p>
            No feeds are configured in this browser yet. <Link href="/settings">Open the composing room</Link> to add some.
          </p>
        </section>
      ) : null}
      {sections.map((state, index) =>
        state.status === "done" && state.section ? (
          <FeedSection
            key={state.feed.url}
            section={state.section}
            batches={state.batches}
            now={printedAt?.getTime() ?? 0}
            loadingMore={state.loadingMore}
            moreNote={state.moreNote}
            onLoadMore={() => loadMore(index)}
          />
        ) : (
          <SectionSkeleton key={state.feed.url} name={state.name} done={state.done} total={state.total} />
        ),
      )}
      <Colophon printedAt={printedAt} />
    </main>
  );
}
