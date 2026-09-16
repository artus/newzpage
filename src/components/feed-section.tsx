"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { columnsFor, planPage } from "@/lib/edition/pagemaker";
import type { Section } from "@/lib/edition/types";
import { fnv1a, hashId } from "@/lib/util/hash";
import { displayHost } from "@/lib/util/text";
import { clock } from "@/lib/util/time";
import Band from "./band";

interface FeedSectionProps {
  section: Section;
  /** The edition's print time, so every dateline is relative to the same moment. */
  now: number;
}

export default function FeedSection({ section, now }: FeedSectionProps) {
  const page = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>();
  const [fontsReady, setFontsReady] = useState(false);

  // The page is planned for the width it really has, and re-planned when that changes noticeably.
  useEffect(() => {
    const element = page.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const measured = Math.round(entries[0]?.contentRect.width ?? 0);
      if (measured > 0) setWidth((current) => (current !== undefined && Math.abs(current - measured) < 24 ? current : measured));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Copy is fitted against the real fonts; until they arrive, measurements would be off.
  useEffect(() => {
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) setFontsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const columns = width ? columnsFor(width) : 0;
  const plan = useMemo(
    () => (width ? planPage(section.stories, { width, columns, seed: fnv1a(section.url + section.stories.map((story) => story.id).join("|")) }) : undefined),
    [section, width, columns],
  );
  const headingId = `section-${hashId(section.url)}`;
  const count = section.stories.length;

  return (
    <section className="section" aria-labelledby={headingId}>
      <header className="section__head">
        <h2 id={headingId}>{section.link ? <a href={section.link} target="_blank" rel="noopener noreferrer">{section.name}</a> : section.name}</h2>
        <p className="section__meta">
          {section.error
            ? "Wire down"
            : `${count} ${count === 1 ? "dispatch" : "dispatches"} · ${section.stale ? "from the archive of" : "received"} ${clock(new Date(section.fetchedAt))}`}
        </p>
      </header>

      {section.error ? (
        <p className="section__notice">
          No news reached us from {displayHost(section.url) ?? section.url} this edition ({section.error}). The wire will be tried again on the next reload.
        </p>
      ) : null}

      <div ref={page} className="page">
        {plan?.bands.map((band, index) => (
          <Band key={`${columns}:${width}:${fontsReady ? "f" : "s"}:${index}`} band={band} columns={columns} now={now} fit={columns > 1} />
        ))}
      </div>
    </section>
  );
}
