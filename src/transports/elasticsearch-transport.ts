import type { Formatter, LogEntry } from "../types";
import { LogLevel } from "../types";
import { createDetailedError, handleTransportError } from "../utils/errors";
import { shouldLog } from "./base-transport";

export interface ElasticsearchTransportOptions {
  formatter?: Formatter;
  level?: LogLevel;
  url?: string;
  username?: string;
  password?: string;
  apiKey?: string;
  index?: string;
  indexPattern?: string;
  batchSize?: number;
  flushInterval?: number;
  timeout?: number;
}

export const createElasticsearchTransport = (
  options: ElasticsearchTransportOptions = {},
) => {
  const transportName = "Elasticsearch";

  try {
    let minLevel = options.level ?? LogLevel.INFO;
    // Note: formatter is not used in this transport as we format logs directly for Elasticsearch
    const url =
      options.url || process.env.ELASTICSEARCH_URL || "http://localhost:9200";
    const username = options.username || process.env.ELASTICSEARCH_USERNAME;
    const password = options.password || process.env.ELASTICSEARCH_PASSWORD;
    const apiKey = options.apiKey || process.env.ELASTICSEARCH_API_KEY;
    const index = options.index || process.env.ELASTICSEARCH_INDEX || "logs";
    const indexPattern =
      options.indexPattern ||
      process.env.ELASTICSEARCH_INDEX_PATTERN ||
      "logs-{YYYY.MM.DD}";
    const batchSize = options.batchSize || 10;
    const flushInterval = options.flushInterval || 5000;
    const timeout = options.timeout || 30000;

    // Validate required configuration
    if (!apiKey && (!username || !password)) {
      throw createDetailedError("ELASTICSEARCH_MISSING_AUTH", transportName, {
        message:
          "Elasticsearch transport requires either API key or username/password",
      });
    }

    let batch: LogEntry[] = [];
    let flushTimer: ReturnType<typeof setInterval> | null = null;

    const getIndexName = (): string => {
      if (indexPattern?.includes("{YYYY.MM.DD}")) {
        const date = new Date();
        const dateStr = date.toISOString().split("T")[0]?.replace(/-/g, ".");

        if (!dateStr) {
          throw createDetailedError(
            "ELASTICSEARCH_MISSING_DATE",
            transportName,
            {
              message: "Date string is missing",
            },
          );
        }

        return indexPattern.replace("{YYYY.MM.DD}", dateStr);
      }
      return typeof index === "string" && index.length > 0 ? index : "logs";
    };

    const getAuthHeaders = () => {
      if (apiKey) {
        return {
          Authorization: `ApiKey ${apiKey}`,
        };
      }
      if (username && password) {
        const auth = Buffer.from(`${username}:${password}`).toString("base64");
        return {
          Authorization: `Basic ${auth}`,
        };
      }
      return {};
    };

    const sendToElasticsearch = async (entries: LogEntry[]) => {
      try {
        const indexName = getIndexName();
        const bulkUrl = `${url}/_bulk`;

        // Create bulk payload
        const bulkPayload = `${entries
          .map((entry) => {
            const doc = {
              message: entry.message,
              level: getElasticsearchLevel(entry.level),
              timestamp: new Date(entry.timestamp).toISOString(),
              service: process.env.SERVICE_NAME || "unknown",
              ...entry.context,
              ...(entry.error && {
                error_name: entry.error.name,
                error_message: entry.error.message,
                error_stack: entry.error.stack,
              }),
              ...(entry.metadata && { metadata: entry.metadata }),
            };

            // Bulk format: action + document
            return `${JSON.stringify({ index: { _index: indexName } })}\n${JSON.stringify(doc)}`;
          })
          .join("\n")}\n`;

        const response = await fetch(bulkUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-ndjson",
            ...getAuthHeaders(),
          },
          body: bulkPayload,
          signal: AbortSignal.timeout(timeout),
        });

        if (!response.ok) {
          const responseText = await response
            .text()
            .catch(() => "Unable to read response body");
          throw createDetailedError("ELASTICSEARCH_API_ERROR", transportName, {
            status: response.status,
            statusText: response.statusText,
            url: bulkUrl,
            responseBody: responseText,
          });
        }

        // Check for individual document errors in bulk response
        const responseData = await response.json().catch(() => null);
        if (responseData?.errors && Array.isArray(responseData.items)) {
          const errors = responseData.items
            .filter((item: Record<string, unknown>) => {
              const index = item.index as Record<string, unknown> | undefined;
              return index?.error;
            })
            .map((item: Record<string, unknown>) => {
              const index = item.index as Record<string, unknown> | undefined;
              return index?.error;
            })
            .slice(0, 3); // Show first 3 errors

          if (errors?.length > 0) {
            // Errors are handled via handleTransportError, not console
            handleTransportError(
              createDetailedError("ELASTICSEARCH_PARTIAL_ERROR", transportName, {
                message: "Some documents failed to index",
                errors,
              }),
              transportName,
              true,
            );
          }
        }
      } catch (error) {
        handleTransportError(error, transportName, true);
      }
    };

    const getElasticsearchLevel = (level: LogLevel): string => {
      switch (level) {
        case LogLevel.DEBUG:
          return "debug";
        case LogLevel.INFO:
          return "info";
        case LogLevel.WARN:
          return "warn";
        case LogLevel.ERROR:
          return "error";
        case LogLevel.FATAL:
          return "fatal";
        default:
          return "info";
      }
    };

    const flush = async () => {
      if (batch.length === 0) return;

      const entriesToSend = [...batch];
      batch = [];

      await sendToElasticsearch(entriesToSend);
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

      // Elasticsearch specific methods
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
        url,
        index,
        indexPattern,
        batchSize,
        flushInterval,
        timeout,
      }),

      // Get current index name
      getCurrentIndex: () => getIndexName(),
    };
  } catch (error) {
    handleTransportError(error, transportName, false);
    throw error; // Re-throw for proper error handling
  }
};
