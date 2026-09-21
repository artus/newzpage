import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import ClipButton from "@/components/clip-button";
import Photo from "@/components/photo";
import { getArticle } from "@/lib/edition/build";
import { captionFor } from "@/lib/edition/caption";
import { cutStory, cuttingQuery, cuttingRequest, unreadable, type Cutting, type CuttingRequest } from "@/lib/edition/cutting";
import { storyFrom, type ArticleRecord, type Story } from "@/lib/edition/types";
import { longDate } from "@/lib/util/time";

/** Reading and summarising a page can take a while; serverless platforms cut functions off at ten seconds by default. */
export const maxDuration = 60;

interface StoryPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/** One read per request, shared by the metadata and the page; the server's own cache spares repeat visitors the wait. */
const read = cache(async (url: string, feed: string | undefined, title: string | undefined): Promise<ArticleRecord> => {
  try {
    return await getArticle(url, feed, title);
  } catch (error) {
    return unreadable({ url, feed, title }, (error as Error).message);
  }
});

async function load(searchParams: StoryPageProps["searchParams"]): Promise<{ request?: CuttingRequest; record?: ArticleRecord; cutting?: Cutting }> {
  const request = cuttingRequest(await searchParams);
  if (!request) return {};
  const record = await read(request.url, request.feed, request.title);
  return { request, record, cutting: cutStory(record, request) };
}

/** Link previews read these tags without running any script, so the cutting is described here, on the server. */
export async function generateMetadata({ searchParams }: StoryPageProps): Promise<Metadata> {
  const { request, cutting } = await load(searchParams);
  if (!request || !cutting) return { title: "A cutting", robots: { index: false, follow: false } };
  const query = cuttingQuery(request);
  const image = { url: `/story/image?${query}`, width: 1200, height: 630, alt: cutting.title };
  return {
    title: cutting.title,
    description: cutting.excerpt,
    openGraph: { type: "article", siteName: "Newzpage", title: cutting.title, description: cutting.excerpt, url: `/story?${query}`, images: [image] },
    twitter: { card: "summary_large_image", title: cutting.title, description: cutting.excerpt, images: [image.url] },
    // A cutting is for passing around, not for search engines, which should find the original instead.
    robots: { index: false, follow: true },
  };
}

/** One story on a page of its own, cut from the paper: what a shared link opens. */
export default async function StoryPage({ searchParams }: StoryPageProps) {
  const { request, record, cutting } = await load(searchParams);
  return (
    <main className="paper cutting">
      <header className="cutting__head">
        <Link href="/" className="cutting__paper">
          Newzpage
        </Link>
        <span className="cutting__note">A cutting · {longDate(new Date())}</span>
      </header>
      {request && record && cutting ? (
        <CuttingArticle request={request} record={record} cutting={cutting} />
      ) : (
        <section className="notice">
          <h1 className="notice__title">No story named</h1>
          <p>
            The address does not say which story to cut. <Link href="/">Read the paper</Link> instead.
          </p>
        </section>
      )}
      <footer className="cutting__foot">
        Cut from <Link href="/">Newzpage</Link>, a newspaper set from RSS feeds, with summaries made in-house and nothing sent to a third party.{" "}
        <Link href="/">Make your own paper.</Link>
      </footer>
    </main>
  );
}

function CuttingArticle({ request, record, cutting }: { request: CuttingRequest; record: ArticleRecord; cutting: Cutting }) {
  const published = cutting.published ? new Date(cutting.published) : undefined;
  const dateline = [cutting.byline ? `By ${cutting.byline}` : undefined, cutting.host, published && !Number.isNaN(published.getTime()) ? longDate(published) : undefined].filter(Boolean);
  // The same shape the front page prints, so the scissors can keep the cutting in this browser's scrapbook.
  const story: Story = { ...storyFrom({ id: request.url, title: cutting.title, link: request.url, published: cutting.published }, record), feedUrl: request.feed };
  return (
    <article className="cutting__story" lang={cutting.lang}>
      <h1 className="cutting__headline">
        <a href={cutting.url} target="_blank" rel="noopener noreferrer">
          {cutting.title}
        </a>
      </h1>
      {dateline.length > 0 ? <p className="story__dateline">{dateline.join(" · ")}</p> : null}
      {cutting.image ? <Photo src={cutting.image.url} alt={cutting.image.alt} caption={captionFor(cutting.image.alt, cutting.host)} /> : null}
      <div className="cutting__body">
        {cutting.missing ? (
          <p className="story__missing">
            No copy could be cut from {cutting.host ?? "the page"}
            {cutting.error ? ` (${cutting.error})` : ""}. The full story is at the address above.
          </p>
        ) : (
          cutting.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
        )}
      </div>
      <p className="cutting__original">
        <a href={cutting.url} target="_blank" rel="noopener noreferrer">
          Read the original at {cutting.host ?? "the source"}
        </a>
      </p>
      {!cutting.missing ? (
        <p className="cutting__clip">
          <ClipButton story={story} wire={{ name: cutting.host ?? "the wire", url: request.feed ?? request.url }} />
          <span>Keep this story among your clippings.</span>
        </p>
      ) : null}
    </article>
  );
}
