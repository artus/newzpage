import { DateTime } from "luxon";
import { Logger } from "./logger";
import { Try } from "voft";

export const parseDate = (value: string) => {
  return Try.of(() => DateTime.fromRFC2822(value))
    .recoverWith((error) => {
      Logger.error("Date is not in RFC 2822 format", error as Error);
      return DateTime.fromISO(value);
    })
    .recoverWith((error) => {
      Logger.error("Date is not in ISO 8601 format", error as Error);
      return DateTime.fromRFC2822(value);
    })
    .recoverWith((error) => {
      Logger.error("Date is not in RFC 2822 format", error as Error);
      return DateTime.invalid("Date is not in a recognized format");
    });
}