import type { LogContext } from "../types";

export interface EnrichmentContext {
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  sessionId?: string;
  userId?: string;
  requestId?: string;
  serviceName?: string;
  stage?: string;
}

export interface Enricher {
  name: string;
  enrich: (context: LogContext) => LogContext;
}

/**
 * Generates a unique correlation ID
 */
export const generateCorrelationId = (): string => {
  return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Generates a trace ID (compatible with OpenTelemetry format)
 */
export const generateTraceId = (): string => {
  return Math.random().toString(16).substr(2, 32);
};

/**
 * Generates a span ID
 */
export const generateSpanId = (): string => {
  return Math.random().toString(16).substr(2, 16);
};

/**
 * Generates a unique logger instance ID
 */
export const generateLoggerInstanceId = (): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  const processId = process.pid || 0;
  return `logger_${timestamp}_${random}_${processId}`;
};

/**
 * Creates a correlation ID enricher.
 *
 * By default, generates a NEW correlation ID for each log entry that doesn't have one.
 * This is the recommended behavior when using the context API (runWithContext).
 *
 * For backward compatibility, set `persistIds: true` to reuse IDs across the logger's lifetime.
 */
export const createCorrelationEnricher = (options?: {
  persistIds?: boolean;
}): Enricher => {
  const persistIds = options?.persistIds ?? false;

  // Only used when persistIds is true
  let persistedCorrelationId: string | undefined;
  let persistedTraceId: string | undefined;
  let persistedSpanId: string | undefined;

  return {
    name: "correlation",
    enrich: (context: LogContext): LogContext => {
      // Generate correlation ID if not present
      if (!context.correlationId) {
        if (persistIds) {
          persistedCorrelationId =
            persistedCorrelationId || generateCorrelationId();
          context.correlationId = persistedCorrelationId;
        } else {
          // Generate fresh ID - caller should use runWithContext to share IDs
          context.correlationId = generateCorrelationId();
        }
      }

      // Generate trace ID if not present
      if (!context.traceId) {
        if (persistIds) {
          persistedTraceId = persistedTraceId || generateTraceId();
          context.traceId = persistedTraceId;
        } else {
          context.traceId = generateTraceId();
        }
      }

      // Generate span ID if not present
      if (!context.spanId) {
        if (persistIds) {
          persistedSpanId = persistedSpanId || generateSpanId();
          context.spanId = persistedSpanId;
        } else {
          context.spanId = generateSpanId();
        }
      }

      return context;
    },
  };
};

/**
 * Creates a session enricher
 */
export const createSessionEnricher = (sessionId?: string): Enricher => {
  const currentSessionId =
    sessionId ||
    `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return {
    name: "session",
    enrich: (context: LogContext): LogContext => {
      if (!context.sessionId) {
        context.sessionId = currentSessionId;
      }
      return context;
    },
  };
};

/**
 * Creates an environment enricher
 */
export const createEnvironmentEnricher = (
  serviceName?: string,
  stage?: string,
): Enricher => {
  return {
    name: "environment",
    enrich: (context: LogContext): LogContext => {
      if (serviceName && !context.serviceName) {
        context.serviceName = serviceName;
      }
      if (stage && !context.stage) {
        context.stage = stage;
      }
      return context;
    },
  };
};

/**
 * Creates a user enricher
 */
export const createUserEnricher = (userId?: string): Enricher => {
  return {
    name: "user",
    enrich: (context: LogContext): LogContext => {
      if (userId && !context.userId) {
        context.userId = userId;
      }
      return context;
    },
  };
};

/**
 * Creates a logger instance enricher
 */
export const createLoggerInstanceEnricher = (instanceId: string): Enricher => {
  return {
    name: "loggerInstance",
    enrich: (context: LogContext): LogContext => {
      if (!context.instanceId) {
        context.instanceId = instanceId;
      }
      return context;
    },
  };
};

/**
 * Creates an enrichment middleware that applies multiple enrichers
 */
export const createEnrichmentMiddleware = (enrichers: Enricher[]) => {
  return (context: LogContext): LogContext => {
    return enrichers.reduce(
      (enrichedContext, enricher) => {
        return enricher.enrich(enrichedContext);
      },
      { ...context },
    );
  };
};

/**
 * Creates a default enrichment middleware with common enrichers
 */
export const createDefaultEnrichmentMiddleware = (
  serviceName?: string,
  stage?: string,
  sessionId?: string,
  instanceId?: string,
) => {
  const enrichers: Enricher[] = [
    createCorrelationEnricher(),
    createSessionEnricher(sessionId),
    createEnvironmentEnricher(serviceName, stage),
  ];

  // Add logger instance enricher if instanceId is provided
  if (instanceId) {
    enrichers.push(createLoggerInstanceEnricher(instanceId));
  }

  return createEnrichmentMiddleware(enrichers);
};
