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

// Third-Party Integrations Example: Minimal usage for DataDog, Splunk, Elasticsearch, and New Relic transports.
const env = getEnvironment();
const formatter = createJsonFormatter();

// DataDog Transport Example
export const loggerWithDataDog = createLogger({
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

// Splunk Transport Example
export const loggerWithSplunk = createLogger({
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

// Elasticsearch Transport Example
export const loggerWithElasticsearch = createLogger({
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

// New Relic Transport Example
export const loggerWithNewRelic = createLogger({
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

// Example 1: Basic Third-Party Transport Usage
const demonstrateBasicTransports = () => {
  console.log("=== Basic Third-Party Transport Usage ===\n");

  const env = getEnvironment();
  const formatter = createJsonFormatter();

  // Create transports with different levels
  const consoleTransport = createConsoleTransport({
    formatter,
    level: LogLevel.DEBUG,
  });

  const dataDogTransport = createDataDogTransport({
    level: LogLevel.INFO,
    serviceName: "example-service",
    tags: ["env:dev", "team:backend"],
  });

  const splunkTransport = createSplunkTransport({
    level: LogLevel.ERROR,
    source: "example-service",
    sourcetype: "_json",
  });

  // Create strogger with multiple transports
  const strogger = createLogger({
    config: {
      serviceName: "third-party-integration-example",
      stage: "dev",
    },
    transports: [consoleTransport, dataDogTransport, splunkTransport],
    formatter,
    env,
  });

  // Test different log levels
  strogger.debug("Debug message - only goes to console");
  strogger.info("Info message - goes to console and DataDog");
  strogger.warn("Warning message - goes to console and DataDog");
  strogger.error("Error message - goes to console, DataDog, and Splunk");
  strogger.fatal("Fatal message - goes to all transports");

  return strogger;
};

// Example 2: Environment-Specific Transport Configuration
const demonstrateEnvironmentSpecificConfig = () => {
  console.log("\n=== Environment-Specific Configuration ===\n");

  const env = getEnvironment();
  const formatter = createJsonFormatter();

  // Base console transport for all environments
  const transports = [
    createConsoleTransport({ formatter, level: LogLevel.INFO }),
  ];

  // Add production-specific transports
  if (env.isProduction) {
    console.log(
      "Production environment detected - adding production transports",
    );

    transports.push(
      createNewRelicTransport({
        level: LogLevel.INFO,
        serviceName: "production-service",
      }),
      createDataDogTransport({
        level: LogLevel.WARN,
        serviceName: "production-service",
        tags: ["env:prod", "team:backend"],
      }),
    );
  } else {
    console.log("Development environment - using console transport only");
  }

  const logger = createLogger({
    config: {
      serviceName: "env-specific-example",
      stage: env.stage,
    },
    transports,
    formatter,
    env,
  });

  logger.info(
    "This message will be sent to different transports based on environment",
  );
  logger.warn("Warning message with environment-specific routing");

  return logger;
};

// Example 3: Custom Transport with Duck-Typing
const demonstrateCustomTransport = () => {
  console.log("\n=== Custom Transport with Duck-Typing ===\n");

  const env = getEnvironment();
  const formatter = createJsonFormatter();

  // Custom transport that logs to a webhook
  const webhookTransport = {
    log: async (entry: LogEntry) => {
      try {
        // Simulate webhook call
        console.log(`[WEBHOOK] Sending to webhook: ${entry.message}`);

        // In a real implementation, you would make an actual HTTP request
        // await fetch("https://your-webhook-url.com", {
        //   method: "POST",
        //   headers: { "Content-Type": "application/json" },
        //   body: JSON.stringify(entry)
        // });
      } catch (error) {
        console.error("Webhook transport failed:", error);
      }
    },
    setLevel: (level: LogLevel) => {
      console.log(`[WEBHOOK] Setting level to ${level}`);
    },
    getLevel: () => LogLevel.ERROR, // Only log errors and above
  };

  // Custom transport that logs to a file (simulated)
  const fileTransport = {
    log: async (entry: LogEntry) => {
      const logLine = `${new Date().toISOString()} [${entry.level}] ${entry.message}\n`;
      console.log(`[FILE] Writing to log file: ${logLine.trim()}`);

      // In a real implementation, you would write to an actual file
      // fs.appendFileSync("./app.log", logLine);
    },
    setLevel: (level: LogLevel) => {
      console.log(`[FILE] Setting level to ${level}`);
    },
    getLevel: () => LogLevel.INFO,
  };

  const logger = createLogger({
    config: {
      serviceName: "custom-transport-example",
      stage: "dev",
    },
    transports: [
      createConsoleTransport({ formatter, level: LogLevel.DEBUG }),
      webhookTransport,
      fileTransport,
    ],
    formatter,
    env,
  });

  logger.debug("Debug message - console only");
  logger.info("Info message - console and file");
  logger.error("Error message - console, file, and webhook");

  return logger;
};

// Example 5: Transport with Batching and Error Handling
const demonstrateBatchedTransports = () => {
  console.log("\n=== Batched Transports ===\n");

  const env = getEnvironment();
  const formatter = createJsonFormatter();

  // Create transports with batching
  const dataDogTransport = createDataDogTransport({
    level: LogLevel.INFO,
    batchSize: 3, // Flush after 3 logs
    flushInterval: 2000, // Or after 2 seconds
    serviceName: "batched-example",
  });

  const newRelicTransport = createNewRelicTransport({
    level: LogLevel.WARN,
    batchSize: 2,
    flushInterval: 1000,
    serviceName: "batched-example",
  });

  const logger = createLogger({
    config: {
      serviceName: "batched-transport-example",
      stage: "dev",
    },
    transports: [
      createConsoleTransport({ formatter, level: LogLevel.DEBUG }),
      dataDogTransport,
      newRelicTransport,
    ],
    formatter,
    env,
  });

  // Send multiple logs quickly to demonstrate batching
  console.log("Sending multiple logs to demonstrate batching...");

  for (let i = 1; i <= 5; i++) {
    logger.info(`Batch test message ${i}`, {
      batchNumber: i,
      timestamp: new Date().toISOString(),
    });
  }

  // Wait for batching to complete
  setTimeout(() => {
    console.log("Batching demonstration completed");
  }, 3000);

  return logger;
};

// Example 6: Production-Ready Configuration
const demonstrateProductionConfig = () => {
  console.log("\n=== Production-Ready Configuration ===\n");

  const env = getEnvironment();
  const formatter = createJsonFormatter();

  // Production configuration with multiple transports and different levels
  const transports = [
    // Console for all levels in development, INFO+ in production
    createConsoleTransport({
      formatter,
      level: env.isProduction ? LogLevel.INFO : LogLevel.DEBUG,
    }),
  ];

  if (env.isProduction) {
    // New Relic for all application logs
    transports.push(
      createNewRelicTransport({
        level: LogLevel.INFO,
        serviceName: "production-service",
      }),
    );

    // DataDog for monitoring and alerting
    transports.push(
      createDataDogTransport({
        level: LogLevel.WARN,
        serviceName: "production-service",
        tags: ["env:prod", "team:backend", "monitoring:enabled"],
      }),
    );

    // Splunk for security and compliance logs
    transports.push(
      createSplunkTransport({
        level: LogLevel.ERROR,
        source: "production-service",
        sourcetype: "security",
        index: "security-logs",
      }),
    );
  }

  const logger = createLogger({
    config: {
      serviceName: "production-service",
      stage: env.stage,
      level: env.isProduction ? LogLevel.INFO : LogLevel.DEBUG,
    },
    transports,
    formatter,
    env,
  });

  // Simulate production scenarios
  logger.info("Application started", {
    version: "1.0.0",
    environment: env.stage,
  });

  logger.warn("High memory usage detected", {
    memoryUsage: "85%",
    threshold: "80%",
  });

  logger.error(
    "Database connection failed",
    {
      database: "primary",
      retryAttempts: 3,
    },
    new Error("Connection timeout"),
  );

  return logger;
};

// Run all examples
export const runThirdPartyIntegrationExamples = async () => {
  console.log("🚀 Running Third-Party Integration Examples\n");

  try {
    demonstrateBasicTransports();
    demonstrateEnvironmentSpecificConfig();
    demonstrateCustomTransport();
    demonstrateBatchedTransports();
    demonstrateProductionConfig();

    console.log("\n✅ All third-party integration examples completed!");
  } catch (error) {
    console.error("❌ Error running examples:", error);
  }
};

// Export individual examples for testing
export {
  demonstrateBasicTransports,
  demonstrateEnvironmentSpecificConfig,
  demonstrateCustomTransport,
  demonstrateBatchedTransports,
  demonstrateProductionConfig,
};

// Run examples if this file is executed directly
if (require.main === module) {
  runThirdPartyIntegrationExamples().catch(console.error);
}
