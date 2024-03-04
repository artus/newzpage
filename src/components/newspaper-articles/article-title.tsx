import Link from "next/link";

import styles from "./article-title.module.scss";

type ArticleTitleProps = {
  title: string;
  location: URL | undefined;
}

export default function ArticleTitle({ title, location }: ArticleTitleProps) {
  return location
    ? <h3 className={styles.article_title}><Link href={location} target="_blank">{title}</Link></h3>
    : <h3 className={styles.article_title}>{title}</h3>
}