import {
  LogLevel,
  createBatchedTransport,
  createConsoleTransport,
  createJsonFormatter,
  createLogger,
  getEnvironment,
} from "../index";
import type { LogEntry } from "../types";

const env = getEnvironment();
const formatter = createJsonFormatter();

// Sampling and Rate Limiting Example
export const stroggerWithSampling = createLogger({
  config: {
    serviceName: "sampling-demo",
    stage: env.stage,
    samplingRate: 0.3,
    rateLimit: { maxLogsPerSecond: 10, burstSize: 5 },
  },
  transports: [createConsoleTransport()],
  formatter,
  env,
});

// Log Enrichment Example
// Note: enrichment is available for custom enrichment
// const enrichment = createDefaultEnrichmentMiddleware(
//   "my-service",
//   env.stage,
//   "session-123",
// );
export const stroggerWithEnrichment = createLogger({
  config: { serviceName: "enrichment-demo", stage: env.stage },
  transports: [createConsoleTransport()],
  formatter,
  env,
});
// Note: enrichedContext is available for custom enrichment
// const enrichedContext = enrichment({ requestId: "req-999" });

// Log Batching Example
const simpleTransport = {
  log: async (entry: LogEntry) =>
    console.log(`[BATCHED] ${JSON.stringify(entry)}`),
  setLevel: (_level: number) => {},
  getLevel: () => LogLevel.INFO,
};
export const batchedTransport = createBatchedTransport(simpleTransport, {
  maxSize: 5,
  maxWaitTime: 3000,
  maxBatchSize: 1024,
});

// Filtering, Validation, Redaction, and Hooks Example
const filter = (entry: LogEntry) => entry.level >= LogLevel.ERROR;
const validate = (entry: LogEntry) => {
  if (!entry.message) throw new Error("Log message cannot be empty");
};
const redact = (entry: LogEntry) => ({ ...entry, message: "[REDACTED]" });
const hook = (entry: LogEntry) => console.log(`[HOOK] ${entry.message}`);
export const stroggerWithAdvancedFeatures = createLogger({
  config: {
    serviceName: "advanced-demo",
    stage: env.stage,
    filter,
    validate,
    redact,
    hooks: [hook],
  },
  transports: [createConsoleTransport()],
  formatter,
  env,
});

// Forbidden Keys Example
export const stroggerWithForbiddenKeys = createLogger({
  config: {
    serviceName: "forbidden-demo",
    forbiddenKeys: ["password", "apiKey", "secret"],
    forbiddenKeyAction: "redact",
  },
  transports: [createConsoleTransport()],
  formatter,
  env,
});
