"use client";

import { useState } from "react";
import type { Wire } from "@/lib/client/scrapbook";
import { scrapbook, useClipped } from "@/lib/client/use-scrapbook";
import type { Story } from "@/lib/edition/types";
import { displayHost } from "@/lib/util/text";
import ScissorsIcon from "./scissors-icon";

interface ClipButtonProps {
  story: Story;
  /** The wire the story is printed under, recorded with the clipping. */
  wire?: Wire;
  className?: string;
}

/** The scissors at the foot of a story: one press keeps it in the reader's clippings, another lets it go. */
export default function ClipButton({ story, wire, className }: ClipButtonProps) {
  const clipped = useClipped(story.id);
  const [trouble, setTrouble] = useState<string>();

  const onClick = () => {
    if (clipped && !window.confirm(`Let this clipping go?\n\n“${story.title}”`)) return;
    const book = scrapbook();
    const origin = wire ?? { name: story.wire ?? displayHost(story.link) ?? "the wire", url: story.link ?? "" };
    const result = clipped ? book.remove(story.id) : book.add(story, origin);
    setTrouble(result.ok ? undefined : result.reason);
  };

  const label = clipped ? "Clipped; press to let it go" : "Keep this story among your clippings";

  return (
    <>
      <button
        type="button"
        className={["story__clip", "tip", className].filter(Boolean).join(" ")}
        onClick={onClick}
        aria-pressed={clipped}
        aria-label={label}
        data-tip={label}
      >
        <ScissorsIcon />
      </button>
      {trouble ? (
        <span className="story__trouble" role="alert">
          {trouble}
        </span>
      ) : null}
    </>
  );
}
