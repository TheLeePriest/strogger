import {
  LogLevel,
  createJsonFormatter,
  createLogger,
  getEnvironment,
} from "../index";
import type { LogEntry } from "../types";

// Example: CloudWatch Transport with Log Rotation
// This demonstrates how to implement CloudWatch log rotation in your functional logger

export interface CloudWatchTransportOptions {
  level?: LogLevel;
  logGroupName?: string;
  logStreamName?: string;
  region?: string;
  maxStreamSize?: number; // in bytes (CloudWatch limit: 50MB)
  maxStreamAge?: number; // in milliseconds (CloudWatch limit: 24 hours)
  batchSize?: number;
  flushInterval?: number;
}

export interface CloudWatchTransportState {
  currentStreamName: string;
  currentStreamSize: number;
  streamStartTime: number;
  sequenceToken: string | undefined;
  batch: LogEntry[];
  flushTimer?: ReturnType<typeof setInterval>;
}

// CloudWatch Transport Example: Demonstrates a mock CloudWatch transport with log rotation logic (no AWS SDK).
export const createCloudWatchTransportExample = (
  options: {
    level?: LogLevel;
    maxStreamSize?: number;
    maxStreamAge?: number;
  } = {},
) => {
  let minLevel = options.level ?? LogLevel.INFO;
  const maxStreamSize = options.maxStreamSize ?? 45 * 1024 * 1024;
  const maxStreamAge = options.maxStreamAge ?? 23 * 60 * 60 * 1000;
  let currentSize = 0;
  let streamStartTime = Date.now();

  const shouldRotate = () =>
    currentSize >= maxStreamSize ||
    Date.now() - streamStartTime >= maxStreamAge;

  const rotate = async () => {
    currentSize = 0;
    streamStartTime = Date.now();
    console.log("[MOCK CW] Rotated log stream");
  };

  const sendToCloudWatch = async (content: string) => {
    if (shouldRotate()) await rotate();
    currentSize += content.length;
    console.log(`[MOCK CW] Sending: ${content}`);
  };

  return {
    log: async (entry: {
      level: number;
      timestamp: string;
      message: string;
    }) => {
      if (entry.level < minLevel) return;
      const logLine = JSON.stringify(entry);
      await sendToCloudWatch(logLine);
    },
    setLevel: (level: LogLevel) => {
      minLevel = level;
    },
    getLevel: () => minLevel,
  };
};

// Minimal logger usage with mock CloudWatch transport
const env = getEnvironment();
const formatter = createJsonFormatter();
const cloudWatchTransport = createCloudWatchTransportExample({
  maxStreamSize: 1024, // 1KB for demo
  maxStreamAge: 10000, // 10s for demo
});

export const loggerWithCloudWatchTransport = createLogger({
  config: { serviceName: "cloudwatch-rotation-example" },
  transports: [cloudWatchTransport],
  formatter,
  env,
});
