import { DateTime } from "luxon"

export class Logger {
  static info(message: string) {
    console.log(`[${DateTime.now().toISO()}] INFO: ${message}`);
  }

  static error(message: string, error: Error) {
    console.error(`[${DateTime.now().toISO()}] ERROR: ${message}`, error);
  }

  static debug(message: string) {
    console.log(`[${DateTime.now().toISO()}] DEBUG: ${message}`);
  }

  static warn(message: string) {
    console.warn(`[${DateTime.now().toISO()}] WARN: ${message}`);
  }
}