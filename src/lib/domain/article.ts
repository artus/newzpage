import { chainable } from "valivalue";

export class Article {
  constructor(
    readonly title: string,
    readonly content: string,
    readonly url: URL
  ) { 
    chainable(true)
      .objects.validateNotNullOrUndefined(title, "Article title")
      .strings.validateNotEmpty(title, "Article title")
      .objects.validateNotNullOrUndefined(content, "Article content")
      .strings.validateNotEmpty(content, "Article content")
      .objects.validateNotNullOrUndefined(url, "Article URL");
  }
}