import { useSyncExternalStore } from "react";

const MINUTE = 60_000;
const currentMinute = () => Math.floor(Date.now() / MINUTE) * MINUTE;
const unknown = () => 0;
const subscribe = () => () => {};

/**
 * The present, to the minute, for pages that print no edition: undefined on the server and while hydrating, so
 * both sides agree, then the time the page shows. A minute is as fine as anything the paper prints.
 */
export function usePrintedAt(): Date | undefined {
  const time = useSyncExternalStore(subscribe, currentMinute, unknown);
  return time ? new Date(time) : undefined;
}
