const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

/** "12 minutes ago", "3 hours ago", "yesterday", "4 days ago" or a short date. */
export function relativeTime(iso: string | undefined, now = Date.now()): string | undefined {
  if (!iso) return undefined;
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return undefined;
  const minutes = Math.round((now - time) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return dayMonth.format(new Date(time));
}

/** "07:14", in the browser's zone or a named one. A zone the browser does not know falls back to its own. */
export function clock(date: Date, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(date);
  }
}

export function longDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
}

export function roman(value: number): string {
  const numerals: Array<[number, string]> = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let remaining = Math.max(1, Math.floor(value));
  let out = "";
  for (const [number, numeral] of numerals) {
    while (remaining >= number) {
      out += numeral;
      remaining -= number;
    }
  }
  return out;
}
