const RAD = Math.PI / 180;
const DAY = 86_400_000;
const MINUTE = 60_000;

export interface SunTimes {
  /** Absent when the sun does not rise or set that day. */
  sunrise?: Date;
  sunset?: Date;
  /** Set when there is no sunrise or sunset: the sun stays up, or stays down. */
  polar?: "day" | "night";
  solarNoon: Date;
}

/** Days on the astronomers' count, which starts at noon on 1 January 4713 BC. */
export const julianDay = (date: Date): number => date.getTime() / DAY + 2440587.5;

const mod = (value: number, by: number) => ((value % by) + by) % by;

/**
 * Sunrise and sunset for the calendar day of `date` at a place, by the method of the NOAA solar calculator:
 * within a minute or two, refraction included. Latitude counts north positive, longitude east positive.
 */
export function sunTimes(date: Date, lat: number, lon: number): SunTimes {
  // The day is the reader's; its noon is close enough to the sun's for the sun's position that day.
  const localNoon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const t = (julianDay(localNoon) - 2451545) / 36525;
  const meanLong = mod(280.46646 + t * (36000.76983 + t * 0.0003032), 360);
  const meanAnomaly = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const centre =
    Math.sin(meanAnomaly * RAD) * (1.914602 - t * (0.004817 + 0.000014 * t)) + Math.sin(2 * meanAnomaly * RAD) * (0.019993 - 0.000101 * t) + Math.sin(3 * meanAnomaly * RAD) * 0.000289;
  const omega = 125.04 - 1934.136 * t;
  const apparentLong = meanLong + centre - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const obliquity = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(omega * RAD);
  const declination = Math.asin(Math.sin(obliquity * RAD) * Math.sin(apparentLong * RAD));
  const y = Math.tan((obliquity / 2) * RAD) ** 2;
  const equationOfTime =
    (4 / RAD) *
    (y * Math.sin(2 * meanLong * RAD) -
      2 * eccentricity * Math.sin(meanAnomaly * RAD) +
      4 * eccentricity * y * Math.sin(meanAnomaly * RAD) * Math.cos(2 * meanLong * RAD) -
      0.5 * y * y * Math.sin(4 * meanLong * RAD) -
      1.25 * eccentricity * eccentricity * Math.sin(2 * meanAnomaly * RAD));

  // Solar noon in minutes after a UTC midnight; the midnight is chosen so noon falls on the reader's day.
  const noonMinutes = 720 - 4 * lon - equationOfTime;
  const utcMidnight = Date.UTC(localNoon.getUTCFullYear(), localNoon.getUTCMonth(), localNoon.getUTCDate());
  const solarNoon = [-1, 0, 1]
    .map((k) => utcMidnight + k * DAY + noonMinutes * MINUTE)
    .reduce((best, candidate) => (Math.abs(candidate - localNoon.getTime()) < Math.abs(best - localNoon.getTime()) ? candidate : best));

  const cosHourAngle = Math.cos(90.833 * RAD) / (Math.cos(lat * RAD) * Math.cos(declination)) - Math.tan(lat * RAD) * Math.tan(declination);
  if (cosHourAngle > 1) return { polar: "night", solarNoon: new Date(solarNoon) };
  if (cosHourAngle < -1) return { polar: "day", solarNoon: new Date(solarNoon) };
  const hourAngle = Math.acos(cosHourAngle) / RAD;
  return { sunrise: new Date(solarNoon - hourAngle * 4 * MINUTE), sunset: new Date(solarNoon + hourAngle * 4 * MINUTE), solarNoon: new Date(solarNoon) };
}

/** "12 h 13 min" for a span of daylight. */
export function daylight(times: SunTimes): string | undefined {
  if (!times.sunrise || !times.sunset) return undefined;
  const minutes = Math.round((times.sunset.getTime() - times.sunrise.getTime()) / MINUTE);
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}
