import { ItemWithSummary } from "@/lib/domain/item";
import Link from "next/link";
import styles from "./small-newspaper-article.module.scss";
import ArticleTitle from "./article-title";

type NewspaperArticleProps = {
  article: ItemWithSummary;
}

export default function SmallNewspaperArticle({ article }: NewspaperArticleProps) {
  return <article className={styles.small_newspaper_article}>
    <ArticleTitle title={article.title} location={article.link} />
    <p>{article.summary}</p>
  </article>
}