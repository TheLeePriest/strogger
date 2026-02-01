import type { Logger, LogContext } from "../types";
import { runWithContext, generateRequestContext } from "../utils/context";

/**
 * Options for request logging middleware.
 */
export interface RequestLoggingOptions<TReq> {
  /** Logger instance to use */
  logger: Logger;
  /** Extract context from request. Called once per request. */
  getContext?: (req: TReq) => LogContext;
  /** Include request timing. Default: true */
  timing?: boolean;
  /** Log level for request start. Default: 'debug' */
  startLevel?: "debug" | "info";
  /** Log level for request end. Default: 'info' */
  endLevel?: "debug" | "info";
  /** Skip logging for certain requests */
  skip?: (req: TReq) => boolean;
  /** Custom message for request start */
  startMessage?: string | ((req: TReq) => string);
  /** Custom message for request end */
  endMessage?: string | ((req: TReq, duration: number) => string);
}

/**
 * Generic request/response types to support Express, Koa, Fastify, etc.
 */
interface GenericRequest {
  method?: string;
  url?: string;
  path?: string;
  originalUrl?: string;
  headers?: Record<string, string | string[] | undefined>;
}

interface GenericResponse {
  statusCode?: number;
  on?: (event: string, callback: () => void) => void;
  once?: (event: string, callback: () => void) => void;
}

/**
 * Create Express-style request logging middleware.
 * Automatically logs request start/end with timing and sets up context propagation.
 *
 * @example
 * ```typescript
 * import { logger, createRequestLogger } from 'strogger';
 *
 * const log = logger({ serviceName: 'api' });
 *
 * // Basic usage
 * app.use(createRequestLogger({ logger: log }));
 *
 * // With custom context
 * app.use(createRequestLogger({
 *   logger: log,
 *   getContext: (req) => ({
 *     userId: req.user?.id,
 *     tenantId: req.headers['x-tenant-id'],
 *   }),
 * }));
 *
 * // Skip health checks
 * app.use(createRequestLogger({
 *   logger: log,
 *   skip: (req) => req.path === '/health',
 * }));
 * ```
 */
export const createRequestLogger = <
  TReq extends GenericRequest = GenericRequest,
  TRes extends GenericResponse = GenericResponse,
>(
  options: RequestLoggingOptions<TReq>,
) => {
  const {
    logger,
    getContext,
    timing = true,
    startLevel = "debug",
    endLevel = "info",
    skip,
    startMessage = (req) =>
      `${req.method || "REQUEST"} ${req.originalUrl || req.url || req.path || "/"}`,
    endMessage = (req, _duration) =>
      `${req.method || "REQUEST"} ${req.originalUrl || req.url || req.path || "/"} completed`,
  } = options;

  return (req: TReq, res: TRes, next: () => void): void => {
    // Skip logging if configured
    if (skip?.(req)) {
      next();
      return;
    }

    const startTime = timing ? Date.now() : 0;

    // Extract request ID from headers or generate one
    const requestId =
      (req.headers?.["x-request-id"] as string) ||
      (req.headers?.["x-correlation-id"] as string) ||
      undefined;

    // Build context
    const baseContext = generateRequestContext();
    const customContext = getContext?.(req) || {};
    const context: LogContext = {
      ...baseContext,
      ...customContext,
      method: req.method,
      path: req.originalUrl || req.url || req.path,
    };

    if (requestId) {
      context.requestId = requestId;
    }

    // Run the rest of the request in context
    runWithContext(context, () => {
      // Log request start
      const startMsg =
        typeof startMessage === "function" ? startMessage(req) : startMessage;
      if (startLevel === "debug") {
        logger.debug(startMsg);
      } else {
        logger.info(startMsg);
      }

      // Log request end when response finishes
      const onFinish = (): void => {
        const duration = timing ? Date.now() - startTime : 0;
        const endMsg =
          typeof endMessage === "function"
            ? endMessage(req, duration)
            : endMessage;

        const endContext: LogContext = {
          statusCode: res.statusCode,
        };

        if (timing) {
          endContext.duration = duration;
        }

        if (endLevel === "debug") {
          logger.debug(endMsg, endContext);
        } else {
          logger.info(endMsg, endContext);
        }
      };

      // Use 'once' if available (preferred), otherwise fall back to 'on'
      if (res.once) {
        res.once("finish", onFinish);
      } else if (res.on) {
        let finished = false;
        res.on("finish", () => {
          if (!finished) {
            finished = true;
            onFinish();
          }
        });
      }

      next();
    });
  };
};

/**
 * Options for timing middleware.
 */
export interface TimingMiddlewareOptions<TReq> {
  /** Logger instance to use */
  logger: Logger;
  /** Custom label for the operation. Default: 'request' */
  label?: string | ((req: TReq) => string);
  /** Threshold in ms above which to log a warning. Default: no threshold */
  warnThreshold?: number;
  /** Skip timing for certain requests */
  skip?: (req: TReq) => boolean;
}

/**
 * Create timing-only middleware (no request logging, just adds timing to context).
 *
 * @example
 * ```typescript
 * app.use(createTimingMiddleware({
 *   logger: log,
 *   warnThreshold: 1000, // Warn if request takes > 1s
 * }));
 * ```
 */
export const createTimingMiddleware = <
  TReq extends GenericRequest = GenericRequest,
  TRes extends GenericResponse = GenericResponse,
>(
  options: TimingMiddlewareOptions<TReq>,
) => {
  const { logger, label = "request", warnThreshold, skip } = options;

  return (req: TReq, res: TRes, next: () => void): void => {
    if (skip?.(req)) {
      next();
      return;
    }

    const startTime = Date.now();
    const opLabel = typeof label === "function" ? label(req) : label;

    const onFinish = (): void => {
      const duration = Date.now() - startTime;
      const context: LogContext = {
        duration,
        method: req.method,
        path: req.originalUrl || req.url || req.path,
        statusCode: res.statusCode,
      };

      if (warnThreshold && duration > warnThreshold) {
        logger.warn(`Slow ${opLabel}: ${duration}ms`, context);
      }
    };

    if (res.once) {
      res.once("finish", onFinish);
    } else if (res.on) {
      let finished = false;
      res.on("finish", () => {
        if (!finished) {
          finished = true;
          onFinish();
        }
      });
    }

    next();
  };
};

/**
 * Attach a child logger to the request object.
 * Works with any framework that uses req/res pattern.
 *
 * @example
 * ```typescript
 * // Express with declaration merging
 * declare global {
 *   namespace Express {
 *     interface Request {
 *       log: Logger;
 *     }
 *   }
 * }
 *
 * app.use(attachLogger({
 *   logger: log,
 *   property: 'log',
 *   getContext: (req) => ({
 *     requestId: req.headers['x-request-id'],
 *     userId: req.user?.id,
 *   }),
 * }));
 *
 * // In routes:
 * app.get('/users', (req, res) => {
 *   req.log.info('Fetching users'); // Automatically has request context
 * });
 * ```
 */
export interface AttachLoggerOptions<TReq> {
  /** Logger instance to use as parent */
  logger: Logger;
  /** Property name to attach the logger to. Default: 'log' */
  property?: string;
  /** Extract context from request */
  getContext?: (req: TReq) => LogContext;
}

export const attachLogger = <TReq extends GenericRequest = GenericRequest>(
  options: AttachLoggerOptions<TReq>,
) => {
  const { logger, property = "log", getContext } = options;

  return (req: TReq, _res: unknown, next: () => void): void => {
    const requestId =
      (req.headers?.["x-request-id"] as string) ||
      (req.headers?.["x-correlation-id"] as string) ||
      undefined;

    const context: LogContext = {
      ...generateRequestContext(),
      ...getContext?.(req),
      method: req.method,
      path: req.originalUrl || req.url || req.path,
    };

    if (requestId) {
      context.requestId = requestId;
    }

    // Attach child logger to request
    (req as Record<string, unknown>)[property] = logger.child(context);

    next();
  };
};
