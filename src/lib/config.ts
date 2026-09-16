import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { normalizeConfig, toFeed, type NewzpageConfig } from "./config-schema";

export type { FeedConfig, NewzpageConfig } from "./config-schema";

export function configFile(): string {
  return process.env.NEWZPAGE_FEEDS_FILE ?? path.join(process.cwd(), "feeds.json");
}

/**
 * The default configuration handed to first-time readers: feeds.json (or the file named by
 * NEWZPAGE_FEEDS_FILE), read on every call so edits show up without a restart. NEWZPAGE_FEEDS may hold a
 * comma-separated list of URLs that replaces the file's feeds. Readers keep their own copy in the browser.
 */
export function loadConfig(): NewzpageConfig {
  const file = configFile();
  let raw: unknown = {};
  if (existsSync(/* turbopackIgnore: true */ file)) {
    try {
      raw = JSON.parse(readFileSync(/* turbopackIgnore: true */ file, "utf8"));
    } catch (error) {
      throw new Error(`Could not read the default feed configuration at ${file}: ${(error as Error).message}`);
    }
  }
  const config = normalizeConfig(raw);
  const fromEnv = (process.env.NEWZPAGE_FEEDS ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean)
    .map((url, position) => toFeed(url, position));
  return fromEnv.length > 0 ? { ...config, feeds: fromEnv } : config;
}
