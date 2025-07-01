// Core logger functionality
export { createLogger, createStrogger, strogger } from "./logger";
export { LogLevel } from "./types";
export type {
  LogEntry,
  LogContext,
  LogLevel as LogLevelType,
  LoggerConfig,
  LoggerOptions,
  Transport,
  Formatter,
} from "./types";

// Formatters
export { createJsonFormatter } from "./formatters/json-formatter";

// Transports
export { createConsoleTransport } from "./transports/console-transport";
export type { ConsoleTransportOptions } from "./transports/console-transport";

export { createDataDogTransport } from "./transports/datadog-transport";
export type { DataDogTransportOptions } from "./transports/datadog-transport";

export { createSplunkTransport } from "./transports/splunk-transport";
export type { SplunkTransportOptions } from "./transports/splunk-transport";

export { createElasticsearchTransport } from "./transports/elasticsearch-transport";
export type { ElasticsearchTransportOptions } from "./transports/elasticsearch-transport";

export { createNewRelicTransport } from "./transports/newrelic-transport";
export type { NewRelicTransportOptions } from "./transports/newrelic-transport";

export { createFileTransport } from "./transports/file-transport";
export type {
  FileTransportOptions,
  FileTransportState,
} from "./transports/file-transport";

export { createCloudWatchTransport } from "./transports/cloudwatch-transport";
export type {
  CloudWatchTransportOptions,
  CloudWatchTransportState,
} from "./transports/cloudwatch-transport";

// Branded transport aliases
export { createConsoleTransport as createStroggerConsoleTransport } from "./transports/console-transport";
export { createDataDogTransport as createStroggerDataDogTransport } from "./transports/datadog-transport";
export { createSplunkTransport as createStroggerSplunkTransport } from "./transports/splunk-transport";
export { createElasticsearchTransport as createStroggerElasticsearchTransport } from "./transports/elasticsearch-transport";
export { createNewRelicTransport as createStroggerNewRelicTransport } from "./transports/newrelic-transport";
export { createCloudWatchTransport as createStroggerCloudWatchTransport } from "./transports/cloudwatch-transport";

// Utilities
export { getEnvironment } from "./utils/environment";
export type { LoggerEnvironment } from "./utils/environment";

export { createPerformanceMonitor } from "./utils/performance";
export type {
  PerformanceMetrics,
  PerformanceMonitorState,
} from "./utils/performance";

// Error handling
export {
  LoggerError,
  TransportError,
  ConfigurationError,
  ValidationError,
  ERROR_MESSAGES,
  createDetailedError,
  handleTransportError,
  validateEnvironmentVariable,
  validateTransportConfig,
} from "./utils/errors";

// Advanced features
export {
  createLogFilter,
  createRateLimiter,
  createSampler,
} from "./utils/sampling";

export {
  createDefaultEnrichmentMiddleware,
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

export {
  createBatchedTransport,
  createBatchedLogger,
} from "./utils/batching";

// Advanced feature types
export type {
  RateLimiterState,
  SamplingState,
} from "./utils/sampling";

export type {
  EnrichmentContext,
  Enricher,
} from "./utils/enrichment";

export type {
  BatchConfig,
  BatchState,
  BatchedTransport,
  BatchStats,
} from "./utils/batching";

// Example implementations (for reference and learning)
export { createFileTransportExample } from "./examples/file-transport-example";
export { createCloudWatchTransportExample } from "./examples/cloudwatch-transport-example";

// New production transport usage examples
export { runFileTransportExamples } from "./examples/file-transport-usage";
export { runCloudWatchTransportExamples } from "./examples/cloudwatch-transport-usage";
export {
  demonstrateAutomaticInstanceId,
  demonstrateCustomInstanceId,
  demonstrateMultipleInstances,
  demonstrateInstanceIdInContexts,
  demonstrateManualGeneration,
} from "./examples/logger-instance-id-example";

// Structured logging demo (core focus)
export { runStructuredLoggingDemo } from "./examples/structured-logging-demo";

// Branded API demo
export { runBrandedAPIExamples } from "./examples/branded-api-example";

// Legacy/utility exports
export { shouldLog } from "./transports/base-transport";
export type { CloudWatchConfig } from "./types";
