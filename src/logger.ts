import {
  createJsonFormatter,
  createPrettyFormatter,
} from "./formatters/json-formatter";
import { createConsoleTransport } from "./transports/console-transport";
import type {
  Formatter,
  LogContext,
  LogEntry,
  Logger,
  LoggerConfig,
  SerializedError,
  SimpleLoggerOptions,
  Transport,
  TransportErrorHandler,
} from "./types";
import { LogLevel, parseLogLevel } from "./types";
import { createBatchedTransport } from "./utils/batching";
import type { BatchedTransport } from "./utils/batching";
import { getContext } from "./utils/context";
import { generateLoggerInstanceId } from "./utils/enrichment";
import { getEnvironment } from "./utils/environment";
import type { LoggerEnvironment } from "./utils/environment";
import { createLogFilter } from "./utils/sampling";

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
 * Extracts standard and common custom error properties for structured logging.
 */
const serializeError = (error: Error): SerializedError => {
  const serialized: SerializedError = {
    name: error.name,
    message: error.message,
  };

  if (error.stack !== undefined) {
    serialized.stack = error.stack;
  }

  // Extract common error properties
  const errorWithCode = error as Error & {
    code?: string | number;
    statusCode?: number;
    status?: number;
    cause?: Error;
  };

  if (errorWithCode.code !== undefined) {
    serialized.code = errorWithCode.code;
  }

  // Support both statusCode and status (common in HTTP libraries)
  if (errorWithCode.statusCode !== undefined) {
    serialized.statusCode = errorWithCode.statusCode;
  } else if (errorWithCode.status !== undefined) {
    serialized.statusCode = errorWithCode.status;
  }

  // Recursively serialize the cause chain (ES2022 Error.cause)
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
  metadata?: Record<string, unknown>,
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
    metadata,
  };
};

/**
 * Internal logger creation with full options.
 * Used by both createLogger and child().
 */
interface InternalLoggerOptions {
  config: LoggerConfig;
  transports: Array<Transport | BatchedTransport>;
  onError: TransportErrorHandler;
  instanceId: string;
  logFilter: ReturnType<typeof createLogFilter>;
  baseContext: LogContext;
  useBatching: boolean;
}

const createLoggerInternal = (options: InternalLoggerOptions): Logger => {
  const { config, transports, onError, instanceId, logFilter, useBatching } =
    options;
  let { baseContext } = options;
  let isShutdown = false;
  let currentLevel = config.level ?? LogLevel.INFO;

  const log = async (
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error,
    metadata?: Record<string, unknown>,
  ): Promise<void> => {
    if (isShutdown) return;
    if (!shouldLog(level, currentLevel)) return;

    // Check sampling and rate limiting only if configured
    if (config.samplingRate !== undefined || config.rateLimit) {
      if (!logFilter.shouldLog()) return;
    }

    // Merge contexts: AsyncLocalStorage -> baseContext -> call context
    const asyncContext = getContext();
    const mergedContext: LogContext = {
      ...asyncContext,
      ...baseContext,
      ...context,
      instanceId,
    };

    // Create log entry
    const entry = createLogEntry(
      config.serviceName,
      config.stage,
      level,
      message,
      mergedContext,
      error,
      metadata,
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

    // Execute hooks if configured
    if (Array.isArray(config.hooks)) {
      for (const hook of config.hooks) {
        try {
          const result = hook(processedEntry);
          if (result && typeof result.then === "function") {
            await result;
          }
        } catch (hookError) {
          onError(hookError, "hook");
        }
      }
    }

    // Send to all transports
    const results = await Promise.allSettled(
      transports.map(async (transport, index) => {
        try {
          await transport.log(processedEntry);
        } catch (err: unknown) {
          const transportName =
            (transport as { name?: string }).name || `transport-${index}`;
          throw { error: err, transportName };
        }
      }),
    );

    for (const result of results) {
      if (result.status === "rejected") {
        const { error: err, transportName } = result.reason as {
          error: unknown;
          transportName: string;
        };
        onError(err, transportName);
      }
    }
  };

  const logger: Logger = {
    debug: (message, context?, metadata?) =>
      log(LogLevel.DEBUG, message, context, undefined, metadata),
    info: (message, context?, metadata?) =>
      log(LogLevel.INFO, message, context, undefined, metadata),
    warn: (message, context?, error?, metadata?) =>
      log(LogLevel.WARN, message, context, error, metadata),
    error: (message, context?, error?, metadata?) =>
      log(LogLevel.ERROR, message, context, error, metadata),
    fatal: (message, context?, error?, metadata?) =>
      log(LogLevel.FATAL, message, context, error, metadata),

    logFunctionStart: (functionName, context?, metadata?) =>
      log(
        LogLevel.INFO,
        `Function ${functionName} started`,
        { ...context, functionName },
        undefined,
        metadata,
      ),

    logFunctionEnd: (functionName, duration, context?, metadata?) =>
      log(
        LogLevel.INFO,
        `Function ${functionName} completed in ${duration}ms`,
        { ...context, functionName, duration },
        undefined,
        metadata,
      ),

    logDatabaseOperation: (operation, table, context?, metadata?) =>
      log(
        LogLevel.DEBUG,
        `Database operation: ${operation} on table ${table}`,
        { ...context, operation, table },
        undefined,
        metadata,
      ),

    logApiRequest: (method, path, statusCode, context?, metadata?) =>
      log(
        LogLevel.INFO,
        `API ${method} ${path} - ${statusCode}`,
        { ...context, method, path, statusCode },
        undefined,
        metadata,
      ),

    child: (childContext: LogContext): Logger => {
      // Create a new logger with merged context
      return createLoggerInternal({
        ...options,
        baseContext: { ...baseContext, ...childContext },
      });
    },

    setLevel: (level: LogLevel): void => {
      currentLevel = level;
      for (const t of transports) {
        t.setLevel(level);
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

    flush: async (): Promise<void> => {
      await Promise.allSettled(
        transports.map((transport) => transport.flush?.() || Promise.resolve()),
      );
    },

    getBatchStats: () => transports.map((t) => t.getStats?.() || {}),

    shutdown: async (): Promise<void> => {
      if (isShutdown) return;
      isShutdown = true;

      await Promise.allSettled(
        transports.map(async (transport) => {
          if (transport.flush) {
            await transport.flush();
          }
          if ("close" in transport && typeof transport.close === "function") {
            await (transport as BatchedTransport).close();
          }
        }),
      );
    },
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
 *   config: { serviceName: 'my-service', level: LogLevel.DEBUG },
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
    enableStructuredLogging: env.ENABLE_STRUCTURED_LOGGING ?? true,
    instanceId,
    ...options.config,
  };

  // Normalize level if string
  if (typeof config.level === "string") {
    config.level = parseLogLevel(config.level as string) ?? LogLevel.INFO;
  }

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
    const transportLevel = config.level ?? LogLevel.INFO;
    transports.push(
      createConsoleTransport({ formatter, level: transportLevel }),
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
 *   level: LogLevel.DEBUG,
 *   pretty: true,
 * });
 * ```
 */
export const logger = (options: SimpleLoggerOptions = {}): Logger => {
  const env = getEnvironment();
  const isProd = (options.stage || env.STAGE) === "prod";
  const usePretty = options.pretty ?? !isProd;

  const formatter = usePretty ? createPrettyFormatter() : createJsonFormatter();
  const level = options.level ?? (isProd ? LogLevel.INFO : LogLevel.DEBUG);

  const transports: Transport[] = [
    createConsoleTransport({ formatter, level }),
    ...(options.transports || []),
  ];

  const config: LoggerConfig = {
    serviceName: options.serviceName || env.SERVICE_NAME,
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
// DEFAULT INSTANCE
// ============================================================================

/**
 * Default logger instance with sensible defaults.
 * Uses pretty printing in development, JSON in production.
 *
 * @example
 * ```typescript
 * import { strogger } from 'strogger';
 *
 * strogger.info('Hello world');
 * strogger.info('User logged in', { userId: '123' });
 * ```
 */
export const strogger = logger();

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
