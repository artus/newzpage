import type { Wire } from "@/lib/client/scrapbook";
import type { StoryKind, TextColumns } from "@/lib/edition/pagemaker";
import { hasCopy, type Story as StoryData } from "@/lib/edition/types";
import { compose } from "@/lib/summarize/compose";
import { displayHost } from "@/lib/util/text";
import { relativeTime } from "@/lib/util/time";
import ClipButton from "./clip-button";
import EnvelopeIcon from "./envelope-icon";
import Photo from "./photo";

const PARAGRAPHS: Record<StoryKind, number> = { lead: 4, feature: 3, standard: 2, brief: 1 };

interface StoryProps {
  story: StoryData;
  kind: StoryKind;
  photo: boolean;
  textColumns: TextColumns;
  /** Word budget for the summary; the band adjusts it to make the copy fit. */
  maxWords: number;
  anchor?: boolean;
  now: number;
  /** The wire the story is printed under; recorded when it is clipped. */
  wire?: Wire;
}

/** Alt text is only a caption when it reads like one; "palma3_1" or "image" is not. */
function captionFor(alt: string | undefined, host: string | undefined): string | undefined {
  const words = alt ? alt.trim().split(/\s+/) : [];
  const readable = words.length >= 3 && alt!.length <= 160 && !/[_\/]|\.(jpe?g|png|webp|gif)$/i.test(alt!);
  if (readable) return alt!.trim();
  return host ? `Photograph: ${host}` : undefined;
}

function missingCopy(host: string | undefined): string {
  const tail = host ? ` The full account is at ${host}.` : "";
  return `No wire copy reached the composing room in time for this edition.${tail}`;
}

export default function Story({ story, kind, photo, textColumns, maxWords, anchor, now, wire }: StoryProps) {
  const summary = compose(story.analysis, { maxWords, maxSentences: 16, maxParagraphs: PARAGRAPHS[kind] });
  const host = displayHost(story.link);
  const when = relativeTime(story.published, now || undefined);
  const dateline = [story.author ? `By ${story.author}` : undefined, story.wire ?? host, when].filter(Boolean);
  const showPhoto = photo && !!story.image;
  const letters = story.commentsLink && story.commentsLink !== story.link ? story.commentsLink : undefined;
  // Only a story with copy is worth clipping; a placeholder has nothing to keep.
  const clippable = hasCopy(story);
  const lettersLabel = "Letters to the editor: the comments";
  const classes = ["story", `story--${kind}`, `story--text-${textColumns}`, showPhoto ? "story--photo" : undefined].filter(Boolean).join(" ");

  return (
    <article
      className={classes}
      lang={story.lang}
      data-id={story.id}
      data-budget={maxWords}
      data-words={summary.words}
      data-exhausted={summary.exhausted ? "true" : "false"}
      data-next={summary.nextWords}
      data-anchor={anchor ? "true" : undefined}
    >
      <h3 className="story__headline">
        {story.link ? (
          <a href={story.link} target="_blank" rel="noopener noreferrer">
            {story.title}
          </a>
        ) : (
          story.title
        )}
      </h3>
      {dateline.length > 0 && kind !== "brief" ? (
        <p className="story__dateline">
          {dateline.map((part, index) => (
            <span key={index}>
              {index > 0 ? " · " : ""}
              {part}
            </span>
          ))}
        </p>
      ) : null}
      {showPhoto && story.image ? <Photo src={story.image.url} alt={story.image.alt} caption={captionFor(story.image.alt, host)} /> : null}
      <div className="story__body">
        {summary.paragraphs.length > 0 ? (
          summary.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
        ) : (
          <p className="story__missing" title={story.error ? `Reason: ${story.error}` : undefined}>
            {missingCopy(host)}
          </p>
        )}
      </div>
      {/* The headline already leads to the original; the foot carries only what it does not: the scissors and the letters. */}
      {kind !== "brief" && (clippable || letters) ? (
        <p className="story__continued">
          {clippable ? <ClipButton story={story} wire={wire} /> : null}
          {letters ? (
            <a className="story__glyph tip" href={letters} target="_blank" rel="noopener noreferrer" aria-label={lettersLabel} data-tip={lettersLabel}>
              <EnvelopeIcon />
            </a>
          ) : null}
        </p>
      ) : null}
      {kind === "brief" && clippable ? (
        <>
          {" "}
          <ClipButton story={story} wire={wire} className="story__clip--brief" />
        </>
      ) : null}
      {kind === "brief" && letters ? (
        <>
          {" "}
          <a className="story__glyph story__glyph--brief tip" href={letters} target="_blank" rel="noopener noreferrer" aria-label={lettersLabel} data-tip={lettersLabel}>
            <EnvelopeIcon />
          </a>
        </>
      ) : null}
    </article>
  );
}
