"use client";

import { useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { FeedConfig } from "@/lib/config-schema";

/** How long after the last keystroke a row is saved. */
const SAVE_DELAY = 500;

interface WireListProps {
  feeds: FeedConfig[];
  itemsPerFeed: number;
  onReorder: (urls: string[]) => void;
  onMove: (url: string, direction: "up" | "down") => void;
  onUpdate: (url: string, name: string | undefined, limit: number | undefined) => void;
  onRemove: (url: string) => void;
}

interface DragState {
  from: number;
  to: number;
  dy: number;
  height: number;
}

interface DragStart {
  from: number;
  startY: number;
  startScroll: number;
  rects: Array<{ top: number; height: number }>;
}

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * The ordered list of wires. Rows are dragged by their grip; the arrow buttons do the same for keyboards.
 * While dragging, the DOM order stays put and rows are shifted with transforms, so the browser animates
 * the displaced rows; the order is committed on drop.
 */
export default function WireList({ feeds, itemsPerFeed, onReorder, onMove, onUpdate, onRemove }: WireListProps) {
  const items = feeds;
  const [drag, setDrag] = useState<DragState | null>(null);
  const locked = false;
  const rows = useRef<Array<HTMLLIElement | null>>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const start = useRef<DragStart | null>(null);
  const latest = useRef<DragState | null>(null);
  const last = items.length - 1;

  const update = (state: DragState | null) => {
    latest.current = state;
    setDrag(state);
  };

  const onGripDown = (index: number) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (locked || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    const rects = items.map((_, i) => {
      const rect = rows.current[i]?.getBoundingClientRect();
      return { top: rect?.top ?? 0, height: rect?.height ?? 0 };
    });
    start.current = { from: index, startY: event.clientY, startScroll: window.scrollY, rects };
    event.currentTarget.setPointerCapture(event.pointerId);
    update({ from: index, to: index, dy: 0, height: rects[index].height });
  };

  const onGripMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const begun = start.current;
    if (!begun) return;
    const dy = event.clientY + (window.scrollY - begun.startScroll) - begun.startY;
    const own = begun.rects[begun.from];
    const center = own.top + own.height / 2 + dy;
    let to = 0;
    begun.rects.forEach((rect, i) => {
      if (i !== begun.from && rect.top + rect.height / 2 < center) to++;
    });
    update({ from: begun.from, to, dy, height: own.height });
  };

  const finish = (event: ReactPointerEvent<HTMLButtonElement>, commit: boolean) => {
    if (!start.current) return;
    start.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const state = latest.current;
    update(null);
    if (!commit || !state || state.from === state.to) return;
    onReorder(move(items, state.from, state.to).map((feed) => feed.url));
  };

  /** Saves a row's fields when they differ from what is stored. */
  const commit = (feed: FeedConfig, form: HTMLFormElement) => {
    const timer = timers.current.get(feed.url);
    if (timer) clearTimeout(timer);
    timers.current.delete(feed.url);
    const data = new FormData(form);
    const rawName = data.get("name");
    const rawLimit = Number(data.get("limit"));
    const name = typeof rawName === "string" && rawName.trim() ? rawName.trim() : undefined;
    const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 50) : undefined;
    if (name === feed.name && limit === feed.limit) return;
    onUpdate(feed.url, name, limit);
  };

  const schedule = (feed: FeedConfig, form: HTMLFormElement) => {
    const timer = timers.current.get(feed.url);
    if (timer) clearTimeout(timer);
    timers.current.set(
      feed.url,
      setTimeout(() => commit(feed, form), SAVE_DELAY),
    );
  };

  useEffect(() => {
    const active = timers.current;
    return () => {
      for (const timer of active.values()) clearTimeout(timer);
      active.clear();
    };
  }, []);

  const onEdit = (feed: FeedConfig) => (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    commit(feed, event.currentTarget);
  };

  const transformFor = (index: number): string | undefined => {
    if (!drag) return undefined;
    if (index === drag.from) return `translateY(${drag.dy}px)`;
    if (drag.from < index && index <= drag.to) return `translateY(-${drag.height}px)`;
    if (drag.to <= index && index < drag.from) return `translateY(${drag.height}px)`;
    return undefined;
  };

  return (
    <>
      <ol className={`wires${drag ? " wires--dragging" : ""}`}>
        {items.map((feed, index) => {
          const label = feed.name ?? feed.url;
          return (
            <li
              key={feed.url}
              ref={(element) => {
                rows.current[index] = element;
              }}
              className={`wire${drag?.from === index ? " wire--dragging" : ""}`}
              style={{ transform: transformFor(index) }}
            >
              <div className="wire__row">
                <button
                  type="button"
                  className="wire__grip"
                  aria-label={`Drag ${label} to reorder`}
                  title="Drag to reorder"
                  disabled={locked}
                  onPointerDown={onGripDown(index)}
                  onPointerMove={onGripMove}
                  onPointerUp={(event) => finish(event, true)}
                  onPointerCancel={(event) => finish(event, false)}
                >
                  <span aria-hidden="true">⠿</span>
                  <span className="wire__position">{index + 1}.</span>
                </button>
                <form onSubmit={onEdit(feed)} className="wire__edit">
                  <label className="field field--name">
                    <span>Name</span>
                    <input
                      name="name"
                      defaultValue={feed.name ?? ""}
                      placeholder="The feed's own title"
                      disabled={locked}
                      onChange={(event) => schedule(feed, event.currentTarget.form!)}
                      onBlur={(event) => commit(feed, event.currentTarget.form!)}
                    />
                  </label>
                  <label className="field field--limit">
                    <span>Stories</span>
                    <input
                      name="limit"
                      type="number"
                      min={1}
                      max={50}
                      defaultValue={feed.limit ?? itemsPerFeed}
                      disabled={locked}
                      onChange={(event) => schedule(feed, event.currentTarget.form!)}
                      onBlur={(event) => commit(feed, event.currentTarget.form!)}
                    />
                  </label>
                </form>
                <a className="wire__url" href={feed.url} target="_blank" rel="noopener noreferrer">
                  {feed.url}
                </a>
                <div className="wire__actions">
                  <button type="button" className="button" disabled={index === 0} aria-label={`Move ${label} up`} onClick={() => onMove(feed.url, "up")}>
                    ↑
                  </button>
                  <button type="button" className="button" disabled={index === last} aria-label={`Move ${label} down`} onClick={() => onMove(feed.url, "down")}>
                    ↓
                  </button>
                  <button type="button" className="button button--danger" aria-label={`Remove ${label}`} onClick={() => onRemove(feed.url)}>
                    Remove
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
