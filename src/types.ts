export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

/**
 * Serialized error object for structured logging.
 * Unlike the Error class, this is a plain object safe for JSON serialization.
 */
export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
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
  instanceId?: string;
  /** Error handler called when a transport fails. Defaults to console.error. */
  onError?: TransportErrorHandler;
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
 */
export interface Logger {
  /** Log a debug message */
  debug(
    message: string,
    context?: LogContext,
    metadata?: Record<string, unknown>,
  ): Promise<void>;
  /** Log an info message */
  info(
    message: string,
    context?: LogContext,
    metadata?: Record<string, unknown>,
  ): Promise<void>;
  /** Log a warning message */
  warn(
    message: string,
    context?: LogContext,
    error?: Error,
    metadata?: Record<string, unknown>,
  ): Promise<void>;
  /** Log an error message */
  error(
    message: string,
    context?: LogContext,
    error?: Error,
    metadata?: Record<string, unknown>,
  ): Promise<void>;
  /** Log a fatal message */
  fatal(
    message: string,
    context?: LogContext,
    error?: Error,
    metadata?: Record<string, unknown>,
  ): Promise<void>;
  /** Log the start of a function */
  logFunctionStart(
    functionName: string,
    context?: LogContext,
    metadata?: Record<string, unknown>,
  ): Promise<void>;
  /** Log the end of a function with duration */
  logFunctionEnd(
    functionName: string,
    duration: number,
    context?: LogContext,
    metadata?: Record<string, unknown>,
  ): Promise<void>;
  /** Log a database operation */
  logDatabaseOperation(
    operation: string,
    table: string,
    context?: LogContext,
    metadata?: Record<string, unknown>,
  ): Promise<void>;
  /** Log an API request */
  logApiRequest(
    method: string,
    path: string,
    statusCode: number,
    context?: LogContext,
    metadata?: Record<string, unknown>,
  ): Promise<void>;
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
  /** Set the minimum log level */
  setLevel(level: LogLevel): void;
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
  /** Flush all transports */
  flush(): Promise<void>;
  /** Get batch statistics for all transports */
  getBatchStats(): Array<Record<string, unknown>>;
  /** Gracefully shutdown the logger, flushing all pending logs */
  shutdown(): Promise<void>;
}

/**
 * Simplified options for createLogger.
 * All fields are optional - sensible defaults are provided.
 */
export interface SimpleLoggerOptions {
  /** Service name for log identification */
  serviceName?: string;
  /** Environment stage (dev, staging, prod) */
  stage?: string;
  /** Minimum log level. Defaults to DEBUG in dev, INFO in prod */
  level?: LogLevel;
  /** Use pretty printing for console output. Defaults to true in dev */
  pretty?: boolean;
  /** Additional transports beyond the default console transport */
  transports?: Transport[];
  /** Error handler for transport failures */
  onError?: TransportErrorHandler;
}
