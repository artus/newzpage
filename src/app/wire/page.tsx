import type { Metadata } from "next";
import { isHttpUrl } from "@/lib/config-schema";
import { displayHost } from "@/lib/util/text";
import SingleWire from "./single-wire";

interface WirePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/** The wire named in the address, and the name to print until the feed says its own. */
async function wireOf(searchParams: WirePageProps["searchParams"]) {
  const params = await searchParams;
  const feed = typeof params.feed === "string" && isHttpUrl(params.feed) ? params.feed : undefined;
  const name = typeof params.name === "string" && params.name.trim() ? params.name.trim().slice(0, 120) : undefined;
  return { feed, name };
}

export async function generateMetadata({ searchParams }: WirePageProps): Promise<Metadata> {
  const { feed, name } = await wireOf(searchParams);
  return { title: feed ? (name ?? displayHost(feed) ?? "A single wire") : "A single wire" };
}

/** One wire on a page of its own. The address names the feed; the browser composes the page as it does the front page. */
export default async function WirePage({ searchParams }: WirePageProps) {
  const { feed, name } = await wireOf(searchParams);
  return <SingleWire feed={feed} name={name} />;
}
