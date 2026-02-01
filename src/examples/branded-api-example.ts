// Simplified API Example: Demonstrates the easy-to-use Strogger API
import {
  LogLevel,
  logger,
  createLogger,
  createConsoleTransport,
  createJsonFormatter,
  runWithContext,
  generateRequestContext,
} from "../index";

// Example 1: Simplest Usage - Just works!
export const demonstrateSimpleAPI = () => {
  console.log("=== Simple API Usage ===\n");

  // Create a logger with one line
  const log = logger({ serviceName: "my-app" });

  log.info("Application started");
  log.debug("Debug message");
  log.warn("Warning message");
  log.error("Error occurred", { userId: "user-123" });

  return log;
};

// Example 2: Child Loggers for Request Tracing
export const demonstrateChildLoggers = async () => {
  console.log("\n=== Child Loggers for Request Tracing ===\n");

  const log = logger({ serviceName: "api-server" });

  // Simulate handling a request
  const handleRequest = async (requestId: string, userId: string) => {
    // Create a child logger with request context
    const requestLog = log.child({ requestId, userId });

    requestLog.info("Request received");
    // ... process request ...
    requestLog.info("Fetching user data");
    // ... more processing ...
    requestLog.info("Request completed");
    // All logs automatically have requestId and userId!
  };

  await handleRequest("req-123", "user-456");
  await handleRequest("req-789", "user-012");
};

// Example 3: Automatic Context with runWithContext
export const demonstrateAsyncContext = async () => {
  console.log("\n=== Automatic Context with AsyncLocalStorage ===\n");

  const log = logger({ serviceName: "async-demo" });

  // Context flows automatically through async calls
  await runWithContext(
    { ...generateRequestContext(), userId: "user-abc" },
    async () => {
      log.info("Starting operation");

      // Even in nested async functions, context is preserved
      await processStep1(log);
      await processStep2(log);

      log.info("Operation complete");
    },
  );
};

const processStep1 = async (log: ReturnType<typeof logger>) => {
  // This log automatically has the context from runWithContext
  log.info("Processing step 1");
};

const processStep2 = async (log: ReturnType<typeof logger>) => {
  log.info("Processing step 2");
};

// Example 4: Advanced Configuration (when needed)
export const demonstrateAdvancedConfig = () => {
  console.log("\n=== Advanced Configuration ===\n");

  const log = createLogger({
    config: {
      serviceName: "advanced-app",
      level: LogLevel.DEBUG,
      samplingRate: 0.5, // Only log 50% of messages
    },
    transports: [
      createConsoleTransport({
        formatter: createJsonFormatter(),
        level: LogLevel.DEBUG,
      }),
      // Add more transports as needed
      // createDataDogTransport({ ... }),
    ],
  });

  log.info("Advanced configuration example");
  return log;
};

// Run all examples
export const runBrandedAPIExamples = async () => {
  console.log("Running Simplified API Examples\n");
  try {
    demonstrateSimpleAPI();
    await demonstrateChildLoggers();
    await demonstrateAsyncContext();
    demonstrateAdvancedConfig();
    console.log("\nAll examples completed!");
  } catch (error) {
    console.error("Error running examples:", error);
  }
};

// Only run examples if this file is executed directly
if (require.main === module) {
  runBrandedAPIExamples();
}
