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
  logGroupName?: string;
  logStreamName?: string;
  region?: string;
  maxStreamSize?: number; // in bytes (CloudWatch limit: 50MB)
  maxStreamAge?: number; // in milliseconds (CloudWatch limit: 24 hours)
  batchSize?: number;
  flushInterval?: number;
  timeout?: number;
}

export interface CloudWatchTransportState {
  currentStreamName: string;
  currentStreamSize: number;
  streamStartTime: number;
  sequenceToken: string | undefined;
  batch: LogEntry[];
  flushTimer?: ReturnType<typeof setInterval>;
}

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
      options.logGroupName ||
      process.env.CLOUDWATCH_LOG_GROUP ||
      "/aws/lambda/my-function";
    const logStreamName =
      options.logStreamName || process.env.CLOUDWATCH_LOG_STREAM;
    const region = options.region || process.env.AWS_REGION || "us-east-1";
    const maxStreamSize = options.maxStreamSize ?? 45 * 1024 * 1024; // 45MB (leave buffer)
    const maxStreamAge = options.maxStreamAge ?? 23 * 60 * 60 * 1000; // 23 hours (leave buffer)
    const batchSize = options.batchSize || 10;
    const flushInterval = options.flushInterval || 5000;
    const timeout = options.timeout || 30000;

    // Validate required configuration
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

    const sendToCloudWatch = async (entries: LogEntry[]): Promise<void> => {
      try {
        // Dynamic import of AWS SDK v3
        const {
          CloudWatchLogsClient,
          PutLogEventsCommand,
          CreateLogStreamCommand,
        } = await import("@aws-sdk/client-cloudwatch-logs");

        const client = new CloudWatchLogsClient({
          region,
          requestHandler: {
            requestTimeout: timeout,
          },
        });

        // Create log stream if it doesn't exist
        try {
          await client.send(
            new CreateLogStreamCommand({
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

        const command = new PutLogEventsCommand({
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
        const batchSize = logEvents.reduce(
          (sum, event) => sum + event.message.length,
          0,
        );
        state.currentStreamSize += batchSize;
      } catch (error: unknown) {
        // Handle sequence token errors
        if (
          error instanceof Error &&
          error.name === "InvalidSequenceTokenException"
        ) {
          const match = error.message.match(/sequenceToken is: (.+)/);
          if (match) {
            state.sequenceToken = match[1];
            await sendToCloudWatch(entries); // Retry
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

        console.log(
          `[CLOUDWATCH] Rotated to stream: ${state.currentStreamName}`,
        );
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

    // Start the flush timer
    startFlushTimer();

    return {
      log: async (entry: LogEntry) => {
        if (!shouldLog(entry.level, minLevel)) return;

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
