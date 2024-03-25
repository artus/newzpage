import { ObjectId } from "mongodb"
import { FeedWithSummarizedItems } from "../domain/feed";
import { AsyncTry, Optional } from "voft";
import clientPromise from "./mongodb";
import { CONFIG } from "../config";
import { DateTime } from "luxon";
import { ItemWithSummary } from "../domain/item";
import { Logger } from "../helpers/logger";

type SerializedSummarizedItem = {
  summary: string;
  link: string | undefined;
  title: string;
  pubDate: string;
  comments: string | undefined;
}

type SerializedSummarizedFeed = {
  title: string;
  link: string;
  items: SerializedSummarizedItem[];
}

type SummarizedFeedDocument = {
  _id: ObjectId;
  url: string;
  feed: SerializedSummarizedFeed,
  ttl: number;
  timestamp: string;
}

const {
  DB,
  FEED_COLLECTION
} = CONFIG.MONGODB;

export const getSummarizedFeed = (url: URL): AsyncTry<Optional<FeedWithSummarizedItems>> => {
  return AsyncTry.of<Optional<FeedWithSummarizedItems>>(async () => {

    const client = await clientPromise;

    const db = client.db(DB);
    const collection = db.collection<SummarizedFeedDocument>(FEED_COLLECTION);

    const foundFeedDocument = await collection.findOne({ url: url.toString() });
    if (foundFeedDocument) {
      const age = DateTime.now().diff(DateTime.fromISO(foundFeedDocument.timestamp)).milliseconds;
      if (age < foundFeedDocument.ttl) {
        return Optional.of(deserializeFeed(foundFeedDocument.feed));
      } else {
        Logger.info(`Summarized feed "${url.toString()}" is stale (${age}ms), deleting.`);
        collection.deleteMany({ url: url.toString() });
        return Optional.empty();
      }
    } else {
      return Optional.empty();
    }
  }).recoverWith((error) => {
    Logger.error(`Error in getSummarizedFeed: ${(error as Error).message}`, error as Error);
    return Optional.empty<FeedWithSummarizedItems>();
  });
}

export const saveSummarizedFeed = async (link: URL, feed: FeedWithSummarizedItems, ttl = 1800000) => {
  const client = await clientPromise;

  const db = client.db(DB);
  const collection = db.collection<SummarizedFeedDocument>(FEED_COLLECTION);

  const feedDocument: SummarizedFeedDocument = {
    _id: new ObjectId(),
    url: link.toString(),
    feed: serializedFeed(feed),
    ttl,
    timestamp: DateTime.now().toISO()
  }

  await collection.insertOne(feedDocument);
  return feed;
}

const serializedFeed = (feed: FeedWithSummarizedItems): SerializedSummarizedFeed => {
  return {
    title: feed.title,
    link: feed.link.toString(),
    items: feed.items.map(item => ({
      title: item.title,
      pubDate: item.pubDate.toISO()!,
      link: item.link ? item.link.toString() : undefined,
      comments: item.comments ? item.comments.toString() : undefined,
      summary: item.summary!
    }))
  }
}

const deserializeFeed = (feed: SerializedSummarizedFeed): FeedWithSummarizedItems => {
  return new FeedWithSummarizedItems(
    feed.title,
    new URL(feed.link),
    feed.items.map(item => new ItemWithSummary(
      item.title,
      DateTime.fromISO(item.pubDate),
      item.link ? new URL(item.link) : undefined,
      !!item.comments ? new URL(item.comments) : undefined,
      item.summary
    ))
  );
}