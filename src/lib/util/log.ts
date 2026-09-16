const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof LEVELS;

const configured = (process.env.NEWZPAGE_LOG_LEVEL as Level | undefined) ?? "info";
const threshold = LEVELS[configured] ?? LEVELS.info;

function write(level: Level, message: string, detail?: unknown) {
  if (LEVELS[level] < threshold) return;
  const line = `[newzpage] ${level.toUpperCase().padEnd(5)} ${message}`;
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (detail instanceof Error) sink(line, "-", detail.message);
  else if (detail !== undefined) sink(line, detail);
  else sink(line);
}

export const log = {
  debug: (message: string, detail?: unknown) => write("debug", message, detail),
  info: (message: string, detail?: unknown) => write("info", message, detail),
  warn: (message: string, detail?: unknown) => write("warn", message, detail),
  error: (message: string, detail?: unknown) => write("error", message, detail),
};
