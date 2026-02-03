import type { Formatter, LogEntry } from "../types";
import { LogLevel } from "../types";
import {
  createDetailedError,
  handleTransportError,
  validateEnvironmentVariable,
  validateTransportConfig,
} from "../utils/errors";
import { shouldLog } from "./base-transport";

export interface DataDogTransportOptions {
  formatter?: Formatter;
  level?: LogLevel;
  apiKey?: string;
  serviceName?: string;
  source?: string;
  tags?: string[];
  batchSize?: number;
  flushInterval?: number;
  region?: "us" | "eu";
}

export const createDataDogTransport = (
  options: DataDogTransportOptions = {},
) => {
  const transportName = "DataDog";

  try {
    let minLevel = options.level ?? LogLevel.INFO;
    // Note: formatter is available for custom formatting
    // const formatter = options.formatter || {
    //   format: (entry: LogEntry) => JSON.stringify(entry),
    // };
    const apiKey = options.apiKey || process.env.DATADOG_API_KEY;
    const serviceName =
      options.serviceName || process.env.DD_SERVICE || process.env.SERVICE_NAME;
    const source = options.source || "nodejs";
    const tags = options.tags || [];
    const batchSize = options.batchSize || 10;
    const flushInterval = options.flushInterval || 5000;
    const region = options.region || process.env.DD_SITE || "us";

    // Validate required configuration
    validateEnvironmentVariable("DATADOG_API_KEY", apiKey, true);

    // Validate transport configuration
    validateTransportConfig(transportName, { apiKey }, ["apiKey"]);

    // Build tags string
    const defaultTags = [
      `env:${process.env.NODE_ENV || "dev"}`,
      `service:${serviceName || "unknown"}`,
      `source:${source}`,
    ];
    const allTags = [...defaultTags, ...tags].join(",");

    let batch: LogEntry[] = [];
    let flushTimer: ReturnType<typeof setInterval> | null = null;

    const sendToDataDog = async (entries: LogEntry[]) => {
      try {
        const url = `https://http-intake.logs.${region === "eu" ? "eu." : ""}datadoghq.com/api/v2/logs`;

        const payload = entries.map((entry) => ({
          message: entry.message,
          level: getDataDogLevel(entry.level),
          timestamp: new Date(entry.timestamp).getTime(),
          ddsource: source,
          ddtags: allTags,
          service: serviceName,
          ...entry.context,
          ...(entry.error && {
            error_name: entry.error.name,
            error_message: entry.error.message,
            error_stack: entry.error.stack,
          }),
          ...(entry.metadata && { metadata: entry.metadata }),
        }));

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "DD-API-KEY": apiKey as string,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw createDetailedError("DATADOG_API_ERROR", transportName, {
            status: response.status,
            statusText: response.statusText,
            url,
            responseBody: await response
              .text()
              .catch(() => "Unable to read response body"),
          });
        }
      } catch (error) {
        handleTransportError(error, transportName, true);
      }
    };

    const getDataDogLevel = (level: LogLevel): string => {
      switch (level) {
        case LogLevel.DEBUG:
          return "debug";
        case LogLevel.INFO:
          return "info";
        case LogLevel.WARN:
          return "warning";
        case LogLevel.ERROR:
          return "error";
        case LogLevel.FATAL:
          return "critical";
        default:
          return "info";
      }
    };

    const flush = async () => {
      if (batch.length === 0) return;

      const entriesToSend = [...batch];
      batch = [];

      await sendToDataDog(entriesToSend);
    };

    const startFlushTimer = () => {
      if (flushTimer) return;

      flushTimer = setInterval(() => {
        flush().catch((error) => {
          handleTransportError(error, transportName, true);
        });
      }, flushInterval);
    };

    // Timer starts lazily on first log, not immediately

    return {
      log: async (entry: LogEntry) => {
        if (!shouldLog(entry.level, minLevel)) return;

        // Start flush timer lazily on first log
        startFlushTimer();

        batch.push(entry);

        if (batch.length >= batchSize) {
          await flush();
        }
      },

      setLevel: (level: LogLevel) => {
        minLevel = level;
      },

      getLevel: () => minLevel,

      // DataDog specific methods
      flush: async () => {
        await flush();
      },

      close: async () => {
        if (flushTimer) {
          clearInterval(flushTimer);
          flushTimer = null;
        }
        await flush();
      },

      // Add tags dynamically
      addTags: (newTags: string[]) => {
        tags.push(...newTags);
      },

      // Get current configuration
      getConfig: () => ({
        serviceName,
        source,
        tags: [...tags],
        region,
        batchSize,
        flushInterval,
      }),
    };
  } catch (error) {
    handleTransportError(error, transportName, false);
    throw error; // Re-throw for proper error handling
  }
};
