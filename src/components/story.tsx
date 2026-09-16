import type { StoryKind, TextColumns } from "@/lib/edition/pagemaker";
import type { Story as StoryData } from "@/lib/edition/types";
import { compose } from "@/lib/summarize/compose";
import { displayHost } from "@/lib/util/text";
import { relativeTime } from "@/lib/util/time";
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

export default function Story({ story, kind, photo, textColumns, maxWords, anchor, now }: StoryProps) {
  const summary = compose(story.analysis, { maxWords, maxSentences: 16, maxParagraphs: PARAGRAPHS[kind] });
  const host = displayHost(story.link);
  const when = relativeTime(story.published, now || undefined);
  const dateline = [story.author ? `By ${story.author}` : undefined, host, when].filter(Boolean);
  const showPhoto = photo && !!story.image;
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
          <p className="story__missing">{missingCopy(host)}</p>
        )}
      </div>
      {story.link && summary.paragraphs.length > 0 && kind !== "brief" ? (
        <p className="story__continued">
          <a href={story.link} target="_blank" rel="noopener noreferrer">
            Continued at {host ?? "the source"}
          </a>
          {story.commentsLink && story.commentsLink !== story.link ? (
            <>
              {" · "}
              <a href={story.commentsLink} target="_blank" rel="noopener noreferrer">
                Letters
              </a>
            </>
          ) : null}
        </p>
      ) : null}
    </article>
  );
}
