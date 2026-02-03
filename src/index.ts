// ============================================================================
// CORE API - What most users need
// ============================================================================

// Main logger creation
export { createLogger, logger, strogger } from "./logger";
export type { CreateLoggerOptions } from "./logger";

// Log levels
export { LogLevel, parseLogLevel, logLevelToString, normalizeLogLevel } from "./types";

// Core types
export type {
  Logger,
  LogEntry,
  LogContext,
  LogData,
  LoggerConfig,
  SimpleLoggerOptions,
  Transport,
  Formatter,
  SerializedError,
  TransportErrorHandler,
  LogLevelInput,
  QueueConfig,
  // Shorthand transport config types
  DataDogShorthand,
  CloudWatchShorthand,
  SplunkShorthand,
  ElasticsearchShorthand,
  NewRelicShorthand,
  FileShorthand,
} from "./types";

// ============================================================================
// CONTEXT & TRACING - For request tracing
// ============================================================================

export {
  runWithContext,
  runWithContextAsync,
  getContext,
  setContext,
  generateRequestContext,
  withRequestContext,
  hasAsyncLocalStorage,
} from "./utils/context";

// ============================================================================
// MIDDLEWARE - Express/Fastify/Koa request logging
// ============================================================================

export {
  createRequestLogger,
  createTimingMiddleware,
  attachLogger,
} from "./middleware";
export type {
  RequestLoggingOptions,
  TimingMiddlewareOptions,
  AttachLoggerOptions,
} from "./middleware";

// ============================================================================
// REDACTION - Sensitive data protection
// ============================================================================

export {
  createRedactor,
  defaultRedactor,
  DEFAULT_SENSITIVE_FIELDS,
  DEFAULT_REDACTION_PATTERNS,
} from "./utils/redaction";
export type { RedactionOptions } from "./utils/redaction";

// ============================================================================
// FORMATTERS
// ============================================================================

export {
  createJsonFormatter,
  createPrettyFormatter,
} from "./formatters/json-formatter";
export type { PrettyFormatterOptions } from "./formatters/json-formatter";

// ============================================================================
// TRANSPORTS
// ============================================================================

// Console (included by default)
export { createConsoleTransport } from "./transports/console-transport";
export type { ConsoleTransportOptions } from "./transports/console-transport";

// File
export { createFileTransport } from "./transports/file-transport";
export type {
  FileTransportOptions,
  FileTransportState,
} from "./transports/file-transport";

// Cloud providers
export { createCloudWatchTransport } from "./transports/cloudwatch-transport";
export type {
  CloudWatchTransportOptions,
  CloudWatchTransportState,
} from "./transports/cloudwatch-transport";

export { createDataDogTransport } from "./transports/datadog-transport";
export type { DataDogTransportOptions } from "./transports/datadog-transport";

export { createSplunkTransport } from "./transports/splunk-transport";
export type { SplunkTransportOptions } from "./transports/splunk-transport";

export { createElasticsearchTransport } from "./transports/elasticsearch-transport";
export type { ElasticsearchTransportOptions } from "./transports/elasticsearch-transport";

export { createNewRelicTransport } from "./transports/newrelic-transport";
export type { NewRelicTransportOptions } from "./transports/newrelic-transport";

// ============================================================================
// ADVANCED FEATURES - For power users
// ============================================================================

// Environment utilities
export { getEnvironment } from "./utils/environment";
export type { LoggerEnvironment } from "./utils/environment";

// Error handling
export {
  LoggerError,
  TransportError,
  ConfigurationError,
  ValidationError,
  ERROR_MESSAGES,
  createDetailedError,
  handleTransportError,
} from "./utils/errors";

// Sampling & rate limiting
export {
  createLogFilter,
  createRateLimiter,
  createSampler,
} from "./utils/sampling";
export type { RateLimiterState, SamplingState } from "./utils/sampling";

// Batching
export { createBatchedTransport, createBatchedLogger } from "./utils/batching";
export type {
  BatchConfig,
  BatchState,
  BatchedTransport,
  BatchStats,
} from "./utils/batching";

// Performance monitoring
export { createPerformanceMonitor } from "./utils/performance";
export type {
  PerformanceMetrics,
  PerformanceMonitorConfig,
  PerformanceMonitorState,
} from "./utils/performance";

// ============================================================================
// INTERNAL - Exported for advanced customization only
// ============================================================================

// Enrichment (usually not needed - context API is simpler)
export {
  createEnrichmentMiddleware,
  createCorrelationEnricher,
  createSessionEnricher,
  createEnvironmentEnricher,
  createUserEnricher,
  createLoggerInstanceEnricher,
  generateCorrelationId,
  generateTraceId,
  generateSpanId,
  generateLoggerInstanceId,
} from "./utils/enrichment";
export type { EnrichmentContext, Enricher } from "./utils/enrichment";

// Base transport utility
export { shouldLog } from "./transports/base-transport";

// Config printer utility
export { printLoggerConfig } from "./logger";

// Legacy type export
export type { CloudWatchConfig } from "./types";
