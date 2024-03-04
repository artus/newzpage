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