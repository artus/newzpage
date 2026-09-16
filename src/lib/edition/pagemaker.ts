import { fnv1a, seededRandom } from "@/lib/util/hash";
import type { Story } from "./types";

/**
 * The page maker. A section is set in full-width bands; each band is cut into slots of varying column
 * spans (patterns drawn with a seed from the story ids, so a page looks the same on every reload); a slot
 * holds one story or a short stack. Word budgets are estimated so every slot in a band reaches the same
 * height, and `fitBudgets` corrects them from the heights the browser actually renders.
 */

export type StoryKind = "lead" | "feature" | "standard" | "brief";
export type TextColumns = 1 | 2 | 3;

export interface PlacedStory {
  story: Story;
  kind: StoryKind;
  photo: boolean;
  /** Word budget for the summary. */
  budget: number;
  textColumns: TextColumns;
  /** The story that sets its band's height: the lead, or the anchor of a later band. Never cut to fit. */
  anchor?: boolean;
}

export interface Slot {
  span: number;
  stories: PlacedStory[];
  /** Under about 260px justified text shows rivers, so narrow blocks are set ragged-right. */
  narrow?: boolean;
}

export interface Band {
  /** Estimated height in px; the fitter replaces it with the measured one. */
  target: number;
  slots: Slot[];
}

export interface PagePlan {
  columns: number;
  bands: Band[];
}

export interface PageOptions {
  /** Width of the section in px. */
  width: number;
  columns: number;
  gutter?: number;
  seed?: number;
}

/** Typographic estimates in px at the 16px body size, calibrated against the real fonts. */
export const METRICS = {
  line: 22.7,
  /** Average width of a word with its space, including justification waste. */
  wordPx: 52,
  headlineCharEm: 0.5,
  headlineLine: 1.12,
  dateline: 26,
  tail: 24,
  padding: 14,
  /** Between stacked stories: gap, rule and padding. */
  gap: 30,
  columnGap: 24,
  caption: 22,
};

const HEADLINE_PX: Record<StoryKind, number> = { lead: 40, feature: 20.5, standard: 17.3, brief: 15.7 };
const NATURAL_BUDGET = { lead: 170, leadWithPhoto: 130, wide: 150, double: 110, single: 80 };
const MIN_WORDS = 20;
const MAX_STACK = 3;
const MIN_BAND = 240;
const MAX_BAND = 560;

const PATTERNS: Record<number, number[][]> = {
  6: [[3, 2, 1], [2, 3, 1], [1, 3, 2], [2, 2, 2], [2, 1, 3], [1, 2, 3], [4, 2], [2, 4], [3, 3], [2, 2, 1, 1], [1, 1, 2, 2], [1, 2, 2, 1], [2, 1, 1, 2]],
  5: [[3, 2], [2, 3], [2, 2, 1], [1, 2, 2], [2, 1, 2], [3, 1, 1], [1, 1, 3]],
  4: [[2, 1, 1], [1, 2, 1], [1, 1, 2], [2, 2], [3, 1], [1, 3]],
  3: [[2, 1], [1, 2], [1, 1, 1]],
  2: [[1, 1], [2]],
  1: [[1]],
};

export function columnsFor(width: number): number {
  if (width >= 1100) return 6;
  if (width >= 820) return 4;
  if (width >= 600) return 3;
  if (width >= 430) return 2;
  return 1;
}

interface Geometry {
  width: number;
  columns: number;
  gutter: number;
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

function blockWidth(span: number, g: Geometry): number {
  const column = (g.width - (g.columns - 1) * g.gutter) / g.columns;
  return span * column + (span - 1) * g.gutter;
}

export function textColumnsFor(span: number, columns: number): TextColumns {
  if (columns >= 4 && span >= columns) return 3;
  if (span >= 3) return 2;
  return 1;
}

function wordsPerLine(span: number, textColumns: TextColumns, g: Geometry): number {
  const width = (blockWidth(span, g) - (textColumns - 1) * METRICS.columnGap) / textColumns;
  return Math.max(3, width / METRICS.wordPx);
}

export function textHeight(words: number, span: number, textColumns: TextColumns, g: Geometry): number {
  if (words <= 0) return 0;
  const lines = Math.ceil(words / wordsPerLine(span, textColumns, g));
  return Math.ceil(lines / textColumns) * METRICS.line;
}

export function wordsForHeight(height: number, span: number, textColumns: TextColumns, g: Geometry): number {
  if (height <= 0) return 0;
  const lines = Math.floor(height / METRICS.line) * textColumns;
  return Math.floor(lines * wordsPerLine(span, textColumns, g));
}

function headlineHeight(title: string, kind: StoryKind, span: number, g: Geometry): number {
  if (kind === "brief") return 0; // run-in headline, counted with the text
  const px = HEADLINE_PX[kind];
  const perLine = Math.max(6, blockWidth(span, g) / (px * METRICS.headlineCharEm));
  const lines = Math.max(1, Math.ceil(title.length / perLine));
  return lines * px * METRICS.headlineLine + 6;
}

function photoHeight(kind: StoryKind, span: number, g: Geometry): number {
  const width = blockWidth(span, g);
  const wide = kind === "lead" || span >= 3;
  return (wide ? (width * 9) / 16 : (width * 2) / 3) + METRICS.caption + 10;
}

export function fixedHeight(placed: Pick<PlacedStory, "story" | "kind" | "photo">, span: number, g: Geometry): number {
  const { story, kind, photo } = placed;
  return (
    headlineHeight(story.title, kind, span, g) +
    (kind === "brief" ? 0 : METRICS.dateline) +
    (photo ? photoHeight(kind, span, g) : 0) +
    (story.link && kind !== "brief" ? METRICS.tail : 0) +
    METRICS.padding
  );
}

const titleWords = (story: Story) => Math.ceil(story.title.length / 6);

export function estimateHeight(placed: PlacedStory, span: number, g: Geometry): number {
  const words = placed.budget + (placed.kind === "brief" ? titleWords(placed.story) : 0);
  return fixedHeight(placed, span, g) + textHeight(words, span, placed.textColumns, g);
}

/** Words the summariser can supply for a story. */
export function availableWords(story: Story): number {
  return story.analysis ? story.analysis.sentences.reduce((sum, sentence) => sum + sentence.words, 0) : 0;
}

const sentenceCount = (story: Story) => story.analysis?.sentences.length ?? 0;

export const hasPhoto = (story: Story) => !!story.image && sentenceCount(story) >= 2;

const richness = (story: Story) => Math.min(sentenceCount(story), 12) + (story.image ? 4 : 0);

/** The lead is the first story that can carry it: enough text, ideally a photograph. */
export function pickLead(stories: Story[]): number {
  const window = stories.slice(0, 3);
  const withPhoto = window.findIndex((story) => hasPhoto(story) && sentenceCount(story) >= 3);
  if (withPhoto >= 0) return withPhoto;
  const withText = window.findIndex((story) => sentenceCount(story) >= 3);
  return withText >= 0 ? withText : 0;
}

function choosePattern(total: number, random: () => number, available: number, previous?: number[]): number[] {
  const all = PATTERNS[total] ?? [[total]];
  let pool = all.filter((pattern) => pattern.length <= Math.max(1, available));
  if (pool.length === 0) pool = [[total]];
  if (previous && pool.length > 1) {
    const different = pool.filter((pattern) => pattern.join() !== previous.join());
    if (different.length > 0) pool = different;
  }
  return pool[Math.floor(random() * pool.length)];
}

type PhotoBudget = (story: Story, wanted: boolean) => boolean;

/**
 * Fills a slot up to the band's target height: the head story (given, or taken from the queue), then more
 * stories from the queue while the estimated capacity falls short. Budgets are split over the stack.
 */
function fillSlot(
  queue: Story[],
  span: number,
  target: number,
  g: Geometry,
  random: () => number,
  claimPhoto: PhotoBudget,
  head?: PlacedStory,
): Slot | undefined {
  if (!head && queue.length === 0) return undefined;
  const textColumns = textColumnsFor(span, g.columns);
  const stories: PlacedStory[] = [];
  let fixed = 0;
  const capacity = () => fixed + stories.reduce((sum, item) => sum + textHeight(availableWords(item.story), span, textColumns, g), 0);
  if (head) {
    stories.push(head);
    fixed += fixedHeight(head, span, g);
  }
  while (queue.length > 0 && stories.length < MAX_STACK && capacity() < target) {
    const story = queue.shift()!;
    const first = stories.length === 0;
    const kind: StoryKind = first && span >= 2 ? "feature" : "standard";
    const alone = fixedHeight({ story, kind, photo: false }, span, g) + textHeight(availableWords(story), span, textColumns, g);
    const wanted = first && (span >= 2 ? random() < 0.8 : alone < target * 0.85 && random() < 0.6);
    const placed: PlacedStory = { story, kind, photo: claimPhoto(story, wanted), budget: 0, textColumns };
    stories.push(placed);
    fixed += fixedHeight(placed, span, g) + (first ? 0 : METRICS.gap);
  }
  const room = Math.max(0, target - fixed);
  const words = stories.map((placed) => availableWords(placed.story));
  const total = words.reduce((sum, count) => sum + count, 0);
  stories.forEach((placed, index) => {
    const share = total > 0 ? words[index] / total : 1 / stories.length;
    const wanted = wordsForHeight(room * share, span, textColumns, g);
    const floor = Math.min(MIN_WORDS, words[index] || MIN_WORDS);
    placed.budget = clamp(Math.max(wanted, placed === head ? placed.budget : 0), floor, Math.max(words[index], MIN_WORDS));
    if (index > 0 && placed.budget < 45) placed.kind = "brief";
  });
  return { span, stories, narrow: blockWidth(span, g) < 260 };
}

/** A band whose slots do not reach the full width gets its last slot widened. */
function compact(band: Band, columns: number): Band {
  const used = band.slots.reduce((sum, slot) => sum + slot.span, 0);
  if (used < columns && band.slots.length > 0) {
    const last = band.slots[band.slots.length - 1];
    last.span += columns - used;
    last.narrow = false;
    const textColumns = textColumnsFor(last.span, columns);
    for (const placed of last.stories) {
      placed.textColumns = textColumns;
      if (placed.kind === "standard" && last.span >= 2 && placed === last.stories[0]) placed.kind = "feature";
    }
  }
  return band;
}

export function planPage(stories: Story[], options: PageOptions): PagePlan {
  const columns = Math.max(1, Math.floor(options.columns));
  const g: Geometry = { width: Math.max(280, options.width), columns, gutter: options.gutter ?? 24 };
  if (stories.length === 0) return { columns, bands: [] };
  const random = seededRandom(options.seed ?? fnv1a(stories.map((story) => story.id).join("|")));
  let photos = Math.max(1, Math.ceil(stories.length / 3));
  const claimPhoto: PhotoBudget = (story, wanted) => {
    if (!wanted || !hasPhoto(story) || photos <= 0) return false;
    photos--;
    return true;
  };

  if (columns === 1) {
    return {
      columns,
      bands: stories.map((story, index) => {
        const kind: StoryKind = index === 0 ? "lead" : sentenceCount(story) >= 3 ? "standard" : "brief";
        const budget = Math.max(MIN_WORDS, Math.min(kind === "lead" ? 150 : kind === "brief" ? 40 : 70, availableWords(story) || MIN_WORDS));
        return { target: 0, slots: [{ span: 1, stories: [{ story, kind, photo: claimPhoto(story, index === 0 || index % 4 === 2), budget, textColumns: 1 }] }] };
      }),
    };
  }

  const queue = [...stories];
  const lead = queue.splice(pickLead(queue), 1)[0];
  const leadSpan = columns >= 6 ? 3 : columns >= 3 ? 2 : columns;
  const leadPhoto = claimPhoto(lead, true);
  const leadPlaced: PlacedStory = {
    story: lead,
    kind: "lead",
    photo: leadPhoto,
    budget: Math.max(MIN_WORDS, Math.min(leadPhoto ? NATURAL_BUDGET.leadWithPhoto : NATURAL_BUDGET.lead, availableWords(lead) || MIN_WORDS)),
    textColumns: textColumnsFor(leadSpan, columns),
    anchor: true,
  };
  const bands: Band[] = [];
  // The lead package sets the height of the first band; a broadsheet lead may run tall.
  const first: Band = {
    target: clamp(estimateHeight(leadPlaced, leadSpan, g), 260, 900),
    slots: [{ span: leadSpan, stories: [leadPlaced], narrow: blockWidth(leadSpan, g) < 260 }],
  };
  let previous: number[] | undefined;
  if (columns - leadSpan > 0) {
    previous = choosePattern(columns - leadSpan, random, queue.length);
    for (const span of previous) {
      const slot = fillSlot(queue, span, first.target, g, random, claimPhoto);
      if (slot) first.slots.push(slot);
    }
  }
  bands.push(compact(first, columns));

  while (queue.length > 0) {
    const pattern = choosePattern(columns, random, queue.length, previous);
    previous = pattern;
    const widest = Math.max(...pattern);
    const widestIndex = pattern.indexOf(widest);
    const lookahead = Math.min(queue.length, pattern.length + 2);
    let anchorAt = 0;
    for (let i = 1; i < lookahead; i++) if (richness(queue[i]) > richness(queue[anchorAt])) anchorAt = i;
    const anchor = queue.splice(anchorAt, 1)[0];
    const textColumns = textColumnsFor(widest, columns);
    const natural = widest >= 3 ? NATURAL_BUDGET.wide : widest === 2 ? NATURAL_BUDGET.double : NATURAL_BUDGET.single;
    const anchorPlaced: PlacedStory = {
      story: anchor,
      kind: widest >= 2 ? "feature" : "standard",
      photo: claimPhoto(anchor, widest >= 2 || random() < 0.4),
      budget: Math.max(MIN_WORDS, Math.min(natural, availableWords(anchor) || MIN_WORDS)),
      textColumns,
      anchor: true,
    };
    const target = clamp(estimateHeight(anchorPlaced, widest, g), MIN_BAND, MAX_BAND);
    const band: Band = { target, slots: [] };
    pattern.forEach((span, index) => {
      // The anchor slot also stacks when the anchor alone cannot reach the band height.
      const slot = index === widestIndex ? fillSlot(queue, span, target, g, random, claimPhoto, anchorPlaced) : fillSlot(queue, span, target, g, random, claimPhoto);
      if (slot) band.slots.push(slot);
    });
    bands.push(compact(band, columns));
  }
  return { columns, bands };
}

export interface MeasuredStory {
  id: string;
  budget: number;
  /** Words actually printed. */
  words: number;
  bodyHeight: number;
  /** True when the summariser has no more sentences for this story. */
  exhausted: boolean;
  /** The smallest budget that prints one more sentence. */
  nextWords?: number;
  /** Anchors set the band height and are only cut when the band exceeds the ceiling. */
  anchor?: boolean;
}

export interface MeasuredSlot {
  /** Rendered height of the slot's content. */
  height: number;
  stories: MeasuredStory[];
}

export interface FitResult {
  budgets: Record<string, number>;
  changed: boolean;
  target: number;
}

/**
 * Copy-fitting from measured heights. The band height is chosen so that no slot is left with a hole it
 * cannot fill: it is the second-tallest slot, lowered to the shortest slot that has run out of copy, but
 * never below what any slot needs for its fixed parts and a minimum of copy, never below an anchor's own
 * height, and never above `maxHeight`. Taller slots lose copy in proportion; shorter slots gain it one
 * sentence at a time, asking exactly for the budget the next sentence needs.
 */
export function fitBudgets(slots: MeasuredSlot[], options: { maxHeight?: number; tolerance?: number } = {}): FitResult {
  const maxHeight = options.maxHeight ?? 600;
  const tolerance = options.tolerance ?? 12;
  const budgets: Record<string, number> = {};
  let changed = false;
  if (slots.length === 0) return { budgets, changed, target: 0 };
  // Height per word from what was measured; tiny samples (a one-line blurb) are too noisy, so they get a typical value.
  const pxPerWord = (story: MeasuredStory) => (story.words >= 15 && story.bodyHeight > 0 ? clamp(story.bodyHeight / story.words, 1.2, 8) : 3.5);
  const isAnchor = (slot: MeasuredSlot) => slot.stories.some((story) => story.anchor);
  const floorOf = (slot: MeasuredSlot) =>
    isAnchor(slot)
      ? slot.height
      : slot.height - slot.stories.reduce((sum, story) => sum + Math.max(0, story.bodyHeight - Math.min(story.words, MIN_WORDS) * pxPerWord(story)), 0);
  const canGrow = (slot: MeasuredSlot) => slot.stories.some((story) => !story.exhausted && story.nextWords !== undefined);

  const heights = slots.map((slot) => slot.height).sort((a, b) => b - a);
  const second = heights[1] ?? heights[0];
  const floor = Math.max(...slots.map(floorOf));
  const ceiling = Math.min(...slots.map((slot) => (canGrow(slot) ? Infinity : slot.height)));
  // The floor includes every anchor's own height, so an anchor is never cut and the band takes its size.
  const target = Math.max(floor, Math.min(second, ceiling, maxHeight));

  for (const slot of slots) {
    const excess = slot.height - target;
    if (excess > tolerance && !isAnchor(slot)) {
      const text = slot.stories.reduce((sum, story) => sum + story.bodyHeight, 0);
      for (const story of slot.stories) {
        const cut = text > 0 ? excess * (story.bodyHeight / text) : excess / slot.stories.length;
        const next = Math.max(Math.min(MIN_WORDS, story.words), Math.floor(story.words - cut / pxPerWord(story)));
        if (next < story.budget) {
          budgets[story.id] = next;
          changed = true;
        }
      }
      continue;
    }
    const slack = target - slot.height;
    if (slack <= tolerance) continue;
    let room = slack;
    for (const story of slot.stories) {
      if (story.exhausted || story.nextWords === undefined) continue;
      const sentence = Math.max(1, story.nextWords - story.words) * pxPerWord(story);
      if (sentence > room * 1.15 + 12) continue; // that sentence would overshoot the band
      budgets[story.id] = Math.max(budgets[story.id] ?? 0, story.nextWords);
      changed = true;
      room -= sentence;
    }
  }
  return { budgets, changed, target };
}
