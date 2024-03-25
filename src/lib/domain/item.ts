import validator from "valivalue";
import { DateTime } from "luxon";
import { OpenAIService } from "../service/openai-service";
import { getArticle } from "../service/article-service";

export class Item {
  constructor(
    readonly title: string,
    readonly pubDate: DateTime,
    readonly link?: URL,
    readonly comments?: URL
  ) {
    validator.objects.validateNotNullOrUndefined(title, "Item title");
    validator.objects.validateNotNullOrUndefined(pubDate, "Item pubDate");

    validator.strings.validateNotEmpty(title, "Item title");
  }

  async summarize(length = 50): Promise<ItemWithSummary> {
    if (this.link) {
      const parsedArticleResult = getArticle(this.link);
      if (await parsedArticleResult.isSuccess()) {
        const article = await parsedArticleResult.get();
        const summarizedArticle = await OpenAIService.getInstance().summarize(article, length);
        return new ItemWithSummary(this.title, this.pubDate, this.link, this.comments, summarizedArticle.content);
      }
    }

    const summary = await OpenAIService.getInstance().summarizeByTitle(this.title);
    return new ItemWithSummary(this.title, this.pubDate, this.link, this.comments, summary);
  }
}

export class ItemWithSummary extends Item {
  constructor(
    readonly title: string,
    readonly pubDate: DateTime,
    readonly link?: URL,
    readonly comments?: URL,
    readonly summary?: string
  ) {
    super(title, pubDate, link, comments);
    validator.objects.validateNotNullOrUndefined(summary, "Item summary");
    validator.strings.validateNotEmpty(summary!, "Item summary");
  }
}