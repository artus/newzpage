import {chainable} from "valivalue";

export class SummarizedArticle {
  constructor(
    readonly title: string,
    readonly content: string,
    readonly url: URL
  ) {
    chainable(true)
      .objects.validateNotNullOrUndefined(title, "Article title")
      .objects.validateNotNullOrUndefined(content, "Article content")
      .objects.validateNotNullOrUndefined(url, "Article URL")
      .strings.validateNotEmpty(title, "Article title")
      .strings.validateNotEmpty(content, "Article content");
  }
}