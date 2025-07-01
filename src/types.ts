export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export interface LogContext {
  requestId?: string;
  userId?: string;
  jobId?: string;
  functionName?: string;
  stage?: string;
  serviceName?: string;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  sessionId?: string;
  instanceId?: string; // Logger instance identifier
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: Error | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface LoggerConfig {
  level?: LogLevel;
  serviceName?: string | undefined;
  stage?: string | undefined;
  enableStructuredLogging?: boolean;
  includeTimestamp?: boolean;
  includeLogLevel?: boolean;
  customFields?: Record<string, unknown>;
  samplingRate?: number;
  rateLimit?: {
    maxLogsPerSecond: number;
    burstSize: number;
  };
  filter?: (entry: LogEntry) => boolean;
  validate?: ((entry: LogEntry) => void) | undefined;
  redact?: (entry: LogEntry) => LogEntry;
  hooks?: Array<(entry: LogEntry) => void | Promise<void>>;
  batching?: boolean;
  forbiddenKeys?: string[];
  forbiddenKeyAction?: "skip" | "redact";
  instanceId?: string; // Unique identifier for this logger instance
}

export interface Transport {
  log(entry: LogEntry): void | Promise<void>;
  setLevel(level: LogLevel): void;
  getLevel(): LogLevel;
  flush?: () => Promise<void>;
  getStats?: () => Record<string, unknown>;
}

export interface Formatter {
  format(entry: LogEntry): string;
}

export interface CloudWatchConfig {
  logGroupName: string;
  logStreamName?: string;
  region?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

export interface LoggerOptions {
  config?: LoggerConfig;
  transports?: Transport[];
  formatter?: Formatter;
}
