import {
  LogLevel,
  createConsoleTransport,
  createDataDogTransport,
  createElasticsearchTransport,
  createJsonFormatter,
  createLogger,
  createNewRelicTransport,
  createSplunkTransport,
  getEnvironment,
} from "../index";
import type { LogEntry } from "../index";

// Example 1: DataDog Transport
export const demonstrateDataDogTransport = () => {
  const env = getEnvironment();
  const formatter = createJsonFormatter();
  const logger = createLogger({
    config: { serviceName: "datadog-example", stage: env.stage },
    transports: [
      createConsoleTransport({ formatter, level: LogLevel.INFO }),
      createDataDogTransport({
        level: LogLevel.INFO,
        serviceName: "datadog-example",
        tags: ["env:dev", "team:backend"],
      }),
    ],
    formatter,
    env,
  });
  logger.info("DataDog transport example log");
  return logger;
};

// Example 2: Splunk Transport
export const demonstrateSplunkTransport = () => {
  const env = getEnvironment();
  const formatter = createJsonFormatter();
  const logger = createLogger({
    config: { serviceName: "splunk-example", stage: env.stage },
    transports: [
      createConsoleTransport({ formatter, level: LogLevel.INFO }),
      createSplunkTransport({
        level: LogLevel.ERROR,
        source: "splunk-example",
        sourcetype: "_json",
      }),
    ],
    formatter,
    env,
  });
  logger.error("Splunk transport example log");
  return logger;
};

// Example 3: Elasticsearch Transport
export const demonstrateElasticsearchTransport = () => {
  const env = getEnvironment();
  const formatter = createJsonFormatter();
  const logger = createLogger({
    config: { serviceName: "elasticsearch-example", stage: env.stage },
    transports: [
      createConsoleTransport({ formatter, level: LogLevel.INFO }),
      createElasticsearchTransport({
        level: LogLevel.INFO,
        index: "application-logs",
        indexPattern: "logs-{YYYY.MM.DD}",
      }),
    ],
    formatter,
    env,
  });
  logger.info("Elasticsearch transport example log");
  return logger;
};

// Example 4: New Relic Transport
export const demonstrateNewRelicTransport = () => {
  const env = getEnvironment();
  const formatter = createJsonFormatter();
  const logger = createLogger({
    config: { serviceName: "newrelic-example", stage: env.stage },
    transports: [
      createConsoleTransport({ formatter, level: LogLevel.INFO }),
      createNewRelicTransport({
        level: LogLevel.INFO,
        serviceName: "newrelic-example",
      }),
    ],
    formatter,
    env,
  });
  logger.info("New Relic transport example log");
  return logger;
};

// Only run examples if this file is executed directly
if (require.main === module) {
  demonstrateDataDogTransport();
  demonstrateSplunkTransport();
  demonstrateElasticsearchTransport();
  demonstrateNewRelicTransport();
}
