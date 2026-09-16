export type SupportedLanguage = "en" | "nl" | "de" | "fr";

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ["en", "nl", "de", "fr"];

const toSet = (words: string) => new Set(words.split(/\s+/).filter(Boolean));

const STOPWORDS: Record<SupportedLanguage, Set<string>> = {
  en: toSet(`
    a about above after again against all almost also although am among an and another any anyone anything are around
    as at back be became because become been before being below between both but by can cannot could did do does doing
    done down during each either else even ever every few for from further get gets got had has have having he her here
    hers herself him himself his how however i if in into is it its itself just least less let like made make many may me
    might more most much must my myself never no nor not nothing now of off often on once one only or other others our
    ours ourselves out over own per rather said same say says she should since so some someone something still such than
    that the their theirs them themselves then there therefore these they this those though through thus to too under
    until up upon us use used very via was we well were what whatever when where whether which while who whom whose why
    will with within without would yes yet you your yours yourself yourselves mr mrs ms dr according told
  `),
  nl: toSet(`
    aan al alle alles als altijd andere ben bij daar dan dat de der deze die dit doch doen door dus een eens en er ge geen
    geweest haar had heb hebben heeft hem het hier hij hoe hun iemand iets ik in is ja je kan kon kunnen maar me meer men
    met mij mijn moet na naar niet niets nog nu of om omdat onder ons ook op over reeds te tegen toch toen tot u uit uw
    van veel voor want waren was wat we wel werd wezen wie wil worden wordt zal ze zei zelf zich zij zijn zo zonder zou
    zegt volgens
  `),
  de: toSet(`
    aber alle allem allen aller alles als also am an ander andere anderem anderen anderer anderes anderm andern anders
    auch auf aus bei bin bis bist da damit dann der den des dem die das daß dass derselbe derselben denselben desselben
    demselben dieselbe dieselben dasselbe dazu dein deine deinem deinen deiner deines denn derer dessen dich dir du dies
    diese diesem diesen dieser dieses doch dort durch ein eine einem einen einer eines einig einige einigem einigen
    einiger einiges einmal er ihn ihm es etwas euer eure eurem euren eurer eures für gegen gewesen hab habe haben hat
    hatte hatten hier hin hinter ich mich mir ihr ihre ihrem ihren ihrer ihres euch im in indem ins ist jede jedem jeden
    jeder jedes jene jenem jenen jener jenes jetzt kann kein keine keinem keinen keiner keines können könnte machen man
    manche manchem manchen mancher manches mein meine meinem meinen meiner meines mit muss musste nach nicht nichts noch
    nun nur ob oder ohne sehr sein seine seinem seinen seiner seines selbst sich sie ihnen sind so solche solchem solchen
    solcher solches soll sollte sondern sonst über um und uns unse unsem unsen unser unses unter viel vom von vor während
    war waren warst was weg weil weiter welche welchem welchen welcher welches wenn werde werden wie wieder will wir wird
    wirst wo wollen wollte würde würden zu zum zur zwar zwischen sagte sagt laut
  `),
  fr: toSet(`
    au aux avec ce ces dans de des du elle en et eux il ils je la le les leur lui ma mais me même mes moi mon ne nos
    notre nous on ou par pas pour qu que qui sa se ses son sur ta te tes toi ton tu un une vos votre vous c d j l à m n
    s t y été étée étées étés étant suis es est sommes êtes sont serai seras sera serons serez seront serais serait
    serions seriez seraient étais était étions étiez étaient fus fut fûmes fûtes furent sois soit soyons soyez soient
    fusse fusses fût fussions fussiez fussent ayant eu eue eues eus ai as avons avez ont aurai auras aura aurons aurez
    auront aurais aurait aurions auriez auraient avais avait avions aviez avaient eut eûmes eûtes eurent aie aies ait
    ayons ayez aient eusse eusses eût eussions eussiez eussent cette cet ceci cela celui celle ceux celles dont où plus
    très aussi comme bien tout tous toute toutes fait faire selon entre après avant sans sous vers chez alors ainsi
    encore déjà dit
  `),
};

/** Words that make an extracted sentence read badly on its own, because they point back to a previous sentence. */
export const ANAPHORIC_STARTS: Record<SupportedLanguage, Set<string>> = {
  en: toSet("he she it they this that these those however but and also still such there here i we you yet meanwhile instead"),
  nl: toSet("hij zij ze het dit dat deze die maar en ook er toch daarom bovendien"),
  de: toSet("er sie es das dies diese dieser aber und auch doch dennoch außerdem"),
  fr: toSet("il elle ils elles ce cela mais et aussi ça pourtant cependant"),
};

export function isStopword(word: string, lang: SupportedLanguage): boolean {
  return STOPWORDS[lang].has(word);
}

export function isSupportedLanguage(lang: string | undefined | null): lang is SupportedLanguage {
  return !!lang && (SUPPORTED_LANGUAGES as string[]).includes(lang);
}

/** Normalises values such as "en-GB" or "nl_BE" to a supported language code, if any. */
export function normalizeLanguage(lang: string | undefined | null): SupportedLanguage | undefined {
  if (!lang) return undefined;
  const base = lang.toLowerCase().split(/[-_]/)[0];
  return isSupportedLanguage(base) ? base : undefined;
}

/**
 * Detects the language of a token list by counting stopword hits per language.
 * A declared language wins when it is nearly as plausible as the best guess.
 */
export function detectLanguage(tokens: string[], hint?: string): SupportedLanguage {
  const declared = normalizeLanguage(hint);
  if (tokens.length < 20) return declared ?? "en";

  const ratios = SUPPORTED_LANGUAGES.map((lang) => {
    let hits = 0;
    for (const token of tokens) if (STOPWORDS[lang].has(token)) hits++;
    return { lang, ratio: hits / tokens.length };
  });
  ratios.sort((a, b) => b.ratio - a.ratio);
  const best = ratios[0];

  if (best.ratio < 0.08) return declared ?? "en";
  if (declared) {
    const declaredRatio = ratios.find((entry) => entry.lang === declared)?.ratio ?? 0;
    if (declaredRatio >= best.ratio * 0.7) return declared;
  }
  return best.lang;
}
