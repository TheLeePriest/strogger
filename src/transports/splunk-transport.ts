import type { Formatter, LogEntry } from "../types";
import { LogLevel } from "../types";
import {
  createDetailedError,
  handleTransportError,
  validateEnvironmentVariable,
  validateTransportConfig,
} from "../utils/errors";
import { shouldLog } from "./base-transport";

export interface SplunkTransportOptions {
  formatter?: Formatter;
  level?: LogLevel;
  hecUrl?: string;
  hecToken?: string;
  source?: string;
  sourcetype?: string;
  index?: string;
  batchSize?: number;
  flushInterval?: number;
  channel?: string;
}

export const createSplunkTransport = (options: SplunkTransportOptions = {}) => {
  const transportName = "Splunk";

  try {
    let minLevel = options.level ?? LogLevel.INFO;
    // Note: formatter is available for custom formatting
    // const formatter = options.formatter || {
    //   format: (entry: LogEntry) => JSON.stringify(entry),
    // };
    const hecUrl = options.hecUrl || process.env.SPLUNK_HEC_URL;
    const hecToken = options.hecToken || process.env.SPLUNK_HEC_TOKEN;
    const source = options.source || "nodejs-logger";
    const sourcetype = options.sourcetype || "_json";
    const index = options.index || process.env.SPLUNK_INDEX;
    const batchSize = options.batchSize || 10;
    const flushInterval = options.flushInterval || 5000;
    const channel = options.channel || process.env.SPLUNK_CHANNEL;

    // Validate required configuration
    validateEnvironmentVariable("SPLUNK_HEC_URL", hecUrl, true);
    validateEnvironmentVariable("SPLUNK_HEC_TOKEN", hecToken, true);

    // Validate transport configuration
    validateTransportConfig(transportName, { hecUrl, hecToken }, [
      "hecUrl",
      "hecToken",
    ]);

    let batch: LogEntry[] = [];
    let flushTimer: ReturnType<typeof setInterval> | null = null;

    const sendToSplunk = async (entries: LogEntry[]) => {
      try {
        const payload = entries.map((entry) => ({
          event: {
            message: entry.message,
            level: getSplunkLevel(entry.level),
            timestamp: new Date(entry.timestamp).getTime(),
            ...entry.context,
            ...(entry.error && {
              error_name: entry.error.name,
              error_message: entry.error.message,
              error_stack: entry.error.stack,
            }),
            ...(entry.metadata && { metadata: entry.metadata }),
          },
          sourcetype,
          source,
          ...(index && { index }),
          ...(channel && { channel }),
        }));

        const response = await fetch(hecUrl as string, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Splunk ${hecToken}`,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw createDetailedError("SPLUNK_API_ERROR", transportName, {
            status: response.status,
            statusText: response.statusText,
            url: hecUrl,
            responseBody: await response
              .text()
              .catch(() => "Unable to read response body"),
          });
        }
      } catch (error) {
        handleTransportError(error, transportName, true);
      }
    };

    const getSplunkLevel = (level: LogLevel): string => {
      switch (level) {
        case LogLevel.DEBUG:
          return "DEBUG";
        case LogLevel.INFO:
          return "INFO";
        case LogLevel.WARN:
          return "WARN";
        case LogLevel.ERROR:
          return "ERROR";
        case LogLevel.FATAL:
          return "FATAL";
        default:
          return "INFO";
      }
    };

    const flush = async () => {
      if (batch.length === 0) return;

      const entriesToSend = [...batch];
      batch = [];

      await sendToSplunk(entriesToSend);
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

      // Splunk specific methods
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

      // Get current configuration
      getConfig: () => ({
        hecUrl,
        source,
        sourcetype,
        index,
        channel,
        batchSize,
        flushInterval,
      }),
    };
  } catch (error) {
    handleTransportError(error, transportName, false);
    throw error; // Re-throw for proper error handling
  }
};
