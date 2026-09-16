/**
 * Builds src/lib/feeds/directory.json: the curated list below is fetched and parsed, and only feeds that
 * actually work are kept, with their own title, description and language.
 *
 *   npm run directory
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fetchFeed } from "@/lib/feeds/fetch-feed";
import { parseFeed } from "@/lib/feeds/parse-feed";
import { createLimiter } from "@/lib/util/limit";
import { collapseWhitespace } from "@/lib/util/text";

// name | url | category | language | extra tags
const CANDIDATES = `
BBC News|https://feeds.bbci.co.uk/news/rss.xml|news|en|uk britain
BBC World|https://feeds.bbci.co.uk/news/world/rss.xml|news|en|international
BBC Technology|https://feeds.bbci.co.uk/news/technology/rss.xml|tech|en|uk
BBC Science & Environment|https://feeds.bbci.co.uk/news/science_and_environment/rss.xml|science|en|environment climate
BBC Business|https://feeds.bbci.co.uk/news/business/rss.xml|business|en|uk
BBC Sport|https://feeds.bbci.co.uk/sport/rss.xml|sports|en|uk
The Guardian|https://www.theguardian.com/international/rss|news|en|uk international
The Guardian UK|https://www.theguardian.com/uk/rss|news|en|uk britain
The Guardian Technology|https://www.theguardian.com/uk/technology/rss|tech|en|
The Guardian Science|https://www.theguardian.com/science/rss|science|en|
The Guardian Football|https://www.theguardian.com/football/rss|sports|en|soccer premier league
The Guardian Environment|https://www.theguardian.com/environment/rss|environment|en|climate
The New York Times|https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml|news|en|usa america
NYT World|https://rss.nytimes.com/services/xml/rss/nyt/World.xml|news|en|international
NYT Technology|https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml|tech|en|
NYT Science|https://rss.nytimes.com/services/xml/rss/nyt/Science.xml|science|en|
The Washington Post World|https://feeds.washingtonpost.com/rss/world|news|en|usa international
Al Jazeera|https://www.aljazeera.com/xml/rss/all.xml|news|en|middle east international
NPR News|https://feeds.npr.org/1001/rss.xml|news|en|usa radio
NPR Technology|https://feeds.npr.org/1019/rss.xml|tech|en|radio
NPR Science|https://feeds.npr.org/1007/rss.xml|science|en|radio
Deutsche Welle|https://rss.dw.com/rdf/rss-en-all|news|en|germany europe international
France 24|https://www.france24.com/en/rss|news|en|france europe international
CBC News|https://www.cbc.ca/webfeed/rss/rss-topstories|news|en|canada
ABC News Australia|https://www.abc.net.au/news/feed/2942460/rss.xml|news|en|australia
The Economist|https://www.economist.com/latest/rss.xml|business|en|economics politics
Politico Europe|https://www.politico.eu/feed/|news|en|politics europe brussels eu
The Conversation|https://theconversation.com/articles.atom|science|en|academic research analysis
ProPublica|https://www.propublica.org/feeds/propublica/main|news|en|investigative journalism usa
The Intercept|https://theintercept.com/feed/?rss|news|en|investigative politics
Time|https://time.com/feed/|news|en|magazine usa
The Atlantic|https://www.theatlantic.com/feed/all/|culture|en|magazine politics ideas
The New Yorker|https://www.newyorker.com/feed/everything|culture|en|magazine essays fiction
Vox|https://www.vox.com/rss/index.xml|news|en|explainers politics
Axios|https://api.axios.com/feed/|news|en|politics business usa
Reuters via Google News|https://news.google.com/rss/search?q=site:reuters.com&hl=en-US&gl=US&ceid=US:en|news|en|international wire
The Verge|https://www.theverge.com/rss/index.xml|tech|en|gadgets
Ars Technica|https://feeds.arstechnica.com/arstechnica/index|tech|en|science policy
Wired|https://www.wired.com/feed/rss|tech|en|culture magazine
TechCrunch|https://techcrunch.com/feed/|tech|en|startups venture
Engadget|https://www.engadget.com/rss.xml|tech|en|gadgets
The Register|https://www.theregister.com/headlines.atom|tech|en|enterprise it uk
Hacker News|https://news.ycombinator.com/rss|tech|en|programming startups
Hacker News Best|https://hnrss.org/best|tech|en|programming startups
Lobsters|https://lobste.rs/rss|programming|en|links
Slashdot|https://rss.slashdot.org/Slashdot/slashdotMain|tech|en|nerds
MIT Technology Review|https://www.technologyreview.com/feed/|tech|en|science ai research
IEEE Spectrum|https://spectrum.ieee.org/feeds/feed.rss|tech|en|engineering
9to5Mac|https://9to5mac.com/feed/|tech|en|apple mac iphone
MacRumors|https://feeds.macrumors.com/MacRumors-All|tech|en|apple mac iphone
Android Police|https://www.androidpolice.com/feed/|tech|en|android google phones
Tom's Hardware|https://www.tomshardware.com/feeds/all|tech|en|hardware pc
ZDNet|https://www.zdnet.com/news/rss.xml|tech|en|enterprise
VentureBeat|https://venturebeat.com/feed/|tech|en|ai startups
Rest of World|https://restofworld.org/feed/latest/|tech|en|global society
404 Media|https://www.404media.co/rss/|tech|en|investigative internet
Techmeme|https://www.techmeme.com/feed.xml|tech|en|headlines aggregator
Krebs on Security|https://krebsonsecurity.com/feed/|security|en|
Schneier on Security|https://www.schneier.com/feed/atom/|security|en|cryptography
The Hacker News|https://feeds.feedburner.com/TheHackersNews|security|en|
BleepingComputer|https://www.bleepingcomputer.com/feed/|security|en|malware
GitHub Blog|https://github.blog/feed/|programming|en|open source git
Stack Overflow Blog|https://stackoverflow.blog/feed/|programming|en|
Cloudflare Blog|https://blog.cloudflare.com/rss/|programming|en|networking internet infrastructure
Mozilla Hacks|https://hacks.mozilla.org/feed/|programming|en|web browsers firefox
web.dev|https://web.dev/feed.xml|programming|en|web browsers chrome
CSS-Tricks|https://css-tricks.com/feed/|programming|en|css web frontend
Smashing Magazine|https://www.smashingmagazine.com/feed/|programming|en|web design frontend
A List Apart|https://alistapart.com/main/feed/|programming|en|web design
The Go Blog|https://go.dev/blog/feed.atom|programming|en|golang
Rust Blog|https://blog.rust-lang.org/feed.xml|programming|en|rust
Python Insider|https://blog.python.org/feeds/posts/default|programming|en|python
Node.js Blog|https://nodejs.org/en/feed/blog.xml|programming|en|javascript node
Julia Evans|https://jvns.ca/atom.xml|programming|en|blog linux
Simon Willison|https://simonwillison.net/atom/everything/|programming|en|blog ai python
Dan Luu|https://danluu.com/atom.xml|programming|en|blog engineering
Joel on Software|https://www.joelonsoftware.com/feed/|programming|en|blog
Coding Horror|https://blog.codinghorror.com/rss/|programming|en|blog
Martin Fowler|https://martinfowler.com/feed.atom|programming|en|architecture refactoring
Overreacted|https://overreacted.io/rss.xml|programming|en|react javascript blog
The Pragmatic Engineer|https://newsletter.pragmaticengineer.com/feed|programming|en|newsletter engineering management
Changelog|https://changelog.com/feed|programming|en|open source podcast
InfoQ|https://feed.infoq.com/|programming|en|architecture enterprise
Netflix Tech Blog|https://netflixtechblog.com/feed|programming|en|engineering
AWS News Blog|https://aws.amazon.com/blogs/aws/feed/|programming|en|cloud amazon
Vercel Blog|https://vercel.com/atom|programming|en|nextjs web
React Blog|https://react.dev/rss.xml|programming|en|react javascript
Chrome Developers|https://developer.chrome.com/feeds/blog.xml|programming|en|web browsers
LWN|https://lwn.net/headlines/rss|programming|en|linux kernel open source
Phoronix|https://www.phoronix.com/rss.php|tech|en|linux hardware open source
OMG! Ubuntu|https://www.omgubuntu.co.uk/feed|tech|en|linux ubuntu
Nature|https://www.nature.com/nature.rss|science|en|journal research
Science Daily|https://www.sciencedaily.com/rss/all.xml|science|en|research
Quanta Magazine|https://www.quantamagazine.org/feed/|science|en|mathematics physics biology
NASA|https://www.nasa.gov/feed/|space|en|
ESA Space News|https://www.esa.int/rssfeed/Our_Activities/Space_News|space|en|europe
Phys.org|https://phys.org/rss-feed/|science|en|physics research
New Scientist|https://www.newscientist.com/feed/home/|science|en|magazine
Scientific American|http://rss.sciam.com/ScientificAmerican-Global|science|en|magazine
Space.com|https://www.space.com/feeds/all|space|en|astronomy
Universe Today|https://www.universetoday.com/feed/|space|en|astronomy
Live Science|https://www.livescience.com/feeds/all|science|en|
Smithsonian Magazine|https://www.smithsonianmag.com/rss/latest_articles/|culture|en|history science museum
Eos|https://eos.org/feed|science|en|earth geoscience
Retraction Watch|https://retractionwatch.com/feed/|science|en|academia
STAT News|https://www.statnews.com/feed/|science|en|health medicine biotech
Undark|https://undark.org/feed/|science|en|society magazine
Grist|https://grist.org/feed/|environment|en|climate
Inside Climate News|https://insideclimatenews.org/feed/|environment|en|climate
Carbon Brief|https://www.carbonbrief.org/feed/|environment|en|climate policy
Yale Environment 360|https://e360.yale.edu/feed.xml|environment|en|
Aeon|https://aeon.co/feed.rss|culture|en|essays philosophy ideas
The Marginalian|https://www.themarginalian.org/feed/|culture|en|books ideas
Open Culture|https://www.openculture.com/feed|culture|en|education film books
Kottke|https://feeds.kottke.org/main|culture|en|links blog
Longreads|https://longreads.com/feed/|culture|en|essays journalism
The Paris Review|https://www.theparisreview.org/blog/feed/|culture|en|literature books
Literary Hub|https://lithub.com/feed/|culture|en|literature books
Arts & Letters Daily|https://www.aldaily.com/feed/|culture|en|essays ideas links
Boing Boing|https://boingboing.net/feed|culture|en|weird internet
Laughing Squid|https://laughingsquid.com/feed/|culture|en|art internet
Colossal|https://www.thisiscolossal.com/feed/|design|en|art photography
Hyperallergic|https://hyperallergic.com/feed/|culture|en|art
London Review of Books|https://www.lrb.co.uk/feeds/rss|culture|en|books essays
Nautilus|https://nautil.us/feed/|science|en|magazine ideas
Psyche|https://psyche.co/feed|culture|en|psychology philosophy
3 Quarks Daily|https://3quarksdaily.com/feed|culture|en|science ideas
Dezeen|https://www.dezeen.com/feed/|design|en|architecture interiors
Designboom|https://www.designboom.com/feed/|design|en|architecture art
Core77|https://www.core77.com/feed|design|en|industrial design
It's Nice That|https://www.itsnicethat.com/feed|design|en|graphic design illustration
ArchDaily|https://www.archdaily.com/rss/|design|en|architecture
Brand New|https://www.underconsideration.com/brandnew/atom.xml|design|en|branding logos
CNBC|https://www.cnbc.com/id/100003114/device/rss/rss.html|business|en|markets usa
MarketWatch|https://feeds.content.dowjones.io/public/rss/mw_topstories|business|en|markets stocks
Marginal Revolution|https://marginalrevolution.com/feed|business|en|economics blog
Calculated Risk|https://www.calculatedriskblog.com/feeds/posts/default|business|en|economics housing
Financial Times|https://www.ft.com/rss/home|business|en|markets uk
Harvard Business Review|https://feeds.hbr.org/harvardbusiness|business|en|management
Stratechery|https://stratechery.com/feed/|business|en|tech strategy
Fortune|https://fortune.com/feed/|business|en|magazine
Bits about Money|https://www.bitsaboutmoney.com/archive/rss/|business|en|finance payments
Polygon|https://www.polygon.com/rss/index.xml|gaming|en|entertainment
Kotaku|https://kotaku.com/rss|gaming|en|
Rock Paper Shotgun|https://www.rockpapershotgun.com/feed|gaming|en|pc
Eurogamer|https://www.eurogamer.net/feed|gaming|en|
PC Gamer|https://www.pcgamer.com/rss/|gaming|en|pc hardware
IGN|https://feeds.feedburner.com/ign/all|gaming|en|entertainment
Game Developer|https://www.gamedeveloper.com/rss.xml|gaming|en|programming industry
ESPN|https://www.espn.com/espn/rss/news|sports|en|usa
Sky Sports|https://www.skysports.com/rss/12040|sports|en|uk football
Cyclingnews|https://www.cyclingnews.com/rss/|sports|en|cycling bikes
Formula 1|https://www.formula1.com/en/latest/all.xml|sports|en|f1 racing motorsport
Sporza|https://sporza.be/nl.rss.articles.xml|sports|nl|voetbal wielrennen
NOS Nieuws|https://feeds.nos.nl/nosnieuwsalgemeen|news|nl|
NOS Tech|https://feeds.nos.nl/nosnieuwstech|tech|nl|
NOS Sport|https://feeds.nos.nl/nossportalgemeen|sports|nl|voetbal
NU.nl|https://www.nu.nl/rss/Algemeen|news|nl|
Tweakers|https://feeds.feedburner.com/tweakers/mixed|tech|nl|hardware
VRT NWS|https://www.vrt.be/vrtnws/nl.rss.articles.xml|news|nl|
De Standaard|https://www.standaard.be/rss|news|nl|
De Tijd|https://www.tijd.be/rss/nieuws.xml|business|nl|economie beurs
Het Laatste Nieuws|https://www.hln.be/rss.xml|news|nl|
De Morgen|https://www.demorgen.be/rss.xml|news|nl|
RTL Nieuws|https://www.rtlnieuws.nl/rss.xml|news|nl|
de Volkskrant|https://www.volkskrant.nl/voorpagina/rss.xml|news|nl|
NRC|https://www.nrc.nl/rss/|news|nl|
Trouw|https://www.trouw.nl/voorpagina/rss.xml|news|nl|
Het Parool|https://www.parool.nl/voorpagina/rss.xml|news|nl|amsterdam
Bruzz|https://www.bruzz.be/rss.xml|news|nl|brussel brussels
Knack|https://www.knack.be/rss|news|nl|magazine
Tagesschau|https://www.tagesschau.de/index~rss2.xml|news|de|
Der Spiegel|https://www.spiegel.de/schlagzeilen/index.rss|news|de|magazine
Die Zeit|https://newsfeed.zeit.de/index|news|de|
Süddeutsche Zeitung|https://rss.sueddeutsche.de/rss/Topthemen|news|de|münchen
FAZ|https://www.faz.net/rss/aktuell/|news|de|frankfurt
heise online|https://www.heise.de/rss/heise-atom.xml|tech|de|
Golem|https://rss.golem.de/rss.php?feed=RSS2.0|tech|de|
netzpolitik.org|https://netzpolitik.org/feed/|tech|de|politik digital rights
Deutsche Welle (Deutsch)|https://rss.dw.com/rdf/rss-de-all|news|de|
taz|https://taz.de/!p4608;rss/|news|de|berlin
Le Monde|https://www.lemonde.fr/rss/une.xml|news|fr|
France Info|https://www.francetvinfo.fr/titres.rss|news|fr|
Le Figaro|https://www.lefigaro.fr/rss/figaro_actualites.xml|news|fr|
Libération|https://www.liberation.fr/arc/outboundfeeds/rss-all/?outputType=xml|news|fr|
Numerama|https://www.numerama.com/feed/|tech|fr|
Courrier international|https://www.courrierinternational.com/feed/all/rss.xml|news|fr|international
RFI|https://www.rfi.fr/fr/rss|news|fr|radio international
RTBF Info|https://www.rtbf.be/rss/info|news|fr|belgique
Le Temps|https://www.letemps.ch/articles.rss|news|fr|suisse
xkcd|https://xkcd.com/atom.xml|comics|en|science humor
Saturday Morning Breakfast Cereal|https://www.smbc-comics.com/comic/rss|comics|en|science humor
PetaPixel|https://petapixel.com/feed/|culture|en|photography cameras
Pitchfork|https://pitchfork.com/feed/feed-news/rss|entertainment|en|music
Stereogum|https://www.stereogum.com/feed/|entertainment|en|music
IndieWire|https://www.indiewire.com/feed/|entertainment|en|film
/Film|https://www.slashfilm.com/feed/|entertainment|en|film movies
Deadline|https://deadline.com/feed/|entertainment|en|hollywood film tv
Variety|https://variety.com/feed/|entertainment|en|hollywood film tv
Astral Codex Ten|https://www.astralcodexten.com/feed|culture|en|essays rationality
Wait But Why|https://waitbutwhy.com/feed|culture|en|essays
Farnam Street|https://fs.blog/feed/|culture|en|thinking mental models
Seth Godin|https://seths.blog/feed/|business|en|marketing blog
Paul Graham Essays|http://www.aaronsw.com/2002/feeds/pgessays.rss|business|en|startups essays
Cal Newport|https://calnewport.com/feed/|culture|en|productivity
Daring Fireball|https://daringfireball.net/feeds/main|tech|en|apple blog
Six Colors|https://sixcolors.com/feed/|tech|en|apple
Waxy|https://waxy.org/feed/|culture|en|internet links
Pluralistic|https://pluralistic.net/feed/|tech|en|cory doctorow policy
Metafilter|https://feeds.feedburner.com/Metafilter|culture|en|links community
Wikipedia Current Events|https://en.wikipedia.org/w/api.php?action=featuredfeed&feed=onthisday&feedformat=atom|culture|en|history
`;

const CATEGORY_TAGS: Record<string, string> = {
  news: "news world headlines newspaper",
  tech: "technology tech gadgets computers",
  programming: "programming software developers coding engineering",
  science: "science research",
  space: "space astronomy science",
  environment: "environment climate energy nature",
  culture: "culture ideas essays books art",
  design: "design architecture art",
  business: "business economics finance markets money",
  gaming: "gaming games video",
  sports: "sports sport",
  security: "security infosec cybersecurity privacy hacking",
  entertainment: "entertainment film movies music tv",
  comics: "comics webcomic humor",
};

const LANGUAGE_TAGS: Record<string, string> = {
  en: "english",
  nl: "dutch nederlands netherlands nederland belgium belgië belgie vlaanderen flanders",
  de: "german deutsch germany deutschland",
  fr: "french français francais france",
};

interface DirectoryEntry {
  name: string;
  url: string;
  site: string;
  description: string;
  language: string;
  category: string;
  tags: string[];
}

const limit = createLimiter(8);

async function validate(line: string): Promise<DirectoryEntry | { failed: string }> {
  const [name, url, category, language, extra = ""] = line.split("|").map((part) => part.trim());
  try {
    const response = await fetchFeed(url, { timeoutMs: 15_000 });
    if (response.status !== "ok") throw new Error("not modified without cache");
    const feed = parseFeed(response.xml);
    if (feed.items.length === 0) throw new Error("feed has no items");
    const site = new URL(feed.link && /^https?:/.test(feed.link) ? feed.link : url).hostname.replace(/^www\./, "");
    const description = collapseWhitespace(feed.description ?? "");
    const lang = (feed.language ?? language).toLowerCase().split(/[-_]/)[0] || language;
    const tags = new Set([...(CATEGORY_TAGS[category] ?? "").split(" "), ...(LANGUAGE_TAGS[lang] ?? "").split(" "), ...extra.split(" ")].filter(Boolean));
    return {
      name,
      url,
      site,
      description: description.toLowerCase() === name.toLowerCase() ? "" : description.slice(0, 180),
      language: lang,
      category,
      tags: [...tags],
    };
  } catch (error) {
    return { failed: `${name} (${url}): ${(error as Error).message}` };
  }
}

async function main() {
  const lines = CANDIDATES.split("\n").map((line) => line.trim()).filter(Boolean);
  const results = await Promise.all(lines.map((line) => limit(() => validate(line))));
  const entries = results.filter((result): result is DirectoryEntry => !("failed" in result));
  const failures = results.filter((result): result is { failed: string } => "failed" in result);
  entries.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  const target = path.join(process.cwd(), "src/lib/feeds/directory.json");
  writeFileSync(target, `${JSON.stringify(entries, null, 2)}\n`);
  console.log(`Kept ${entries.length} of ${lines.length} feeds → ${path.relative(process.cwd(), target)}`);
  for (const failure of failures) console.log(`  dropped: ${failure.failed}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
