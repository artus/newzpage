import Link from "next/link";
import type { ReaderStats } from "@/lib/client/reader-stats";
import { volumeOf } from "@/lib/client/reader-stats";
import { longDate, roman } from "@/lib/util/time";
import CogIcon from "./cog-icon";
import DiceIcon from "./dice-icon";

interface MastheadProps {
  title: string;
  tagline: string;
  /** Undefined until the edition is composed in the browser; the shell prints blanks meanwhile. */
  date?: Date;
  feedCount: number;
  /** This reader's own record: editions printed in this browser, and since when. */
  reader?: ReaderStats;
}

function ordinal(n: number): string {
  const rest = n % 100;
  const suffix = rest >= 11 && rest <= 13 ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th";
  return `${n.toLocaleString("en-GB")}${suffix}`;
}

/**
 * Traditional Gothic sets every letter as a wide capital, about 1.25em each. Sizing the title from its
 * length keeps any name on one line without JavaScript: the browser resolves the vw expression itself.
 */
function titleSize(title: string): string {
  const characters = Math.max(4, title.length);
  return `clamp(1.6rem, ${(92 / (characters * 1.3)).toFixed(2)}vw, 7.2rem)`;
}

export default function Masthead({ title, tagline, date, feedCount, reader }: MastheadProps) {
  const volume = reader && date ? volumeOf(reader, date) : undefined;
  const explanation =
    reader && date
      ? `Your ${ordinal(reader.editions)} edition in this browser. The number goes up only when the wires bring new stories; it has counted since ${longDate(new Date(reader.since))}. The volume counts the months since then.`
      : undefined;

  return (
    <header className="masthead">
      <div className="masthead__ears">
        <p>
          {reader && volume ? (
            <span className="ear tip" tabIndex={0} role="note" aria-label={explanation} data-tip={explanation}>
              Vol. {roman(volume)} · No. {reader.editions.toLocaleString("en-GB")}
            </span>
          ) : (
            "Vol. — · No. —"
          )}
        </p>
        <p>
          {feedCount} {feedCount === 1 ? "wire" : "wires"} · Price: gratis
        </p>
      </div>
      <h1 className="masthead__title" style={{ fontSize: titleSize(title) }}>
        {title}
      </h1>
      <div className="masthead__rule">
        <span>{tagline}</span>
        <span className="masthead__date">{date ? longDate(date) : " "}</span>
        <span className="masthead__actions">
          {/* A plain anchor: /random answers with a redirect, and a client-side transition would prefetch and keep one draw. */}
          <a href="/random" className="masthead__button" title="Read a wire drawn at random from the directory">
            <DiceIcon />
            Random wire
          </a>
          <Link href="/settings" className="masthead__button" title="Choose and order your feeds">
            <CogIcon />
            Composing room
          </Link>
        </span>
      </div>
    </header>
  );
}
