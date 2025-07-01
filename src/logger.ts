import { createJsonFormatter } from "./formatters/json-formatter";
import { createConsoleTransport } from "./transports/console-transport";
import type {
  Formatter,
  LogContext,
  LogEntry,
  LoggerConfig,
  Transport,
} from "./types";
import { LogLevel } from "./types";
import { createBatchedTransport } from "./utils/batching";
import {
  createDefaultEnrichmentMiddleware,
  generateLoggerInstanceId,
} from "./utils/enrichment";
import { getEnvironment } from "./utils/environment";
import type { LoggerEnvironment } from "./utils/environment";
import { createLogFilter } from "./utils/sampling";

const getLogLevelFromEnv = (env: LoggerEnvironment): LogLevel => {
  const level = env.LOG_LEVEL?.toUpperCase();
  switch (level) {
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
      return env.STAGE === "prod" ? LogLevel.INFO : LogLevel.DEBUG;
  }
};

const shouldLog = (level: LogLevel, config: LoggerConfig): boolean => {
  return level >= (config.level !== undefined ? config.level : LogLevel.INFO);
};

const createLogEntry = (
  config: LoggerConfig,
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: Error,
  metadata?: Record<string, unknown>,
) => {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    context: {
      ...(config.stage && { stage: config.stage }),
      ...(config.serviceName && { serviceName: config.serviceName }),
      ...context,
    },
    error: error
      ? ({
          name: error.name,
          message: error.message,
          stack: error.stack,
        } as Error)
      : undefined,
    metadata,
  };
};

export const createLogger = ({
  config = {},
  transports = [],
  formatter: _formatter,
  env,
}: {
  config?: LoggerConfig;
  transports?: Transport[];
  formatter: Formatter;
  env: LoggerEnvironment;
}) => {
  // Generate or use provided instance ID
  const instanceId = config.instanceId || generateLoggerInstanceId();

  // Merge config: config.level should override env
  const mergedConfig: LoggerConfig = {
    level: getLogLevelFromEnv(env),
    serviceName: env.SERVICE_NAME || undefined,
    stage: env.STAGE || "dev",
    enableStructuredLogging: env.ENABLE_STRUCTURED_LOGGING ?? true,
    includeTimestamp: true,
    includeLogLevel: true,
    instanceId, // Always include the instance ID
    ...config, // config.level will override above
  };

  // Normalize config.level to a number
  if (typeof mergedConfig.level === "string") {
    switch ((mergedConfig.level as string).toUpperCase()) {
      case "DEBUG":
        mergedConfig.level = LogLevel.DEBUG;
        break;
      case "INFO":
        mergedConfig.level = LogLevel.INFO;
        break;
      case "WARN":
        mergedConfig.level = LogLevel.WARN;
        break;
      case "ERROR":
        mergedConfig.level = LogLevel.ERROR;
        break;
      case "FATAL":
        mergedConfig.level = LogLevel.FATAL;
        break;
      default:
        mergedConfig.level = LogLevel.INFO;
    }
  }

  // Always prefer explicit userConfig.level if provided (even if 0)
  if (config.level !== undefined) {
    mergedConfig.level = config.level;
  }

  // Create sampling and rate limiting filter
  const logFilter = createLogFilter(mergedConfig);

  // Create enrichment middleware
  const enrichmentMiddleware = createDefaultEnrichmentMiddleware(
    mergedConfig.serviceName,
    mergedConfig.stage,
    undefined, // sessionId
    instanceId, // instanceId
  );

  // Only use batching if explicitly configured
  const useBatching = config.batching === true;
  const loggerTransports = useBatching
    ? transports.map((transport) =>
        createBatchedTransport(transport, {
          maxSize: 50,
          maxWaitTime: 2000,
          maxBatchSize: 512 * 1024,
        }),
      )
    : transports;

  const log = async (
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error,
    metadata?: Record<string, unknown>,
  ) => {
    // Check log level first
    if (!shouldLog(level, mergedConfig)) {
      return;
    }

    // Check sampling and rate limiting only if configured
    if (mergedConfig.samplingRate !== undefined || mergedConfig.rateLimit) {
      if (!logFilter.shouldLog()) {
        return;
      }
    }

    // Enrich context with correlation IDs and tracing
    const enrichedContext = enrichmentMiddleware(context || {});

    // Create log entry
    const entry = createLogEntry(
      mergedConfig,
      level,
      message,
      enrichedContext,
      error,
      metadata,
    );

    // Medium-priority: log redaction/encryption
    let processedEntry: LogEntry = entry;
    if (typeof mergedConfig.redact === "function") {
      processedEntry = mergedConfig.redact(entry);
    }

    // Medium-priority: log validation
    if (typeof mergedConfig.validate === "function") {
      try {
        mergedConfig.validate(processedEntry);
      } catch (validationError) {
        // Log validation error and skip sending
        console.error(
          "[LOGGER ERROR] Log entry validation failed:",
          validationError,
        );
        return;
      }
    }

    // Medium-priority: custom hooks (analytics/metrics)
    if (Array.isArray(mergedConfig.hooks)) {
      for (const hook of mergedConfig.hooks) {
        try {
          // Await if hook returns a promise
          const result = hook(processedEntry);
          if (result && typeof result.then === "function") {
            await result;
          }
        } catch (hookError) {
          // Log hook errors but do not block logging
          console.error("[LOGGER ERROR] Log hook failed:", hookError);
        }
      }
    }

    // Send to all transports
    const results = await Promise.allSettled(
      loggerTransports.map((transport) => transport.log(processedEntry)),
    );

    // Log any async transport errors
    for (const result of results) {
      if (result.status === "rejected") {
        console.error(result.reason);
      }
    }
  };

  return {
    debug: (
      message: string,
      context?: LogContext,
      metadata?: Record<string, unknown>,
    ) => log(LogLevel.DEBUG, message, context, undefined, metadata),
    info: (
      message: string,
      context?: LogContext,
      metadata?: Record<string, unknown>,
    ) => log(LogLevel.INFO, message, context, undefined, metadata),
    warn: (
      message: string,
      context?: LogContext,
      error?: Error,
      metadata?: Record<string, unknown>,
    ) => log(LogLevel.WARN, message, context, error, metadata),
    error: (
      message: string,
      context?: LogContext,
      error?: Error,
      metadata?: Record<string, unknown>,
    ) => log(LogLevel.ERROR, message, context, error, metadata),
    fatal: (
      message: string,
      context?: LogContext,
      error?: Error,
      metadata?: Record<string, unknown>,
    ) => log(LogLevel.FATAL, message, context, error, metadata),
    logFunctionStart: (
      functionName: string,
      context?: LogContext,
      metadata?: Record<string, unknown>,
    ) =>
      log(
        LogLevel.INFO,
        `Function ${functionName} started`,
        { ...context, functionName },
        undefined,
        metadata,
      ),
    logFunctionEnd: (
      functionName: string,
      duration: number,
      context?: LogContext,
      metadata?: Record<string, unknown>,
    ) =>
      log(
        LogLevel.INFO,
        `Function ${functionName} completed in ${duration}ms`,
        { ...context, functionName, duration },
        undefined,
        metadata,
      ),
    logDatabaseOperation: (
      operation: string,
      table: string,
      context?: LogContext,
      metadata?: Record<string, unknown>,
    ) =>
      log(
        LogLevel.DEBUG,
        `Database operation: ${operation} on table ${table}`,
        { ...context, operation, table },
        undefined,
        metadata,
      ),
    logApiRequest: (
      method: string,
      path: string,
      statusCode: number,
      context?: LogContext,
      metadata?: Record<string, unknown>,
    ) =>
      log(
        LogLevel.INFO,
        `API ${method} ${path} - ${statusCode}`,
        { ...context, method, path, statusCode },
        undefined,
        metadata,
      ),
    setLevel: (level: LogLevel) => {
      mergedConfig.level = level;
      for (const t of transports) {
        t.setLevel?.(level);
      }
    },
    getLevel: () =>
      mergedConfig.level !== undefined ? mergedConfig.level : LogLevel.INFO,
    getInstanceId: () => instanceId,
    addTransport: (transport: Transport) => transports.push(transport),
    removeTransport: (transport: Transport) => {
      const idx = transports.indexOf(transport);
      if (idx > -1) transports.splice(idx, 1);
    },
    setFormatter: (_newFormatter: Formatter) => {
      // Note: formatter is available for custom formatting
      // formatter = newFormatter;
    },
    getSamplingStats: () => logFilter.getStats(),
    flush: async () => {
      await Promise.allSettled(
        loggerTransports.map(
          (transport) => transport.flush?.() || Promise.resolve(),
        ),
      );
    },
    getBatchStats: () => loggerTransports.map((t) => t.getStats?.() || {}),
  };
};

// Create and export a default logger instance
const env = getEnvironment();
const defaultFormatter = createJsonFormatter();
const defaultTransport = createConsoleTransport({
  formatter: defaultFormatter,
});

export const strogger = createLogger({
  config: {},
  transports: [defaultTransport],
  formatter: defaultFormatter,
  env,
});

// Branded alias for createLogger
export const createStrogger = createLogger;
