import validator from "valivalue";
import { CONFIG } from "../config";
import OpenAI from "openai";
import { ChatCompletion, ChatCompletionAssistantMessageParam, ChatCompletionMessageParam } from "openai/resources/index.mjs";
import { Article } from "../domain/article";
import { SummarizedArticle } from "../domain/summarized-article";
import { getRssFeed } from "../db/rss-repository";
import { getSummary, saveSummary } from "../db/summary-repository";
import { Logger } from "../helpers/logger";

const {
  API_KEY,
  API_URL,
  MODEL,
} = CONFIG.OPENAI;

export class OpenAIService {

  static instance: OpenAIService | null;
  private readonly openAI: OpenAI;

  private constructor(
    apiKey: string,
    apiUrl: string,
    private readonly model: string
  ) {
    validator.objects.validateNotNullOrUndefined(apiKey, "OpenAI API Key");
    validator.objects.validateNotNullOrUndefined(apiUrl, "OpenAI API URL");
    validator.objects.validateNotNullOrUndefined(model, "OpenAI Model");

    validator.strings.validateNotEmpty(apiKey, "OpenAI API Key");
    validator.strings.validateNotEmpty(apiUrl, "OpenAI API URL");
    validator.strings.validateNotEmpty(model, "OpenAI Model");

    this.openAI = new OpenAI({
      apiKey,
    });
  }

  async summarize(article: Article, length = 50): Promise<SummarizedArticle> {
    const cachedArticle = await getSummary(article.url);
    if (cachedArticle.isPresent()) {
      Logger.info(`Using cached article for ${article.url.toString()}`);
      return cachedArticle.value;
    } else {
      Logger.info(`Using non-cached article for ${article.url.toString()}`);
      const prompt = await generateChatPrompt(article, length);
      const chatInput: OpenAI.Chat.ChatCompletionCreateParams = {
        model: this.model,
        messages: prompt
      };

      const completion = await this.openAI.chat.completions.create(chatInput);
      const validatedContent = validateCompletion(completion);

      const summarizedArticle = new SummarizedArticle(article.title, validatedContent, article.url);

      Logger.debug(`Saving summarized article for ${article.url.toString()}`);
      return saveSummary(summarizedArticle);
    }
  }

  async summarizeByTitle(title: string, length = 50): Promise<string> {
    const chatInput: OpenAI.Chat.ChatCompletionCreateParams = {
      model: this.model,
      messages: [
        { "role": "system", "content": "You are an AI that summarizes webarticles and restructures them as if they are newspaper articles." },
        { "role": "system", "content": "In this case, we were not able to parse the webarticle, but we do have the title. You will have to create a newspaper article yourself based on the title." },
        { "role": "system", "content": "Don't talk about the article itself, but write the summary in such a way that it can be a newspaper article on its own." },
        { "role": "system", "content": "Don't include newlines or other special characters." },
        { "role": "system", "content": "Only return the result. No yapping. No telling me \"sure, here's the summary\" or anything in that direction. ONLY return the summarized and restructured article." },
        { "role": "user", "content": `Create a ${length} word summary of the article with this title: ${title}.` },
      ],
    }

    const completion = await this.openAI.chat.completions.create(chatInput);
    const validatedCompletion = validateCompletion(completion);
    return validatedCompletion;
  }

  static getInstance() {
    if (!OpenAIService.instance) {
      OpenAIService.instance = new OpenAIService(
        API_KEY,
        API_URL,
        MODEL
      );
    }

    return OpenAIService.instance;
  }
}

const validateCompletion = (completion: ChatCompletion) => {
  if (!completion) {
    throw new Error("OpenAI completion is empty");
  }

  const { choices } = completion;

  if (choices.length === 0) {
    throw new Error("OpenAI completion has no choices");
  }

  const { message } = choices[0];

  if (!message || !message.content) {
    throw new Error("OpenAI completion has no message");
  }

  return message.content;
}

async function generateChatPrompt(article: Article, length = 50): Promise<ChatCompletionMessageParam[]> {
  const truncatedString = truncateStringToTokenCount(article.content, 100);
  return [
    { "role": "system", "content": "You are an AI that summarizes webarticles and restructures them as if they are newspaper articles." },
    { "role": "system", "content": "The articles that the user submits are formatted as markdown." },
    { "role": "system", "content": "Don't talk about the article itself, but write the summary in such a way that it can be a newspaper article on its own." },
    { "role": "system", "content": "Don't include newlines or other special characters." },
    { "role": "system", "content": "Only return the result. No yapping. No telling me \"sure, here's the summary\" or anything in that direction. ONLY return the summarized and restructured article." },
    { "role": "system", "content": "If the ONLY information in the submitted article is about cookies policy, or javascript having to be enabled to read the document, make up a summary based on the title. If that's the case, start with: 'I was unable to read the article, but here is my take:'." },
    { "role": "system", "content": "If the articles DOES have valuable information about outside of the cookie policy or javascript having to be enabled to read the document, summarize the article as if it were a newspaper article." },
    { "role": "user", "content": `Create a ${length} word summary of the following article.` },
    { "role": "user", "content": `The title of the article is ${article.title}.` },
    { "role": "user", "content": `The article is as follows: \n${truncatedString}` }
  ]
}

function truncateStringToTokenCount(value: string, maxWords: number) {
  return value.split(/\s+/).slice(0, maxWords).join(" ");
}