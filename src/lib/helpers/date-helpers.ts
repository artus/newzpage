import { DateTime } from "luxon";
import { Logger } from "./logger";

export const parseDate = (value: string) => {
  try {
    return DateTime.fromRFC2822(value);
  } catch (error) {
    Logger.error("Date is not in RFC 2822 format", error as Error);
  }

  try {
    return DateTime.fromISO(value);
  } catch (error) {
    Logger.error("Date is not in ISO 8601 format", error as Error);
  }

  try {
    return DateTime.fromRFC2822(value);
  } catch (error) {
    Logger.error("Date is not in RFC 2822 format", error as Error);
  }

  return DateTime.invalid("Date is not in a recognized format");
}