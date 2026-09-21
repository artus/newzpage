"use client";

import Link from "next/link";
import { useClippings } from "@/lib/client/use-scrapbook";
import ScissorsIcon from "./scissors-icon";

/** The way to the scrapbook, with a count once there is something in it. */
export default function ClippingsLink() {
  const count = useClippings().length;
  return (
    <Link href="/clippings" className="masthead__button" title="Stories you clipped from the wires">
      <ScissorsIcon />
      Clippings{count > 0 ? ` · ${count}` : ""}
    </Link>
  );
}
