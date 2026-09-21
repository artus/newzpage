"use client";

import { useState } from "react";
import type { Wire } from "@/lib/client/scrapbook";
import { cuttingPath } from "@/lib/edition/cutting";
import type { Story } from "@/lib/edition/types";
import LinkIcon from "./link-icon";

interface ShareButtonProps {
  story: Story;
  /** The wire the story is printed under, so the cutting can be read from the same feed. */
  wire?: Wire;
  className?: string;
}

/** Copies text the old way too: a LAN address over plain http has no clipboard API. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the older method
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

/**
 * The link at the foot of a story: a press copies the address of its cutting, a page that opens the story
 * on its own and unfurls as a newspaper cutting wherever the link is pasted. On a phone the share sheet opens.
 */
export default function ShareButton({ story, wire, className }: ShareButtonProps) {
  const [done, setDone] = useState<"copied" | "opened">();
  const path = cuttingPath({ link: story.link, title: story.title, feedUrl: story.feedUrl ?? wire?.url });
  if (!path) return null;
  const label = done === "copied" ? "Link copied; paste it anywhere" : done === "opened" ? "The cutting opened in a new tab" : "Copy a link to this story as a cutting";

  const onClick = async () => {
    const url = new URL(path, window.location.origin).toString();
    if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title: story.title, url });
        return;
      } catch {
        // dismissed or unsupported for this content: copy instead
      }
    }
    if (await copyText(url)) setDone("copied");
    else {
      window.open(url, "_blank", "noopener");
      setDone("opened");
    }
    setTimeout(() => setDone(undefined), 2500);
  };

  return (
    <button type="button" className={["story__share", "tip", className].filter(Boolean).join(" ")} onClick={onClick} aria-label={label} data-tip={label} data-cutting={path}>
      <LinkIcon />
    </button>
  );
}
