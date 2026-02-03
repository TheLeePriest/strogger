export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

/**
 * Log level input - accepts both enum values and string names.
 * Allows `LogLevel.DEBUG` or `'debug'` interchangeably.
 */
export type LogLevelInput = LogLevel | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Normalize a LogLevelInput to a LogLevel enum value.
 */
export const normalizeLogLevel = (level: LogLevelInput): LogLevel => {
  if (typeof level === 'number') return level;
  return parseLogLevel(level) ?? LogLevel.INFO;
};

/**
 * Serialized error object for structured logging.
 * Unlike the Error class, this is a plain object safe for JSON serialization.
 */
export interface SerializedError {
  /** Error name/type (e.g., "TypeError", "ValidationError") */
  name: string;
  /** Error message */
  message: string;
  /** Stack trace if available */
  stack?: string;
  /** Error code if available (e.g., "ENOENT", "ERR_HTTP_INVALID_STATUS_CODE") */
  code?: string | number;
  /** HTTP status code if this is an HTTP error */
  statusCode?: number;
  /** Cause of the error if available (from Error.cause) */
  cause?: SerializedError;
}

/**
 * Parse a string log level to LogLevel enum value.
 * Returns undefined if the string is not a valid log level.
 */
export const parseLogLevel = (
  level: string | undefined,
): LogLevel | undefined => {
  if (!level) return undefined;
  switch (level.toUpperCase()) {
    case "DEBUG":
      return LogLevel.DEBUG;
    case "INFO":
      return LogLevel.INFO;
    case "WARN":
      return LogLevel.WARN;
    case "ERROR":
      return LogLevel.ERROR;
    case "FATAL":
      return LogLevel.FATAL;
    default:
      return undefined;
  }
};

/**
 * Convert LogLevel enum to string representation.
 */
export const logLevelToString = (level: LogLevel): string => {
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

/**
 * Standard context fields for request tracing and correlation.
 */
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
  instanceId?: string;
  [key: string]: unknown;
}

/**
 * Data object passed to log methods.
 * Combines context, error, and any additional fields.
 *
 * @example
 * ```typescript
 * log.info('User logged in', { userId: '123', requestId: 'req-456' });
 * log.error('Failed', { err: new Error('oops'), userId: '123' });
 * ```
 */
export interface LogData extends LogContext {
  /** Error object to be serialized with the log entry */
  err?: Error;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: SerializedError | undefined;
  metadata?: Record<string, unknown> | undefined;
}

/**
 * Error handler callback for transport errors.
 */
export type TransportErrorHandler = (
  error: unknown,
  transportName?: string,
) => void;

/**
 * Queue configuration for async log processing.
 */
export interface QueueConfig {
  /** Maximum entries before backpressure (default: 10000) */
  maxSize?: number;
  /** Maximum estimated bytes before backpressure (default: 10MB) */
  maxBytes?: number;
  /** Behavior when queue is full (default: 'drop-oldest') */
  overflowBehavior?: 'drop-oldest' | 'drop-newest' | 'warn';
  /** Callback when backpressure is triggered */
  onBackpressure?: (stats: { queueSize: number; droppedCount: number }) => void;
  /** Fallback processing interval in ms (default: 100) */
  fallbackInterval?: number;
  /** Maximum logs to process per batch (default: 100) */
  batchSize?: number;
}

export interface LoggerConfig {
  level?: LogLevelInput;
  serviceName?: string | undefined;
  stage?: string | undefined;
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
  instanceId?: string;
  /** Error handler called when a transport fails. Defaults to console.error. */
  onError?: TransportErrorHandler;
  /** Queue configuration for async processing */
  queue?: QueueConfig;
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

/**
 * Logger instance returned by createLogger.
 *
 * All log methods are synchronous (fire-and-forget). Use flush() or shutdown()
 * to wait for pending logs to be written.
 *
 * @example
 * ```typescript
 * const log = logger({ serviceName: 'my-app' });
 *
 * // Simple logging
 * log.info('Hello world');
 *
 * // With data
 * log.info('User action', { userId: '123', action: 'login' });
 *
 * // With error
 * log.error('Failed', { err: new Error('oops'), userId: '123' });
 *
 * // Wait for logs before exit
 * await log.shutdown();
 * ```
 */
export interface Logger {
  /** Log a debug message */
  debug(message: string, data?: LogData): void;
  /** Log an info message */
  info(message: string, data?: LogData): void;
  /** Log a warning message */
  warn(message: string, data?: LogData): void;
  /** Log an error message */
  error(message: string, data?: LogData): void;
  /** Log a fatal message */
  fatal(message: string, data?: LogData): void;
  /**
   * Create a child logger with additional context.
   * The child logger inherits all settings from the parent but adds the given context to every log.
   *
   * @example
   * ```typescript
   * const requestLogger = logger.child({ requestId: 'req-123', userId: 'user-456' });
   * requestLogger.info('Processing'); // Automatically includes requestId and userId
   * requestLogger.info('Done');       // Same context, no need to repeat
   * ```
   */
  child(context: LogContext): Logger;
  /** Set the minimum log level (accepts string or enum) */
  setLevel(level: LogLevelInput): void;
  /** Get the current minimum log level */
  getLevel(): LogLevel;
  /** Get the unique instance ID of this logger */
  getInstanceId(): string;
  /** Add a transport to this logger */
  addTransport(transport: Transport): void;
  /** Remove a transport from this logger */
  removeTransport(transport: Transport): void;
  /** Get sampling statistics */
  getSamplingStats(): {
    rateLimit:
      | {
          tokens: number;
          lastRefill: number;
          maxTokens: number;
          refillRate: number;
        }
      | undefined;
    sampling:
      | {
          totalLogs: number;
          sampledLogs: number;
          samplingRate: number;
          configuredRate: number;
        }
      | undefined;
  };
  /** Flush all pending logs to transports */
  flush(): Promise<void>;
  /** Get batch statistics for all transports */
  getBatchStats(): Array<Record<string, unknown>>;
  /** Gracefully shutdown the logger, flushing all pending logs */
  shutdown(): Promise<void>;
}

/**
 * Shorthand configuration for DataDog transport.
 * Set to `true` to use environment variables, or pass options.
 */
export type DataDogShorthand = boolean | {
  apiKey?: string;
  serviceName?: string;
  region?: 'us' | 'eu';
  tags?: string[];
};

/**
 * Shorthand configuration for CloudWatch transport.
 * Requires logGroupName (no boolean shorthand since it's required).
 */
export type CloudWatchShorthand = {
  logGroupName: string;
  logStreamName?: string;
  region?: string;
};

/**
 * Shorthand configuration for Splunk transport.
 * Set to `true` to use environment variables, or pass options.
 */
export type SplunkShorthand = boolean | {
  hecUrl?: string;
  hecToken?: string;
  source?: string;
  sourcetype?: string;
  index?: string;
};

/**
 * Shorthand configuration for Elasticsearch transport.
 * Set to `true` to use environment variables, or pass options.
 */
export type ElasticsearchShorthand = boolean | {
  url?: string;
  apiKey?: string;
  username?: string;
  password?: string;
  index?: string;
};

/**
 * Shorthand configuration for New Relic transport.
 * Set to `true` to use environment variables, or pass options.
 */
export type NewRelicShorthand = boolean | {
  apiKey?: string;
  accountId?: string;
  region?: string;
};

/**
 * Shorthand configuration for file transport.
 */
export type FileShorthand = boolean | {
  path?: string;
  maxSize?: number;
  maxFiles?: number;
};

/**
 * Simplified options for createLogger.
 * All fields are optional - sensible defaults are provided.
 */
export interface SimpleLoggerOptions {
  /** Service name for log identification */
  serviceName?: string;
  /** Environment stage (dev, staging, prod) */
  stage?: string;
  /** Minimum log level. Defaults to DEBUG in dev, INFO in prod. Accepts string or enum. */
  level?: LogLevelInput;
  /** Use pretty printing for console output. Defaults to true in dev */
  pretty?: boolean;
  /** Additional transports beyond the default console transport */
  transports?: Transport[];
  /** Error handler for transport failures */
  onError?: TransportErrorHandler;

  // ============================================================================
  // SHORTHAND TRANSPORT CONFIGS
  // ============================================================================

  /**
   * DataDog transport. Set to `true` to use DATADOG_API_KEY env var,
   * or pass options object.
   * @example
   * datadog: true
   * datadog: { region: 'eu' }
   */
  datadog?: DataDogShorthand;

  /**
   * AWS CloudWatch transport. Requires logGroupName.
   * @example
   * cloudwatch: { logGroupName: '/app/logs' }
   */
  cloudwatch?: CloudWatchShorthand;

  /**
   * Splunk HEC transport. Set to `true` to use SPLUNK_HEC_URL and
   * SPLUNK_HEC_TOKEN env vars, or pass options object.
   * @example
   * splunk: true
   * splunk: { index: 'main' }
   */
  splunk?: SplunkShorthand;

  /**
   * Elasticsearch transport. Set to `true` to use env vars,
   * or pass options object.
   * @example
   * elasticsearch: true
   * elasticsearch: { url: 'http://localhost:9200' }
   */
  elasticsearch?: ElasticsearchShorthand;

  /**
   * New Relic transport. Set to `true` to use NEW_RELIC_LICENSE_KEY
   * and NEW_RELIC_ACCOUNT_ID env vars, or pass options object.
   * @example
   * newrelic: true
   * newrelic: { region: 'eu' }
   */
  newrelic?: NewRelicShorthand;

  /**
   * File transport. Set to `true` for default file logging,
   * or pass options object.
   * @example
   * file: true
   * file: { path: './logs/app.log', maxSize: 10485760 }
   */
  file?: FileShorthand;
}
