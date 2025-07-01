import type { LogEntry, Transport } from "../types";
import { LogLevel } from "../types";

export abstract class BaseTransport implements Transport {
  protected level: LogLevel = LogLevel.INFO;

  abstract log(entry: LogEntry): void | Promise<void>;

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  protected shouldLog(entryLevel: LogLevel): boolean {
    return entryLevel >= this.level;
  }
}

export const shouldLog = (
  entryLevel: LogLevel,
  minLevel: LogLevel,
): boolean => {
  return entryLevel >= minLevel;
};
