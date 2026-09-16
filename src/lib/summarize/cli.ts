/**
 * Try the summariser on any article without running the site:
 *   npm run summarize -- https://example.com/some-article --words 120
 */
import { extractArticle } from "@/lib/articles/extract";
import { fetchPage } from "@/lib/articles/fetch-page";
import { chooseImage } from "@/lib/articles/images";
import { analyze, compose } from "@/lib/summarize";

async function main() {
  const args = process.argv.slice(2);
  const url = args.find((arg) => !arg.startsWith("--"));
  const wordsFlag = args.indexOf("--words");
  const maxWords = wordsFlag >= 0 ? Number(args[wordsFlag + 1]) || 120 : 120;
  if (!url) {
    console.error("Usage: npm run summarize -- <url> [--words 120]");
    process.exit(2);
  }

  const started = performance.now();
  const page = await fetchPage(url);
  const fetched = performance.now();
  const extracted = await extractArticle(page.html, page.finalUrl);
  const extractedAt = performance.now();
  const analysis = analyze(extracted.paragraphs, { title: extracted.title, langHint: extracted.lang });
  const analysed = performance.now();
  const summary = compose(analysis, { maxWords });

  console.log(`Title:     ${extracted.title ?? "(none)"}`);
  console.log(`Byline:    ${extracted.byline ?? "(none)"}`);
  console.log(`Language:  ${analysis.lang}${extracted.lang ? ` (declared ${extracted.lang})` : ""}`);
  console.log(`Text:      ${extracted.wordCount} words, ${analysis.totalSentences} sentences, ${extracted.paragraphs.length} paragraphs`);
  console.log(`Image:     ${chooseImage(extracted.images)?.url ?? "(none)"} (${extracted.images.length} candidates)`);
  console.log(
    `Timing:    fetch ${Math.round(fetched - started)}ms, extract ${Math.round(extractedAt - fetched)}ms, analyse ${Math.round(analysed - extractedAt)}ms`,
  );
  console.log(`\nSummary (${summary.words} words, ${summary.sentences} sentences):\n`);
  for (const paragraph of summary.paragraphs) console.log(`  ${paragraph}\n`);
  console.log("Top sentences:");
  for (const index of analysis.pick.slice(0, 5)) {
    const sentence = analysis.sentences.find((s) => s.i === index);
    if (sentence) console.log(`  ${sentence.score.toFixed(3)}  #${sentence.i}  ${sentence.text}`);
  }
}

main().catch((error) => {
  console.error(`Failed: ${(error as Error).message}`);
  process.exit(1);
});
