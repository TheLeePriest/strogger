import type { Formatter, LogEntry } from "../types";
import { LogLevel } from "../types";
import {
  createDetailedError,
  handleTransportError,
  validateEnvironmentVariable,
  validateTransportConfig,
} from "../utils/errors";
import { shouldLog } from "./base-transport";

export interface CloudWatchTransportOptions {
  formatter?: Formatter;
  level?: LogLevel;
  /** Required: CloudWatch log group name. Can also be set via CLOUDWATCH_LOG_GROUP env var. */
  logGroupName?: string;
  logStreamName?: string;
  /** AWS region. Can also be set via AWS_REGION env var. Default: us-east-1 */
  region?: string;
  maxStreamSize?: number; // in bytes (CloudWatch limit: 50MB)
  maxStreamAge?: number; // in milliseconds (CloudWatch limit: 24 hours)
  batchSize?: number;
  flushInterval?: number;
  timeout?: number;
  /** Maximum number of retries for sequence token errors. Default: 3 */
  maxRetries?: number;
}

export interface CloudWatchTransportState {
  currentStreamName: string;
  currentStreamSize: number;
  streamStartTime: number;
  sequenceToken: string | undefined;
  batch: LogEntry[];
  flushTimer?: ReturnType<typeof setInterval>;
}

const DEFAULT_MAX_RETRIES = 3;

export const createCloudWatchTransport = (
  options: CloudWatchTransportOptions = {},
) => {
  const transportName = "CloudWatch";

  try {
    let minLevel = options.level ?? LogLevel.INFO;
    const formatter = options.formatter || {
      format: (entry: LogEntry) => JSON.stringify(entry),
    };
    const logGroupName =
      options.logGroupName || process.env.CLOUDWATCH_LOG_GROUP;
    const logStreamName =
      options.logStreamName || process.env.CLOUDWATCH_LOG_STREAM;
    const region = options.region || process.env.AWS_REGION || "us-east-1";
    const maxStreamSize = options.maxStreamSize ?? 45 * 1024 * 1024; // 45MB (leave buffer)
    const maxStreamAge = options.maxStreamAge ?? 23 * 60 * 60 * 1000; // 23 hours (leave buffer)
    const batchSize = options.batchSize || 10;
    const flushInterval = options.flushInterval || 5000;
    const timeout = options.timeout || 30000;
    const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;

    // Validate required configuration - logGroupName is required
    if (!logGroupName) {
      throw createDetailedError("CLOUDWATCH_MISSING_LOG_GROUP", transportName, {
        message:
          "logGroupName is required. Provide it via options.logGroupName or CLOUDWATCH_LOG_GROUP environment variable.",
      });
    }

    validateEnvironmentVariable("CLOUDWATCH_LOG_GROUP", logGroupName, false);
    validateEnvironmentVariable("AWS_REGION", region, false);

    // Validate transport configuration
    validateTransportConfig(transportName, { logGroupName, region }, [
      "logGroupName",
      "region",
    ]);

    const state: CloudWatchTransportState = {
      currentStreamName:
        logStreamName ||
        `${new Date().toISOString().split("T")[0]}-${Date.now()}`,
      currentStreamSize: 0,
      streamStartTime: Date.now(),
      sequenceToken: undefined,
      batch: [],
    };

    let flushTimer: ReturnType<typeof setInterval> | null = null;

    // Lazily initialized CloudWatch client (created on first use, reused thereafter)
    // Using 'any' for dynamic import types - the SDK is optional and dynamically loaded
    // biome-ignore lint/suspicious/noExplicitAny: AWS SDK is dynamically imported
    let cloudWatchClient: any = null;
    // biome-ignore lint/suspicious/noExplicitAny: AWS SDK is dynamically imported
    let awsSdkModule: any = null;

    const getClient = async () => {
      if (!awsSdkModule) {
        try {
          awsSdkModule = await import("@aws-sdk/client-cloudwatch-logs");
        } catch (importError) {
          throw createDetailedError("CLOUDWATCH_SDK_NOT_FOUND", transportName, {
            message:
              "AWS SDK not installed. Install it with: npm install @aws-sdk/client-cloudwatch-logs",
            originalError:
              importError instanceof Error
                ? importError.message
                : String(importError),
          });
        }
      }
      if (!cloudWatchClient) {
        cloudWatchClient = new awsSdkModule.CloudWatchLogsClient({
          region,
          requestHandler: {
            requestTimeout: timeout,
          },
        });
      }
      return { client: cloudWatchClient, sdk: awsSdkModule };
    };

    const shouldRotateStream = (): boolean => {
      const timeSinceStart = Date.now() - state.streamStartTime;
      return (
        state.currentStreamSize >= maxStreamSize ||
        timeSinceStart >= maxStreamAge
      );
    };

    const generateStreamName = (): string => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      return logStreamName
        ? `${logStreamName}-${timestamp}`
        : `${new Date().toISOString().split("T")[0]}-${timestamp}`;
    };

    const sendToCloudWatch = async (
      entries: LogEntry[],
      retryCount = 0,
    ): Promise<void> => {
      try {
        const { client, sdk } = await getClient();

        // Create log stream if it doesn't exist
        try {
          await client.send(
            new sdk.CreateLogStreamCommand({
              logGroupName,
              logStreamName: state.currentStreamName,
            }),
          );
        } catch (error: unknown) {
          // Stream already exists or other error
          if (
            error instanceof Error &&
            error.name !== "ResourceAlreadyExistsException"
          ) {
            throw error;
          }
        }

        const logEvents = entries.map((entry) => ({
          timestamp: new Date(entry.timestamp).getTime(),
          message: formatter.format(entry),
        }));

        const command = new sdk.PutLogEventsCommand({
          logGroupName,
          logStreamName: state.currentStreamName,
          logEvents,
          sequenceToken: state.sequenceToken,
        });

        const response = await client.send(command);

        // Update sequence token
        if (response.nextSequenceToken) {
          state.sequenceToken = response.nextSequenceToken;
        }

        // Update size (approximate)
        const currentBatchSize = logEvents.reduce(
          (sum, event) => sum + event.message.length,
          0,
        );
        state.currentStreamSize += currentBatchSize;
      } catch (error: unknown) {
        // Handle sequence token errors with retry limit
        if (
          error instanceof Error &&
          error.name === "InvalidSequenceTokenException"
        ) {
          if (retryCount >= maxRetries) {
            throw createDetailedError("CLOUDWATCH_API_ERROR", transportName, {
              error: `Max retries (${maxRetries}) exceeded for InvalidSequenceTokenException`,
              logGroupName,
              logStreamName: state.currentStreamName,
              region,
            });
          }

          const match = error.message.match(/sequenceToken is: (.+)/);
          if (match) {
            state.sequenceToken = match[1];
            await sendToCloudWatch(entries, retryCount + 1);
            return;
          }
        }

        // Handle resource not found (log group doesn't exist)
        if (
          error instanceof Error &&
          error.name === "ResourceNotFoundException"
        ) {
          throw createDetailedError(
            "CLOUDWATCH_LOG_GROUP_NOT_FOUND",
            transportName,
            {
              logGroupName,
              region,
              message:
                "Log group does not exist. Create it first in CloudWatch.",
            },
          );
        }

        throw createDetailedError("CLOUDWATCH_API_ERROR", transportName, {
          error: error instanceof Error ? error.message : String(error),
          logGroupName,
          logStreamName: state.currentStreamName,
          region,
        });
      }
    };

    const rotateStream = async (): Promise<void> => {
      try {
        // Flush current batch
        await flushBatch();

        // Create new stream
        state.currentStreamName = generateStreamName();
        state.currentStreamSize = 0;
        state.streamStartTime = Date.now();
        state.sequenceToken = undefined;
      } catch (error) {
        handleTransportError(error, transportName, true);
      }
    };

    const flushBatch = async (): Promise<void> => {
      if (state.batch.length === 0) return;

      const entriesToSend = [...state.batch];
      state.batch = [];

      await sendToCloudWatch(entriesToSend);
    };

    const startFlushTimer = () => {
      if (flushTimer) return;

      flushTimer = setInterval(() => {
        flushBatch().catch((error) => {
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

        // Check if stream rotation is needed
        if (shouldRotateStream()) {
          await rotateStream();
        }

        // Add to batch
        state.batch.push(entry);

        // Flush if batch is full
        if (state.batch.length >= batchSize) {
          await flushBatch();
        }
      },

      setLevel: (level: LogLevel) => {
        minLevel = level;
      },

      getLevel: () => minLevel,

      // CloudWatch specific methods
      rotateStream: async () => {
        await rotateStream();
      },

      getCurrentStream: () => state.currentStreamName,

      getCurrentStreamSize: () => state.currentStreamSize,

      flush: async () => {
        await flushBatch();
      },

      close: async () => {
        if (flushTimer) {
          clearInterval(flushTimer);
          flushTimer = null;
        }
        await flushBatch();
      },

      // Get current configuration
      getConfig: () => ({
        logGroupName,
        logStreamName: state.currentStreamName,
        region,
        maxStreamSize,
        maxStreamAge,
        batchSize,
        flushInterval,
        timeout,
      }),

      // Get transport statistics
      getStats: () => ({
        currentStream: state.currentStreamName,
        currentStreamSize: state.currentStreamSize,
        streamAge: Date.now() - state.streamStartTime,
        batchSize: state.batch.length,
        sequenceToken: state.sequenceToken ? "set" : "not set",
        flushTimerActive: !!flushTimer,
      }),
    };
  } catch (error) {
    handleTransportError(error, transportName, false);
    throw error; // Re-throw for proper error handling
  }
};
