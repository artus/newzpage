import { ItemWithSummary } from "@/lib/domain/item"
import TwoColumnNewspaperArticle from "../newspaper-articles/two-column-newspaper-article"
import SmallNewspaperArticle from "../newspaper-articles/small-newspaper-article"

import styles from "./article-grid-1.module.scss";

type ArticleGridProps = {
  article1: ItemWithSummary,
  article2: ItemWithSummary,
  article3: ItemWithSummary,
  article4: ItemWithSummary,
  article5: ItemWithSummary,
  article6: ItemWithSummary,
}

export default function ArticleGrid1({
  article1,
  article2,
  article3,
  article4,
  article5,
  article6
}: ArticleGridProps) {
  return <div className={styles.article_grid_one}>
    <TwoColumnNewspaperArticle article={article1} />
    <SmallNewspaperArticle article={article2} />
    <SmallNewspaperArticle article={article3} />
    <SmallNewspaperArticle article={article4} />
    <SmallNewspaperArticle article={article5} />
    <TwoColumnNewspaperArticle article={article6} />
  </div>
}