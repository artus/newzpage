import Parser from 'rss-parser';
import { Feed } from '../domain/feed';
import { Item } from '../domain/item';
import { DateTime } from 'luxon';
import { parseDate } from '../helpers/date-helpers';
import { CONFIG } from '../config';
import { getRssFeed, saveRssFeed } from '../db/rss-repository';
import { Logger } from '../helpers/logger';

const {
  ORIGIN
} = CONFIG;

export const parse = async (url: URL): Promise<Feed> => {
  const cachedFeed = await getRssFeed(url);
  if (cachedFeed.isPresent()) {
    Logger.info(`Using cached feed for ${url.toString()}`);
    return cachedFeed.value;
  } else {
    Logger.info(`Parsing non-cached feed for ${url.toString()}`);
    const parser = new Parser();
    const parsedFeed = await parser.parseURL(url.toString());

    const items = parsedFeed.items.map(item => {

      return new Item(
        item.title || "No title",
        !!item.pubDate ? parseDate(item.pubDate) : DateTime.invalid("Date is not in a recognized format"),
        !!item.link ? new URL(item.link) : undefined,
        item.comments ? new URL(item.comments) : undefined
      )
    });

    const constructedFeed = new Feed(
      parsedFeed.title || "No title",
      !!parsedFeed.link ? new URL(parsedFeed.link) : new URL(ORIGIN),
      items
    );

    Logger.debug(`Saving parsed feed for ${url.toString()}`);
    return saveRssFeed(url, constructedFeed);
  }
}