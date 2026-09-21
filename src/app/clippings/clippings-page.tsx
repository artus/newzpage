"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import Colophon from "@/components/colophon";
import FeedSection from "@/components/feed-section";
import Masthead from "@/components/masthead";
import SectionSkeleton from "@/components/section-skeleton";
import { useConfig } from "@/lib/client/use-config";
import { usePrintedAt } from "@/lib/client/use-printed-at";
import { useReaderStats } from "@/lib/client/use-reader-stats";
import { scrapbook, useClippings, useLastRemoved } from "@/lib/client/use-scrapbook";
import type { Section } from "@/lib/edition/types";
import { relativeTime } from "@/lib/util/time";

const ABOUT = "Stories you clipped from the wires. They keep their summary and photograph here after the cache has forgotten the article.";

/** The scrapbook: every clipping typeset like a wire of its own, newest first, under the reader's masthead. */
export default function ClippingsPage() {
  const { config } = useConfig();
  const clippings = useClippings();
  const removed = useLastRemoved();
  const printedAt = usePrintedAt();
  const reader = useReaderStats();
  const [notice, setNotice] = useState<{ text: string; error?: boolean }>();
  const fileInput = useRef<HTMLInputElement>(null);
  const now = printedAt?.getTime() ?? 0;
  const count = clippings.length;

  const section = useMemo<Section>(
    () => ({
      name: "Clippings",
      url: "newzpage:clippings",
      description: ABOUT,
      fetchedAt: 0,
      stale: false,
      stories: clippings.map((clipping) => ({ ...clipping.story, wire: clipping.wire.name })),
    }),
    [clippings],
  );
  const batches = useMemo(() => [section.stories], [section]);
  const oldest = clippings[count - 1];
  const meta =
    `${count} ${count === 1 ? "clipping" : "clippings"}` +
    (count > 1 && oldest ? ` · the oldest clipped ${relativeTime(oldest.clippedAt, now || undefined)}` : "");

  const say = (text: string) => setNotice({ text });
  const complain = (text: string) => setNotice({ text, error: true });

  const onExport = () => {
    const blob = new Blob([`${JSON.stringify(scrapbook().export(), null, 2)}\n`], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "newzpage-clippings.json";
    anchor.click();
    URL.revokeObjectURL(href);
  };

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const { added, total } = scrapbook().import(JSON.parse(await file.text()));
      say(`${added} ${added === 1 ? "clipping was" : "clippings were"} added from ${file.name}; the book holds ${total}.`);
    } catch (caught) {
      complain(`${file.name} could not be pasted in: ${(caught as Error).message}.`);
    }
  };

  const onClear = () => {
    if (!window.confirm(`Throw away all ${count} ${count === 1 ? "clipping" : "clippings"}? This cannot be undone.`)) return;
    const result = scrapbook().clear();
    if (result.ok) say("The scrapbook is empty again.");
    else complain(result.reason);
  };

  const onUndo = () => {
    const result = scrapbook().undo();
    if (!result.ok) complain(result.reason);
  };

  return (
    <main className="paper">
      <Masthead title={config?.title ?? "Newzpage"} tagline={config?.tagline ?? ""} date={printedAt} feedCount={config?.feeds.length ?? 0} reader={reader} />
      <p className="kicker">
        <Link href="/">← Front page</Link> · Your clippings, kept in this browser
      </p>
      <div className="scrapbook__toolbar">
        <button type="button" className="button" onClick={onExport} disabled={count === 0}>
          Export clippings
        </button>
        <button type="button" className="button" onClick={() => fileInput.current?.click()}>
          Import clippings
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            void onImport(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <button type="button" className="button" onClick={onClear} disabled={count === 0}>
          Throw them all away
        </button>
      </div>
      {notice ? (
        <p className={`settings__notice${notice.error ? " settings__notice--error" : ""}`} role={notice.error ? "alert" : "status"}>
          <span>{notice.text}</span>
        </p>
      ) : null}
      {removed ? (
        <p className="settings__notice" role="status">
          <span>“{removed.story.title}” was let go.</span>
          <button type="button" className="button" onClick={onUndo}>
            Undo
          </button>
        </p>
      ) : null}
      {!printedAt ? (
        <SectionSkeleton name="Clippings" />
      ) : count === 0 ? (
        <section className="notice">
          <h2 className="notice__title">The scrapbook is empty</h2>
          <p>
            Press the scissors at the foot of any story on the <Link href="/">front page</Link> to keep it here, summary and photograph
            included, after the wires have moved on.
          </p>
        </section>
      ) : (
        <FeedSection section={section} batches={batches} now={now} loadingMore={false} meta={meta} />
      )}
      <Colophon printedAt={printedAt} />
    </main>
  );
}
