import validator from "valivalue";
import { Item, ItemWithSummary } from "./item";

export class Feed {

  constructor(
    readonly title: string,
    readonly link: URL,
    readonly items: Item[]
  ) {
    validator.objects.validateNotNullOrUndefined(title, "Feed title");
    validator.objects.validateNotNullOrUndefined(link, "Feed link");
  }

  async toSummarizedFeed(length = 50): Promise<FeedWithSummarizedItems> {
    const summarizedItems = await Promise.all(this.items.map(item => item.summarize(length)));
    return new FeedWithSummarizedItems(this.title, this.link, summarizedItems);
  }
}

export class FeedWithSummarizedItems extends Feed {
  constructor(
    readonly title: string,
    readonly link: URL,
    readonly items: ItemWithSummary[]
  ) {
    super(title, link, items);

    validator.objects.validateNotNullOrUndefined(items, "Feed items");
  }
}