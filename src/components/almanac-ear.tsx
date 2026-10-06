"use client";

import Link from "next/link";
import { useState } from "react";
import { moonPhase, moonSentence } from "@/lib/almanac/moon";
import { daylight, sunTimes } from "@/lib/almanac/sun";
import { saveAlmanacPlace, type AlmanacPlace } from "@/lib/client/almanac-store";
import { locateReader, useAlmanacPlace } from "@/lib/client/use-almanac";
import { clock } from "@/lib/util/time";
import MoonIcon from "./moon-icon";
import SunIcon from "./sun-icon";

/** "near Rotterdam" for a place the browser gave, "at Tokyo" for a chosen city. */
function whereabouts(place: AlmanacPlace): string {
  if (!place.name) return "at your location";
  return place.source === "browser" ? `near ${place.name}` : `at ${place.name}`;
}

/**
 * The almanac in the masthead's ear, after the volume and number, as the weather once was: sunrise, sunset and
 * the moon for the reader's place, worked out in the browser. Until a place is known the ear offers to find one;
 * nothing leaves the browser. Renders nothing, separator included, until the edition is composed.
 */
export default function AlmanacEar({ date }: { date?: Date }) {
  const place = useAlmanacPlace();
  const [busy, setBusy] = useState(false);
  const [trouble, setTrouble] = useState<string>();

  if (!date || place === undefined) return null;

  if (place === null) {
    const onLocate = async () => {
      setBusy(true);
      setTrouble(undefined);
      try {
        saveAlmanacPlace(await locateReader());
      } catch (caught) {
        setTrouble((caught as Error).message);
      } finally {
        setBusy(false);
      }
    };
    return (
      <>
        {" · "}
        <span className="almanac">
          <button type="button" className="almanac__ask" onClick={onLocate} disabled={busy} title="Sunrise, sunset and the moon for where you are; the place stays in this browser">
            <SunIcon /> {busy ? "Finding you…" : "Almanac: use my location"}
          </button>
          {" · "}
          <Link href="/settings#almanac" className="almanac__ask">
            or pick a city
          </Link>
          {trouble ? <span className="almanac__trouble"> · {trouble}</span> : null}
        </span>
      </>
    );
  }

  const sun = sunTimes(date, place.lat, place.lon);
  const moon = moonPhase(date);
  const where = whereabouts(place);
  const rise = sun.sunrise ? clock(sun.sunrise, place.timeZone) : undefined;
  const set = sun.sunset ? clock(sun.sunset, place.timeZone) : undefined;
  const sunLine = rise && set ? `${rise}–${set}` : sun.polar === "day" ? "Sun up all day" : "No sunrise today";
  const sunSentence =
    rise && set
      ? `Sunrise ${rise} and sunset ${set} ${where}${place.timeZone ? " (local time there)" : ""}, ${daylight(sun)} of daylight.`
      : sun.polar === "day"
        ? `The sun does not set today ${where}.`
        : `The sun does not rise today ${where}.`;
  const explanation = `${sunSentence} ${moonSentence(moon)} Worked out in this browser; the place is kept here only.`;

  return (
    <>
      {" · "}
      <span className="almanac ear tip" tabIndex={0} role="note" aria-label={explanation} data-tip={explanation}>
        <SunIcon /> {sunLine} · <MoonIcon angle={moon.angle} /> {moon.name}
      </span>
    </>
  );
}
