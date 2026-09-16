import Link from "next/link";
import CogIcon from "./cog-icon";
import { clock } from "@/lib/util/time";

export default function Colophon({ printedAt }: { printedAt?: Date }) {
  return (
    <footer className="colophon">
      <span>Summaries are extracted by TextRank and kept in this browser; no article is sent to a third party.</span>
      <span>
        Set in Libre Caslon and Playfair Display · Printed at {printedAt ? clock(printedAt) : "—"} ·{" "}
        <Link href="/settings" className="colophon__settings">
          <CogIcon />
          Composing room
        </Link>{" "}
        ·{" "}
        <a className="colophon__publisher" href="https://equites.digital" rel="noopener noreferrer">
          {/* A static asset of our own; the Next.js image optimiser is not needed for a 6 KB logo. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="colophon__logo" src="/images/equites-digital.webp" alt="" width={570} height={570} />
          Equites Digital
        </a>
      </span>
    </footer>
  );
}
