import validator from "valivalue";

export class RssEntry {
  constructor(
    readonly title: string,
    readonly url: URL
  ) {
    validator.objects.validateNotNullOrUndefined(title, "RssEntry title");
    validator.objects.validateNotNullOrUndefined(url, "RssEntry url");

    validator.strings.validateNotEmpty(title, "RssEntry title");
  }
}