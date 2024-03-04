"use client"

import { FeedWithSummarizedItems } from "@/lib/domain/feed";
import { useEffect, useState } from "react";
import NewspaperTitle from "../newspaper-title/newspaper-title";
import SmallNewspaperArticle from "../newspaper-articles/small-newspaper-article";
import TwoColumnNewspaperArticle from "../newspaper-articles/two-column-newspaper-article";
import ArticleGrid1 from "../article-grids/article-grid-1";

type RssSectionProps = {
  rssLink: string;
}

export default function RssSection({ rssLink }: RssSectionProps) {

  const [rssData, setRssData] = useState<FeedWithSummarizedItems | undefined>(undefined);

  useEffect(() => {
    (async () => {
      const response = await fetch(`/api/feed?url=${rssLink}`);
      const data = await response.json();
      setRssData(data);
    })();
  }, [rssLink])

  const [one, two, three, four, five, six, ...rest] = rssData?.items || [];

  return !rssData
    ? <p>Loading</p>
    : <>
      <NewspaperTitle title={rssData.title} />
      <ArticleGrid1 
        article1={one}
        article2={two}
        article3={three}
        article4={four}
        article5={five}
        article6={six}
      />
        {rest.map((item, index) => (
          <TwoColumnNewspaperArticle key={index} article={item} />
        ))}
    </>
}