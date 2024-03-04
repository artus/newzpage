import { ItemWithSummary } from "@/lib/domain/item";
import ArticleTitle from "./article-title";

import styles from "./two-column-newspaper-article.module.scss";

type TwoColumnNewspaperArticleProps = {
  article: ItemWithSummary
}

// Generate a random number between 1 and 4
function getRandomInt() {
  return Math.floor(Math.random() * 10) + 1;
}

export default function TwoColumnNewspaperArticle({ article }: TwoColumnNewspaperArticleProps) {

  const randomInt = getRandomInt();

  return <article className={`${styles.two_column_newspaper_article} random-article-style-${randomInt}`}>
    <ArticleTitle title={article.title} location={article.link} />
    <p>{article.summary}</p>
  </article>
}