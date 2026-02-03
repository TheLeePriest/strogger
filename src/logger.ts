import {
  createJsonFormatter,
  createPrettyFormatter,
} from "./formatters/json-formatter";
import { createConsoleTransport } from "./transports/console-transport";
import { createCloudWatchTransport } from "./transports/cloudwatch-transport";
import { createDataDogTransport } from "./transports/datadog-transport";
import { createElasticsearchTransport } from "./transports/elasticsearch-transport";
import { createFileTransport } from "./transports/file-transport";
import { createNewRelicTransport } from "./transports/newrelic-transport";
import { createSplunkTransport } from "./transports/splunk-transport";
import type {
  Formatter,
  LogContext,
  LogData,
  LogEntry,
  Logger,
  LoggerConfig,
  QueueConfig,
  SerializedError,
  SimpleLoggerOptions,
  Transport,
  TransportErrorHandler,
  LogLevelInput,
} from "./types";
import { LogLevel, normalizeLogLevel, parseLogLevel } from "./types";
import { createBatchedTransport } from "./utils/batching";
import type { BatchedTransport } from "./utils/batching";
import { getContext } from "./utils/context";
import { generateLoggerInstanceId } from "./utils/enrichment";
import { getEnvironment } from "./utils/environment";
import type { LoggerEnvironment } from "./utils/environment";
import { createLogFilter } from "./utils/sampling";

// ============================================================================
// GLOBAL EXIT HANDLING
// ============================================================================

const loggerShutdownFns: Set<() => Promise<void>> = new Set();
let exitHandlersRegistered = false;

const registerLoggerForExit = (shutdownFn: () => Promise<void>): void => {
  loggerShutdownFns.add(shutdownFn);

  if (exitHandlersRegistered) return;
  exitHandlersRegistered = true;

  const exitHandler = (): void => {
    // Best effort flush all loggers
    for (const shutdown of loggerShutdownFns) {
      shutdown().catch(() => {});
    }
  };

  process.on("beforeExit", async () => {
    for (const shutdown of loggerShutdownFns) {
      await shutdown();
    }
  });

  process.on("SIGINT", () => {
    exitHandler();
    // Don't call process.exit here - let the normal flow continue
  });

  process.on("SIGTERM", () => {
    exitHandler();
    // Don't call process.exit here - let the normal flow continue
  });
};

// ============================================================================
// QUEUE MANAGEMENT
// ============================================================================

interface QueuedLogEntry {
  entry: LogEntry;
  sequence: number;
}

interface LogQueue {
  pending: QueuedLogEntry[];
  sequenceCounter: number;
  isProcessing: boolean;
  drainResolvers: Array<() => void>;
  droppedCount: number;
}

const DEFAULT_QUEUE_CONFIG: Required<QueueConfig> = {
  maxSize: 10000,
  maxBytes: 10 * 1024 * 1024, // 10MB
  overflowBehavior: 'drop-oldest',
  onBackpressure: () => {},
  fallbackInterval: 100,
  batchSize: 100,
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Default error handler that logs transport errors to console.
 */
const defaultErrorHandler: TransportErrorHandler = (error, transportName) => {
  console.error(
    `[strogger] Transport error${transportName ? ` (${transportName})` : ""}:`,
    error,
  );
};

/**
 * Get log level from environment, with fallback logic.
 */
const getLogLevelFromEnv = (env: LoggerEnvironment): LogLevel => {
  if (!env || typeof env !== "object") {
    return LogLevel.DEBUG;
  }

  const parsed = parseLogLevel(env.LOG_LEVEL);
  if (parsed !== undefined) {
    return parsed;
  }

  // No LOG_LEVEL set - use sensible defaults
  return env.STAGE === "prod" ? LogLevel.INFO : LogLevel.DEBUG;
};

const shouldLog = (level: LogLevel, minLevel: LogLevel): boolean => {
  return level >= minLevel;
};

/**
 * Serialize an Error object to a plain object for JSON logging.
 */
const serializeError = (error: Error): SerializedError => {
  const serialized: SerializedError = {
    name: error.name,
    message: error.message,
  };

  if (error.stack !== undefined) {
    serialized.stack = error.stack;
  }

  const errorWithCode = error as Error & {
    code?: string | number;
    statusCode?: number;
    status?: number;
    cause?: Error;
  };

  if (errorWithCode.code !== undefined) {
    serialized.code = errorWithCode.code;
  }

  if (errorWithCode.statusCode !== undefined) {
    serialized.statusCode = errorWithCode.statusCode;
  } else if (errorWithCode.status !== undefined) {
    serialized.statusCode = errorWithCode.status;
  }

  if (errorWithCode.cause instanceof Error) {
    serialized.cause = serializeError(errorWithCode.cause);
  }

  return serialized;
};

const createLogEntry = (
  serviceName: string | undefined,
  stage: string | undefined,
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: Error,
): LogEntry => {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    context: {
      ...(stage && { stage }),
      ...(serviceName && { serviceName }),
      ...context,
    },
    error: error ? serializeError(error) : undefined,
  };
};

// ============================================================================
// INTERNAL LOGGER
// ============================================================================

interface InternalLoggerOptions {
  config: LoggerConfig;
  transports: Array<Transport | BatchedTransport>;
  onError: TransportErrorHandler;
  instanceId: string;
  logFilter: ReturnType<typeof createLogFilter>;
  baseContext: LogContext;
  useBatching: boolean;
  queueConfig: Required<QueueConfig>;
}

const createLoggerInternal = (options: InternalLoggerOptions): Logger => {
  const { config, transports, onError, instanceId, logFilter, useBatching, queueConfig } =
    options;
  let { baseContext } = options;
  let isShutdown = false;
  let currentLevel = normalizeLogLevel(config.level ?? LogLevel.INFO);

  // Queue state
  const queue: LogQueue = {
    pending: [],
    sequenceCounter: 0,
    isProcessing: false,
    drainResolvers: [],
    droppedCount: 0,
  };

  let processingScheduled = false;
  let fallbackTimer: ReturnType<typeof setInterval> | null = null;

  // Process queue
  const processQueue = async (): Promise<void> => {
    if (queue.isProcessing || queue.pending.length === 0) {
      // Resolve any waiting drainers if queue is empty
      if (queue.pending.length === 0) {
        const resolvers = queue.drainResolvers.splice(0);
        for (const resolve of resolvers) resolve();
      }
      return;
    }

    queue.isProcessing = true;

    // Take a batch
    const batch = queue.pending.splice(0, queueConfig.batchSize);

    // Send to all transports
    if (transports.length === 1) {
      // Fast path for single transport
      const transport = transports[0]!;
      for (const { entry } of batch) {
        try {
          await transport.log(entry);
        } catch (err) {
          onError(err, (transport as { name?: string }).name || "transport-0");
        }
      }
    } else {
      // Multiple transports
      await Promise.allSettled(
        transports.map(async (transport, index) => {
          for (const { entry } of batch) {
            try {
              await transport.log(entry);
            } catch (err) {
              const transportName =
                (transport as { name?: string }).name || `transport-${index}`;
              onError(err, transportName);
            }
          }
        }),
      );
    }

    queue.isProcessing = false;

    // Continue if more pending
    if (queue.pending.length > 0) {
      scheduleProcessing();
    } else {
      // Resolve any waiting drainers
      const resolvers = queue.drainResolvers.splice(0);
      for (const resolve of resolvers) resolve();
    }
  };

  const scheduleProcessing = (): void => {
    if (processingScheduled) return;
    processingScheduled = true;

    queueMicrotask(() => {
      processingScheduled = false;
      processQueue().catch((err) => onError(err, "queue-processor"));
    });
  };

  const startFallbackTimer = (): void => {
    if (fallbackTimer) return;
    fallbackTimer = setInterval(() => {
      if (queue.pending.length > 0 && !queue.isProcessing) {
        processQueue().catch((err) => onError(err, "queue-processor"));
      }
    }, queueConfig.fallbackInterval);
  };

  const enqueue = (entry: LogEntry): void => {
    // Start fallback timer lazily
    startFallbackTimer();

    const queuedEntry: QueuedLogEntry = {
      entry,
      sequence: ++queue.sequenceCounter,
    };

    // Check backpressure
    if (queue.pending.length >= queueConfig.maxSize) {
      if (queueConfig.overflowBehavior === 'drop-oldest') {
        queue.pending.shift();
        queue.droppedCount++;
      } else if (queueConfig.overflowBehavior === 'drop-newest') {
        queue.droppedCount++;
        return;
      }
      // 'warn' behavior: add anyway
      queueConfig.onBackpressure({
        queueSize: queue.pending.length,
        droppedCount: queue.droppedCount,
      });
    }

    queue.pending.push(queuedEntry);
    scheduleProcessing();
  };

  const log = (
    level: LogLevel,
    message: string,
    data?: LogData,
  ): void => {
    if (isShutdown) return;
    if (!shouldLog(level, currentLevel)) return;

    // Check sampling and rate limiting only if configured
    if (config.samplingRate !== undefined || config.rateLimit) {
      if (!logFilter.shouldLog()) return;
    }

    // Extract error from data if present
    const { err, ...contextData } = data || {};

    // Merge contexts: AsyncLocalStorage -> baseContext -> call context
    const asyncContext = getContext();
    const mergedContext: LogContext = {
      ...asyncContext,
      ...baseContext,
      ...contextData,
      instanceId,
    };

    // Create log entry
    const entry = createLogEntry(
      config.serviceName,
      config.stage,
      level,
      message,
      mergedContext,
      err,
    );

    // Apply redaction if configured
    let processedEntry: LogEntry = entry;
    if (typeof config.redact === "function") {
      processedEntry = config.redact(entry);
    }

    // Apply validation if configured
    if (typeof config.validate === "function") {
      try {
        config.validate(processedEntry);
      } catch (validationError) {
        onError(validationError, "validation");
        return;
      }
    }

    // Execute hooks synchronously (fire-and-forget for async hooks)
    if (Array.isArray(config.hooks)) {
      for (const hook of config.hooks) {
        try {
          const result = hook(processedEntry);
          // Don't await - fire and forget for async hooks
          if (result && typeof result.then === "function") {
            result.catch((err: unknown) => onError(err, "hook"));
          }
        } catch (hookError) {
          onError(hookError, "hook");
        }
      }
    }

    // Enqueue for async processing
    enqueue(processedEntry);
  };

  const flush = async (): Promise<void> => {
    // Process any remaining queue
    while (queue.pending.length > 0 || queue.isProcessing) {
      if (queue.pending.length > 0 && !queue.isProcessing) {
        await processQueue();
      } else if (queue.isProcessing) {
        // Wait for current processing to complete
        await new Promise<void>((resolve) => {
          queue.drainResolvers.push(resolve);
        });
      }
    }

    // Flush transports
    await Promise.allSettled(
      transports.map((transport) => transport.flush?.() || Promise.resolve()),
    );
  };

  const shutdown = async (): Promise<void> => {
    if (isShutdown) return;
    isShutdown = true;

    // Stop fallback timer
    if (fallbackTimer) {
      clearInterval(fallbackTimer);
      fallbackTimer = null;
    }

    // Flush queue and transports
    await flush();

    // Close transports
    await Promise.allSettled(
      transports.map(async (transport) => {
        if ("close" in transport && typeof transport.close === "function") {
          await (transport as BatchedTransport).close();
        }
      }),
    );
  };

  // Track this logger for global exit handling
  registerLoggerForExit(shutdown);

  const logger: Logger = {
    debug: (message, data?) => log(LogLevel.DEBUG, message, data),
    info: (message, data?) => log(LogLevel.INFO, message, data),
    warn: (message, data?) => log(LogLevel.WARN, message, data),
    error: (message, data?) => log(LogLevel.ERROR, message, data),
    fatal: (message, data?) => log(LogLevel.FATAL, message, data),

    child: (childContext: LogContext): Logger => {
      return createLoggerInternal({
        ...options,
        baseContext: { ...baseContext, ...childContext },
      });
    },

    setLevel: (level: LogLevelInput): void => {
      currentLevel = normalizeLogLevel(level);
      for (const t of transports) {
        t.setLevel(currentLevel);
      }
    },

    getLevel: (): LogLevel => currentLevel,

    getInstanceId: (): string => instanceId,

    addTransport: (transport: Transport): void => {
      if (useBatching) {
        transports.push(
          createBatchedTransport(transport, {
            maxSize: 50,
            maxWaitTime: 2000,
            maxBatchSize: 512 * 1024,
          }),
        );
      } else {
        transports.push(transport);
      }
    },

    removeTransport: (transport: Transport): void => {
      const idx = transports.indexOf(transport);
      if (idx > -1) transports.splice(idx, 1);
    },

    getSamplingStats: () => logFilter.getStats(),

    flush,

    getBatchStats: () => transports.map((t) => t.getStats?.() || {}),

    shutdown,
  };

  return logger;
};

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Advanced options for createLogger (backward compatible)
 */
export interface CreateLoggerOptions {
  config?: LoggerConfig;
  transports?: Transport[];
  /** @deprecated Formatter is configured on transports, not the logger */
  formatter?: Formatter;
  env?: LoggerEnvironment;
}

/**
 * Create a logger with full configuration options.
 *
 * For most use cases, the simpler `logger()` function is recommended.
 *
 * @example
 * ```typescript
 * const log = createLogger({
 *   config: { serviceName: 'my-service', level: 'debug' },
 *   transports: [createConsoleTransport({ formatter: createJsonFormatter() })],
 * });
 * ```
 */
export const createLogger = (options: CreateLoggerOptions = {}): Logger => {
  const env = options.env || getEnvironment();
  const instanceId = options.config?.instanceId || generateLoggerInstanceId();

  const config: LoggerConfig = {
    level: options.config?.level ?? getLogLevelFromEnv(env),
    serviceName: options.config?.serviceName || env.SERVICE_NAME,
    stage: options.config?.stage || env.STAGE || "dev",
    instanceId,
    ...options.config,
  };

  // Normalize level if string
  const normalizedLevel = normalizeLogLevel(config.level ?? LogLevel.INFO);
  config.level = normalizedLevel;

  const queueConfig: Required<QueueConfig> = {
    ...DEFAULT_QUEUE_CONFIG,
    ...config.queue,
  };

  const useBatching = options.config?.batching === true;
  const transports: Array<Transport | BatchedTransport> = useBatching
    ? (options.transports || []).map((t) =>
        createBatchedTransport(t, {
          maxSize: 50,
          maxWaitTime: 2000,
          maxBatchSize: 512 * 1024,
        }),
      )
    : options.transports || [];

  // If no transports provided, add default console transport
  if (transports.length === 0) {
    const isProd = config.stage === "prod" || config.stage === "production";
    const formatter = isProd ? createJsonFormatter() : createPrettyFormatter();
    transports.push(
      createConsoleTransport({ formatter, level: normalizedLevel }),
    );
  }

  return createLoggerInternal({
    config,
    transports,
    onError: config.onError || defaultErrorHandler,
    instanceId,
    logFilter: createLogFilter(config),
    baseContext: {},
    useBatching,
    queueConfig,
  });
};

/**
 * Create a logger with simple, sensible defaults.
 *
 * This is the recommended way to create a logger for most applications.
 *
 * @example
 * ```typescript
 * // Minimal - just works
 * const log = logger();
 *
 * // With service name
 * const log = logger({ serviceName: 'api-server' });
 *
 * // With options
 * const log = logger({
 *   serviceName: 'api-server',
 *   level: 'debug',  // or LogLevel.DEBUG
 *   pretty: true,
 * });
 * ```
 */
export const logger = (options: SimpleLoggerOptions = {}): Logger => {
  const env = getEnvironment();
  const isProd = (options.stage || env.STAGE) === "prod";
  const usePretty = options.pretty ?? !isProd;

  const formatter = usePretty ? createPrettyFormatter() : createJsonFormatter();
  const jsonFormatter = createJsonFormatter();
  const level = normalizeLogLevel(options.level ?? (isProd ? LogLevel.INFO : LogLevel.DEBUG));
  const serviceName = options.serviceName || env.SERVICE_NAME;

  const transports: Transport[] = [
    createConsoleTransport({ formatter, level }),
    ...(options.transports || []),
  ];

  // Process shorthand transport configs
  if (options.datadog) {
    const ddOpts = options.datadog === true ? {} : options.datadog;
    transports.push(createDataDogTransport({
      formatter: jsonFormatter,
      level,
      ...(serviceName && { serviceName }),
      ...ddOpts,
    }));
  }

  if (options.cloudwatch) {
    transports.push(createCloudWatchTransport({
      formatter: jsonFormatter,
      level,
      ...options.cloudwatch,
    }));
  }

  if (options.splunk) {
    const splunkOpts = options.splunk === true ? {} : options.splunk;
    transports.push(createSplunkTransport({
      formatter: jsonFormatter,
      level,
      ...splunkOpts,
    }));
  }

  if (options.elasticsearch) {
    const esOpts = options.elasticsearch === true ? {} : options.elasticsearch;
    transports.push(createElasticsearchTransport({
      formatter: jsonFormatter,
      level,
      ...esOpts,
    }));
  }

  if (options.newrelic) {
    const nrOpts = options.newrelic === true ? {} : options.newrelic;
    transports.push(createNewRelicTransport({
      formatter: jsonFormatter,
      level,
      ...(serviceName && { serviceName }),
      ...nrOpts,
    }));
  }

  if (options.file) {
    const fileOpts = options.file === true ? {} : options.file;
    transports.push(createFileTransport({
      formatter: jsonFormatter,
      level,
      ...fileOpts,
    }));
  }

  const config: LoggerConfig = {
    serviceName,
    stage: options.stage || env.STAGE || "dev",
    level,
  };

  if (options.onError) {
    config.onError = options.onError;
  }

  return createLogger({
    config,
    transports,
  });
};

// ============================================================================
// DEFAULT INSTANCE (Lazy Initialization)
// ============================================================================

let _defaultLogger: Logger | null = null;

/**
 * Get the default logger instance, creating it lazily on first access.
 * Uses pretty printing in development, JSON in production.
 */
const getDefaultLogger = (): Logger => {
  if (!_defaultLogger) {
    _defaultLogger = logger();
  }
  return _defaultLogger;
};

/**
 * Default logger instance with sensible defaults.
 * Uses pretty printing in development, JSON in production.
 * Lazily initialized on first use.
 *
 * @example
 * ```typescript
 * import { strogger } from 'strogger';
 *
 * strogger.info('Hello world');
 * strogger.info('User logged in', { userId: '123' });
 * ```
 */
export const strogger: Logger = new Proxy({} as Logger, {
  get(_target, prop: keyof Logger) {
    return getDefaultLogger()[prop];
  },
});

// ============================================================================
// UTILITIES
// ============================================================================

export const printLoggerConfig = (env?: LoggerEnvironment): void => {
  const e = env || getEnvironment();
  const level = getLogLevelFromEnv(e);
  console.log("--- Strogger Logger Configuration ---");
  console.log("LOG_LEVEL:", e.LOG_LEVEL ?? "(default)");
  console.log("STAGE:", e.STAGE ?? "dev");
  console.log("SERVICE_NAME:", e.SERVICE_NAME ?? "(none)");
  console.log("Effective log level:", LogLevel[level]);
  console.log("--------------------------------------");
};
