import type { Formatter, LogEntry } from "../types";
import { LogLevel } from "../types";

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

/**
 * ANSI color codes for terminal output
 */
const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  // Level colors
  debug: "\x1b[36m", // cyan
  info: "\x1b[32m", // green
  warn: "\x1b[33m", // yellow
  error: "\x1b[31m", // red
  fatal: "\x1b[35m", // magenta
  // Content colors
  timestamp: "\x1b[2m", // dim
  context: "\x1b[34m", // blue
  message: "\x1b[37m", // white
};

const getLevelColor = (level: LogLevel): string => {
  switch (level) {
    case LogLevel.DEBUG:
      return colors.debug;
    case LogLevel.INFO:
      return colors.info;
    case LogLevel.WARN:
      return colors.warn;
    case LogLevel.ERROR:
      return colors.error;
    case LogLevel.FATAL:
      return colors.fatal;
    default:
      return colors.reset;
  }
};

/**
 * Creates a JSON formatter that outputs logs as single-line JSON.
 * Best for production environments and log aggregation systems.
 */
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
            ...(entry.error.stack !== undefined && { stack: entry.error.stack }),
            ...(entry.error.code !== undefined && { code: entry.error.code }),
            ...(entry.error.statusCode !== undefined && {
              statusCode: entry.error.statusCode,
            }),
            ...(entry.error.cause !== undefined && { cause: entry.error.cause }),
          },
        }),
        ...(entry.metadata && { metadata: entry.metadata }),
      });
    },
  };
};

export interface PrettyFormatterOptions {
  /** Use colors in output. Defaults to true if stdout is a TTY */
  colors?: boolean;
  /** Show timestamp. Defaults to true */
  showTimestamp?: boolean;
  /** Show context fields inline. Defaults to true */
  showContext?: boolean;
}

/**
 * Creates a pretty formatter for human-readable console output.
 * Best for local development.
 *
 * @example
 * Output format:
 * 12:34:56.789 INFO  Processing request  requestId=req-123 userId=user-456
 */
export const createPrettyFormatter = (
  options: PrettyFormatterOptions = {},
): Formatter => {
  const useColors = options.colors ?? process.stdout.isTTY ?? false;
  const showTimestamp = options.showTimestamp ?? true;
  const showContext = options.showContext ?? true;

  const colorize = (text: string, color: string): string => {
    return useColors ? `${color}${text}${colors.reset}` : text;
  };

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");
    const ms = date.getMilliseconds().toString().padStart(3, "0");
    return `${hours}:${minutes}:${seconds}.${ms}`;
  };

  const formatContext = (context: Record<string, unknown>): string => {
    const entries = Object.entries(context).filter(
      ([key]) =>
        // Skip internal fields that clutter the output
        !["stage", "serviceName", "instanceId"].includes(key),
    );

    if (entries.length === 0) return "";

    return entries
      .map(([key, value]) => {
        const valueStr =
          typeof value === "object" ? JSON.stringify(value) : String(value);
        return (
          colorize(`${key}=`, colors.dim) + colorize(valueStr, colors.context)
        );
      })
      .join(" ");
  };

  return {
    format: (entry: LogEntry): string => {
      const parts: string[] = [];

      // Timestamp
      if (showTimestamp) {
        parts.push(colorize(formatTime(entry.timestamp), colors.timestamp));
      }

      // Level (padded for alignment)
      const levelName = getLevelName(entry.level).padEnd(5);
      parts.push(colorize(levelName, getLevelColor(entry.level)));

      // Message
      parts.push(colorize(entry.message, colors.message));

      // Context
      if (showContext && entry.context) {
        const contextStr = formatContext(entry.context);
        if (contextStr) {
          parts.push(contextStr);
        }
      }

      // Metadata
      if (entry.metadata && Object.keys(entry.metadata).length > 0) {
        parts.push(colorize(JSON.stringify(entry.metadata), colors.dim));
      }

      let output = parts.join(" ");

      // Error (on new line for readability)
      if (entry.error) {
        const errorColor = colors.error;
        output += `\n${colorize(`  ${entry.error.name}: ${entry.error.message}`, errorColor)}`;
        if (entry.error.stack) {
          const stackLines = entry.error.stack
            .split("\n")
            .slice(1)
            .map((line) => colorize(`  ${line.trim()}`, colors.dim))
            .join("\n");
          output += `\n${stackLines}`;
        }
      }

      return output;
    },
  };
};
