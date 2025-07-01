import type { Formatter, LogEntry } from "../types";

const getLevelName = (level: number): string => {
  switch (level) {
    case 0:
      return "DEBUG";
    case 1:
      return "INFO";
    case 2:
      return "WARN";
    case 3:
      return "ERROR";
    case 4:
      return "FATAL";
    default:
      return "UNKNOWN";
  }
};

export const createJsonFormatter = (): Formatter => {
  return {
    format: (entry: LogEntry): string => {
      return JSON.stringify({
        timestamp: entry.timestamp,
        level: getLevelName(entry.level),
        message: entry.message,
        ...entry.context,
        ...(entry.error && {
          error: {
            name: entry.error.name,
            message: entry.error.message,
            stack: entry.error.stack,
          },
        }),
        ...(entry.metadata && { metadata: entry.metadata }),
      });
    },
  };
};
