import { julianDay } from "./sun";

const RAD = Math.PI / 180;
const SYNODIC_MONTH = 29.530588853;

export type MoonPhaseName = "New moon" | "Waxing crescent" | "First quarter" | "Waxing gibbous" | "Full moon" | "Waning gibbous" | "Last quarter" | "Waning crescent";

export interface MoonPhase {
  /** The moon's elongation from the sun in degrees: 0 new, 90 first quarter, 180 full, 270 last quarter. */
  angle: number;
  /** The lit fraction of the disc, 0 to 1. */
  illumination: number;
  name: MoonPhaseName;
  /** Days since the last new moon. */
  age: number;
}

const mod = (value: number, by: number) => ((value % by) + by) % by;
const sin = (degrees: number) => Math.sin(degrees * RAD);

/** The instant phases get a band of about a day either side; the rest of the month belongs to the four in between. */
export function phaseName(angle: number): MoonPhaseName {
  const a = mod(angle, 360);
  if (a < 11.25 || a >= 348.75) return "New moon";
  if (a < 78.75) return "Waxing crescent";
  if (a < 101.25) return "First quarter";
  if (a < 168.75) return "Waxing gibbous";
  if (a < 191.25) return "Full moon";
  if (a < 258.75) return "Waning gibbous";
  if (a < 281.25) return "Last quarter";
  return "Waning crescent";
}

/**
 * The moon's phase at an instant, from the low-precision positions of the sun and the moon in the
 * Astronomical Almanac: the moon's longitude to a third of a degree, which is a matter of minutes in phase.
 */
export function moonPhase(date: Date): MoonPhase {
  const d = julianDay(date) - 2451545;
  const sunAnomaly = mod(357.528 + 0.9856003 * d, 360);
  const sunLong = mod(280.46 + 0.9856474 * d, 360) + 1.915 * sin(sunAnomaly) + 0.02 * sin(2 * sunAnomaly);
  const moonMeanLong = mod(218.316 + 13.176396 * d, 360);
  const moonAnomaly = mod(134.963 + 13.064993 * d, 360);
  const elongation = mod(297.85 + 12.190749 * d, 360);
  const moonLong =
    moonMeanLong +
    6.289 * sin(moonAnomaly) -
    1.274 * sin(2 * elongation - moonAnomaly) +
    0.658 * sin(2 * elongation) -
    0.186 * sin(sunAnomaly) -
    0.059 * sin(2 * elongation - 2 * moonAnomaly) -
    0.057 * sin(2 * elongation - moonAnomaly - sunAnomaly) +
    0.053 * sin(2 * elongation + moonAnomaly) +
    0.046 * sin(2 * elongation - sunAnomaly) +
    0.041 * sin(moonAnomaly - sunAnomaly) -
    0.035 * sin(elongation) -
    0.031 * sin(moonAnomaly + sunAnomaly);
  const angle = mod(moonLong - sunLong, 360);
  return { angle, illumination: (1 - Math.cos(angle * RAD)) / 2, name: phaseName(angle), age: (angle / 360) * SYNODIC_MONTH };
}

/** "The moon is a waxing gibbous, 71% lit." */
export function moonSentence(phase: MoonPhase): string {
  const percent = Math.round(phase.illumination * 100);
  const state =
    phase.name === "New moon" ? "new" : phase.name === "Full moon" ? "full" : phase.name === "First quarter" || phase.name === "Last quarter" ? `at its ${phase.name.toLowerCase()}` : `a ${phase.name.toLowerCase()}`;
  return `The moon is ${state}, ${percent}% lit.`;
}
