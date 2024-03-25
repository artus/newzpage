import { ObjectId } from "mongodb";
import { CONFIG } from "../config";
import { Feed } from "../domain/feed";
import clientPromise from "./mongodb";
import { DateTime } from "luxon";
import { Item } from "../domain/item";
import { Logger } from "../helpers/logger";
import { AsyncTry, Optional } from "voft";

type FeedDocument = {
  _id: ObjectId;
  url: string;
  feed: SerializedFeed;
  ttl: number; // TTL in ms
  timestamp: string
}

type SerializedItem = {
  title: string;
  pubDate: string;
  link: string | null;
  comments: string | null;
}

type SerializedFeed = {
  title: string;
  link: string;
  items: SerializedItem[];
}

const {
  DB,
  RSS_COLLECTION
} = CONFIG.MONGODB;

export const getRssFeed = (url: URL): AsyncTry<Optional<Feed>> => {
  return AsyncTry.of<Optional<Feed>>(async () => {
    const client = await clientPromise;

    const db = client.db(DB)
    const collection = db.collection<FeedDocument>(RSS_COLLECTION);

    const foundFeedDocument = await collection.findOne({ url: url.toString() });

    if (foundFeedDocument) {
      const age = DateTime.now().diff(DateTime.fromISO(foundFeedDocument.timestamp)).milliseconds;
      if (age < foundFeedDocument.ttl) {
        return Optional.of(deserializeFeed(foundFeedDocument.feed));
      } else {
        Logger.info(`Feed "${url.toString()}" is stale (${age}ms), deleting.`);
        collection.deleteMany({ url: url.toString() });
        return Optional.empty();
      }
    } else {
      return Optional.empty();
    }
  }).recoverWith((error) => {
    Logger.error(`Error in getRssFeed: ${error.message}`, error);
    return Optional.empty<Feed>();
  });
}

export const saveRssFeed = async (url: URL, feed: Feed, ttl = 3600000) => {
  const client = await clientPromise;

  const db = client.db(DB)
  const collection = db.collection<FeedDocument>(RSS_COLLECTION);

  const feedDocument: FeedDocument = {
    _id: new ObjectId(),
    url: url.toString(),
    feed: serializeFeed(feed),
    ttl,
    timestamp: DateTime.now().toISO()
  }
  await collection.insertOne(feedDocument);
  return feed;
}

const serializeFeed = (feed: Feed): SerializedFeed => {
  const serializedItems: SerializedItem[] = feed.items.map(item => {
    return {
      title: item.title,
      pubDate: item.pubDate.toISO() || DateTime.now().toISO(), 
      link: !!item.link ? item.link.toString() : null,
      comments: !!item.comments ? item.comments.toString() : null
    }
  });
  return {
    title: feed.title,
    link: feed.link.toString(),
    items: serializedItems
  }
}

const deserializeFeed = (serializedFeed: SerializedFeed): Feed => {
  const items = serializedFeed.items.map(item => {
    return new Item(
      item.title,
      DateTime.fromISO(item.pubDate),
      !!item.link ? new URL(item.link) : undefined,
      !!item.comments ? new URL(item.comments) : undefined
    );
  });
  return new Feed(
    serializedFeed.title,
    new URL(serializedFeed.link),
    items
  );
}