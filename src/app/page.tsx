import RssSection from "@/components/rss-section/rss-section";

const rssList = [
  "https://news.ycombinator.com/rss",
  "https://reddit.com/.rss"
];

export default function Home() {
  return (
    <main>
      {rssList.map((rssLink, index) => (<RssSection key={index} rssLink={rssLink} />))}
    </main>
  );
}
