import { ObjectId } from "mongodb";
import { CONFIG } from "../config";
import { Optional } from "../domain/optional";
import { SummarizedArticle } from "../domain/summarized-article";
import clientPromise from "./mongodb";
import { DateTime } from "luxon";
import { Logger } from "../helpers/logger";

const {
  DB,
  ARTICLE_COLLECTION
} = CONFIG.MONGODB;

type ArticleDocument = {
  _id: ObjectId;
  title: string;
  url: string;
  content: string;
  ttl: number; // TTL in ms
  timestamp: string
}

export const getSummary = async (url: URL): Promise<Optional<SummarizedArticle>> => {
  try {
    const client = await clientPromise;

    const db = client.db(DB)
    const collection = db.collection<ArticleDocument>(ARTICLE_COLLECTION);

    const foundArticleDocument = await collection.findOne({ url: url.toString() });

    if (foundArticleDocument) {
      const age = DateTime.now().diff(DateTime.fromISO(foundArticleDocument.timestamp)).milliseconds;
      if (age < foundArticleDocument.ttl) {
        return Optional.of(deserializeArticle(foundArticleDocument));
      } else {
        Logger.info(`Article "${url.toString()}" is stale (${age}ms), deleting.`);
        collection.deleteMany({ url: url.toString() });
        return Optional.empty();
      }
    } else {
      return Optional.empty();
    }
  } catch (error) {
    return Optional.empty();
  }
}

export const saveSummary = async (article: SummarizedArticle, ttl = 86400000) => {
  const client = await clientPromise;

  const db = client.db(DB);
  const collection = db.collection<ArticleDocument>(ARTICLE_COLLECTION);

  const articleDocument: ArticleDocument = {
    _id: new ObjectId(),
    title: article.title,
    url: article.url.toString(),
    content: article.content,
    ttl,
    timestamp: DateTime.now().toISO()
  }

  await collection.insertOne(articleDocument);
  return article;
}

const deserializeArticle = (articleDocument: ArticleDocument) => {
  return new SummarizedArticle(articleDocument.title, articleDocument.content, new URL(articleDocument.url));
}