import { getSummarizedFeed, saveSummarizedFeed } from "@/lib/db/summarized-feed-repository";
import { CustomResponse } from "@/lib/domain/response";
import { Logger } from "@/lib/helpers/logger";
import { parse } from "@/lib/service/rss-service";
import { NextRequest, NextResponse } from "next/server";

export const POST = async (req: NextRequest) => {
  try {
    const feeds = await req.json();

    if (!feeds) {
      return CustomResponse.badRequest({ error: "feed list is required" });
    }

    if (!Array.isArray(feeds)) {
      return CustomResponse.badRequest({ error: "feed list must be an array" });
    }

    const feedUrls = (feeds as string[]).map(feed => new URL(feed));

    const parsedFeedsPromises = feedUrls.map(parse);

    const parsedFeeds = await Promise.all(parsedFeedsPromises);

    const feedsWithSummarizedItems = await Promise.all(parsedFeeds.map(feed => feed.toSummarizedFeed(50)));

    return NextResponse.json(feedsWithSummarizedItems);
  } catch (error) {
    Logger.error(`Error in POST /api/feed: ${(error as Error).message}`, error as Error);
    return CustomResponse.internalServerError({ error: (error as Error).message });
  }
}

export const GET = async (req: NextRequest) => {
  try {
    Logger.debug(`GET /api/feed called with query: ${JSON.stringify(req.nextUrl.searchParams.toString())}`);
    const url = req.nextUrl.searchParams.get("url");

    if (!url) {
      return CustomResponse.badRequest({ error: "url query parameter is required" });
    }

    const link = new URL(url);

    const cachedFeed = await getSummarizedFeed(link);
    if (cachedFeed.isPresent()) {
      Logger.info(`Returning cached feed for ${url}`);
      return NextResponse.json(cachedFeed.value);
    } else {
      Logger.info(`Feed for ${url} not found in cache, fetching.`);
      const parsedFeed = await parse(new URL(url));
      const feedWithSummarizedItems = await parsedFeed.toSummarizedFeed(50);
      const savedFeed = await saveSummarizedFeed(link, feedWithSummarizedItems);
      return NextResponse.json(savedFeed);
    }
  } catch (error) {
    Logger.error(`Error occurred while getting feed: ${(error as Error).message}`);
    return CustomResponse.internalServerError({ error: (error as Error).message });
  }
}