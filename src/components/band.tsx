"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { fitBudgets, type Band as BandPlan, type MeasuredSlot } from "@/lib/edition/pagemaker";
import Story from "./story";

interface BandProps {
  band: BandPlan;
  columns: number;
  now: number;
  /** Measure and correct word budgets so every slot ends on the same line. */
  fit: boolean;
}

const MAX_PASSES = 6;

/**
 * One full-width band of slots. After each render the rendered heights are measured and the word budgets
 * corrected, before the browser paints; once the slots agree the band switches to "fitted" mode, where
 * residual slack is taken up by stretching photographs and spacing stacked stories.
 */
export default function Band({ band, columns, now, fit }: BandProps) {
  const [budgets, setBudgets] = useState<Record<string, number>>(() =>
    Object.fromEntries(band.slots.flatMap((slot) => slot.stories.map((placed) => [placed.story.id, placed.budget]))),
  );
  const [fitted, setFitted] = useState(!fit);
  const passes = useRef(0);
  const lastMeasurement = useRef("");
  const repeats = useRef(0);
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (fitted) return;
    const element = root.current;
    if (!element) return;
    const measured: MeasuredSlot[] = Array.from(element.querySelectorAll<HTMLElement>(":scope > .slot")).map((slot) => ({
      height: slot.querySelector<HTMLElement>(":scope > .slot__stack")?.offsetHeight ?? 0,
      stories: Array.from(slot.querySelectorAll<HTMLElement>(":scope > .slot__stack > .story")).map((story) => ({
        id: story.dataset.id ?? "",
        budget: Number(story.dataset.budget) || 0,
        words: Number(story.dataset.words) || 0,
        bodyHeight: story.querySelector<HTMLElement>(".story__body")?.offsetHeight ?? 0,
        exhausted: story.dataset.exhausted === "true",
        nextWords: story.dataset.next ? Number(story.dataset.next) : undefined,
        anchor: story.dataset.anchor === "true",
      })),
    }));
    const result = fitBudgets(measured);
    const measurement = JSON.stringify(measured);
    // Development strict mode runs this twice on the same render: the first repeat of a measurement is not a
    // new pass. A second repeat means a request changed nothing, so the fitting is as good as it gets.
    repeats.current = measurement === lastMeasurement.current ? repeats.current + 1 : 0;
    lastMeasurement.current = measurement;
    if (repeats.current === 1 && result.changed) return;
    passes.current += 1;
    const trace = (window as Window & { __newzpageFits?: unknown[] }).__newzpageFits;
    if (trace) trace.push({ pass: passes.current, measured, result });
    const next = result.changed && repeats.current < 2 && passes.current < MAX_PASSES ? result.budgets : null;
    // Measuring rendered copy and correcting it before paint is what a layout effect is for.
    if (next) setBudgets((current) => ({ ...current, ...next }));
    else setFitted(true);
  }, [budgets, fitted]);

  return (
    <div ref={root} className={`band${fitted ? " band--fitted" : ""}`} style={{ "--columns": columns } as CSSProperties}>
      {band.slots.map((slot, index) => (
        <div
          key={index}
          className={`slot ${slot.stories.length === 1 ? "slot--single" : "slot--stack"}${slot.narrow ? " slot--narrow" : ""}`}
          style={{ "--span": slot.span } as CSSProperties}
        >
          <div className="slot__stack">
            {slot.stories.map((placed) => (
              <Story
                key={placed.story.id}
                story={placed.story}
                kind={placed.kind}
                photo={placed.photo}
                textColumns={placed.textColumns}
                maxWords={budgets[placed.story.id] ?? placed.budget}
                anchor={placed.anchor}
                now={now}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
