import { JSDOM, VirtualConsole } from "jsdom";
import { Readability } from "@mozilla/readability";
import { NodeHtmlMarkdown } from "node-html-markdown";
import { Result } from "../domain/result";
import { Article } from "../domain/article";
import { Logger } from "../helpers/logger";


export const getArticle = async (url: URL): Promise<Result<Article>> => {
  try {
    Logger.debug(`Fetching article from ${url}`);
    const resp = await fetch(url);
    const text = await resp.text();

    const doc = new JSDOM(text, { virtualConsole: new VirtualConsole() });

    const reader = new Readability(doc.window.document);
    const parsedArticle = reader.parse();

    if (!parsedArticle) {
      return Result.failure("Failed to parse article");
    }

    const contentMarkdown = NodeHtmlMarkdown.translate(parsedArticle.content);

    let regex = /\[([^\]]+)]\(([^)]+)\)/g;
    const articleWithLinksRemoved = contentMarkdown.replace(regex, "$1");

    const article = new Article(parsedArticle.title, articleWithLinksRemoved, url);
    return Result.success(article);
  } catch (error) {
    return Result.failure((error as Error));
  }
}