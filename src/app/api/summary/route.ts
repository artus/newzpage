import { CustomResponse } from "@/lib/domain/response";
import { Logger } from "@/lib/helpers/logger";
import { getArticle } from "@/lib/service/article-service";
import { OpenAIService } from "@/lib/service/openai-service";
import { NextRequest } from "next/server";


export const GET = async (req: NextRequest) => {
  try {
    Logger.debug(`GET /api/summary called with query: ${JSON.stringify(req.nextUrl.searchParams.toString())}`);
    const url = req.nextUrl.searchParams.get("url");

    if (!url) {
      return CustomResponse.badRequest({ error: "url query parameter is required" });
    }

    const parsedArticle = getArticle(new URL(url));

    if (await parsedArticle.isSuccess()) {
      Logger.debug(`Summarizing fetched article`);
      const summarizedArticle = await OpenAIService.getInstance().summarize(await parsedArticle.get(), 150);
      Logger.debug(`Summarized article`);
      return CustomResponse.ok({ content: summarizedArticle.content });
    } else {
      const cause = await parsedArticle.getCause();
      Logger.error(`Error occurred while fetching article: ${cause.message}`);
      return CustomResponse.internalServerError({ error: cause.message });
    }
  } catch (error) {
    Logger.error(`Error occurred while processing request: ${(error as Error).message}`);
    return CustomResponse.internalServerError({ error: (error as Error).message });
  }
}