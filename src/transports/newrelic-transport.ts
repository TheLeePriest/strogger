import type { Formatter, LogEntry } from "../types";
import { LogLevel } from "../types";
import {
  createDetailedError,
  handleTransportError,
  validateEnvironmentVariable,
  validateTransportConfig,
} from "../utils/errors";
import { shouldLog } from "./base-transport";

export interface NewRelicTransportOptions {
  formatter?: Formatter;
  level?: LogLevel;
  apiKey?: string;
  accountId?: string;
  region?: string;
  serviceName?: string;
  batchSize?: number;
  flushInterval?: number;
}

export const createNewRelicTransport = (
  options: NewRelicTransportOptions = {},
) => {
  const transportName = "New Relic";

  try {
    let minLevel = options.level ?? LogLevel.INFO;
    // Note: formatter is available for custom formatting
    // const formatter = options.formatter || {
    //   format: (entry: LogEntry) => JSON.stringify(entry),
    // };
    const apiKey = options.apiKey || process.env.NEW_RELIC_LICENSE_KEY;
    const accountId = options.accountId || process.env.NEW_RELIC_ACCOUNT_ID;
    const region = options.region || process.env.NEW_RELIC_REGION || "us";
    const serviceName =
      options.serviceName || process.env.NEW_RELIC_SERVICE_NAME;
    const batchSize = options.batchSize || 10;
    const flushInterval = options.flushInterval || 5000;

    // Validate required configuration
    validateEnvironmentVariable("NEW_RELIC_LICENSE_KEY", apiKey, true);
    validateEnvironmentVariable("NEW_RELIC_ACCOUNT_ID", accountId, true);

    // Validate transport configuration
    validateTransportConfig(transportName, { apiKey, accountId }, [
      "apiKey",
      "accountId",
    ]);

    let batch: LogEntry[] = [];
    let flushTimer: ReturnType<typeof setInterval> | null = null;

    const sendToNewRelic = async (entries: LogEntry[]) => {
      try {
        const url = `https://log-api.${region}.newrelic.com/log/v1`;

        const payload = {
          timestamp: Date.now(),
          service: serviceName,
          attributes: {
            // New Relic specific attributes
            logtype: "application",
            timestamp: new Date().toISOString(),
          },
          logs: entries.map((entry) => ({
            message: entry.message,
            level: entry.level,
            timestamp: new Date(entry.timestamp).getTime(),
            attributes: {
              ...entry.context,
              ...(entry.error && {
                error_name: entry.error.name,
                error_message: entry.error.message,
                error_stack: entry.error.stack,
              }),
              ...(entry.metadata && { metadata: entry.metadata }),
            },
          })),
        };

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Api-Key": apiKey as string,
            "X-License-Key": apiKey as string,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw createDetailedError("NEW_RELIC_API_ERROR", transportName, {
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

    const flush = async () => {
      if (batch.length === 0) return;

      const entriesToSend = [...batch];
      batch = [];

      await sendToNewRelic(entriesToSend);
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

      // New Relic specific methods
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
    };
  } catch (error) {
    handleTransportError(error, transportName, false);
    throw error; // Re-throw for proper error handling
  }
};
