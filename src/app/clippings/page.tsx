import type { Metadata } from "next";
import ClippingsPage from "./clippings-page";

export const metadata: Metadata = { title: "Clippings" };

/** A static shell; the scrapbook itself lives in the reader's browser. */
export default function Page() {
  return <ClippingsPage />;
}
