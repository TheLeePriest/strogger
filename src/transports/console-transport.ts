import type { Formatter, LogEntry } from "../types";
import { LogLevel } from "../types";
import { shouldLog } from "./base-transport";

export interface ConsoleTransportOptions {
  formatter?: Formatter;
  useColors?: boolean;
  level?: LogLevel;
}

export const createConsoleTransport = (
  options: ConsoleTransportOptions = {},
) => {
  let minLevel = options.level ?? LogLevel.INFO;
  const formatter = options.formatter || {
    format: (entry: LogEntry) => JSON.stringify(entry),
  };
  // Note: useColors is available for future color support
  // const useColors = options.useColors ?? true;

  return {
    log: (entry: LogEntry) => {
      if (!shouldLog(entry.level, minLevel)) return;
      const formattedMessage = formatter.format(entry);
      switch (entry.level) {
        case LogLevel.DEBUG:
          console.debug(formattedMessage);
          break;
        case LogLevel.INFO:
          console.info(formattedMessage);
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage);
          break;
        case LogLevel.ERROR:
        case LogLevel.FATAL:
          console.error(formattedMessage);
          break;
      }
    },
    setLevel: (level: LogLevel) => {
      minLevel = level;
    },
    getLevel: () => {
      return minLevel;
    },
  };
};
