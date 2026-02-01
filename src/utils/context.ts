import { AsyncLocalStorage } from "node:async_hooks";
import type { LogContext } from "../types";

/**
 * AsyncLocalStorage instance for automatic context propagation.
 * This allows context to flow automatically through async call chains
 * without manually passing it to each log call.
 */
const asyncLocalStorage = new AsyncLocalStorage<LogContext>();

/**
 * Get the current context from AsyncLocalStorage.
 * Returns an empty object if no context is set.
 */
export const getContext = (): LogContext => {
  return asyncLocalStorage.getStore() || {};
};

/**
 * Run a function with the given context.
 * The context will be automatically available to all log calls within the function
 * and any async operations it spawns.
 *
 * @example
 * ```typescript
 * import { runWithContext, logger } from 'strogger';
 *
 * app.use((req, res, next) => {
 *   runWithContext({ requestId: req.id, userId: req.user?.id }, () => {
 *     next();
 *   });
 * });
 *
 * // Later, in any handler:
 * logger.info('Processing request'); // Automatically includes requestId and userId
 * ```
 */
export const runWithContext = <T>(context: LogContext, fn: () => T): T => {
  const currentContext = getContext();
  const mergedContext = { ...currentContext, ...context };
  return asyncLocalStorage.run(mergedContext, fn);
};

/**
 * Run an async function with the given context.
 * Convenience wrapper for runWithContext with async functions.
 *
 * @example
 * ```typescript
 * await runWithContextAsync({ requestId: '123' }, async () => {
 *   await processRequest();
 *   logger.info('Done'); // Includes requestId
 * });
 * ```
 */
export const runWithContextAsync = async <T>(
  context: LogContext,
  fn: () => Promise<T>,
): Promise<T> => {
  const currentContext = getContext();
  const mergedContext = { ...currentContext, ...context };
  return asyncLocalStorage.run(mergedContext, fn);
};

/**
 * Set context values that will be merged with existing context.
 * Note: This only affects the current async context chain.
 *
 * @example
 * ```typescript
 * runWithContext({ requestId: '123' }, () => {
 *   setContext({ userId: 'user-456' });
 *   logger.info('Now has both requestId and userId');
 * });
 * ```
 */
export const setContext = (context: LogContext): void => {
  const store = asyncLocalStorage.getStore();
  if (store) {
    Object.assign(store, context);
  }
};

/**
 * Clear a specific key from the current context.
 */
export const clearContextKey = (key: keyof LogContext): void => {
  const store = asyncLocalStorage.getStore();
  if (store && key in store) {
    delete store[key];
  }
};

/**
 * Generate a new correlation ID and set it in the current context.
 * Returns the generated correlation ID.
 */
export const generateRequestContext = (): LogContext => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);
  const correlationId = `req_${timestamp}_${random}`;
  const traceId = Math.random().toString(16).substring(2, 34);
  const spanId = Math.random().toString(16).substring(2, 18);

  return {
    correlationId,
    traceId,
    spanId,
  };
};

/**
 * Express/Koa/Fastify middleware helper.
 * Wraps a request handler to automatically set up request context.
 *
 * @example
 * ```typescript
 * import { withRequestContext } from 'strogger';
 *
 * // Express
 * app.use(withRequestContext((req) => ({
 *   requestId: req.headers['x-request-id'] || generateId(),
 *   userId: req.user?.id,
 *   path: req.path,
 * })));
 * ```
 */
export const withRequestContext = <TReq, TRes, TNext extends () => void>(
  getRequestContext: (req: TReq) => LogContext,
) => {
  return (req: TReq, _res: TRes, next: TNext): void => {
    const requestContext = {
      ...generateRequestContext(),
      ...getRequestContext(req),
    };
    runWithContext(requestContext, () => {
      next();
    });
  };
};

export { asyncLocalStorage };
