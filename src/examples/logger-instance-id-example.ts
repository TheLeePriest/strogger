// Logger Instance ID Example: Demonstrates unique identifier tracking through logger lifecycle.
import {
  LogLevel,
  createConsoleTransport,
  createJsonFormatter,
  createLogger,
  generateLoggerInstanceId,
  getEnvironment,
} from "../index";

// Example 1: Automatic Instance ID Generation
const demonstrateAutomaticInstanceId = () => {
  console.log("=== Automatic Instance ID Generation ===\n");

  const env = getEnvironment();
  const formatter = createJsonFormatter();
  const transport = createConsoleTransport({
    formatter,
    level: LogLevel.DEBUG,
  });

  // Logger will automatically generate a unique instance ID
  const strogger = createLogger({
    config: { serviceName: "auto-id-example", stage: "dev" },
    transports: [transport],
    formatter,
    env,
  });

  console.log("Generated Instance ID:", strogger.getInstanceId());

  // All logs from this logger will include the same instance ID
  strogger.info("First log message", { requestId: "req-123" });
  strogger.debug("Debug message", { userId: "user-456" });
  strogger.error(
    "Error message",
    { operation: "test" },
    new Error("Test error"),
  );

  return strogger;
};

// Example 2: Custom Instance ID
const demonstrateCustomInstanceId = () => {
  console.log("\n=== Custom Instance ID ===\n");

  const env = getEnvironment();
  const formatter = createJsonFormatter();
  const transport = createConsoleTransport({
    formatter,
    level: LogLevel.DEBUG,
  });

  // User provides their own instance ID
  const customInstanceId = "my-custom-logger-123";
  const strogger = createLogger({
    config: {
      serviceName: "custom-id-example",
      stage: "dev",
      instanceId: customInstanceId,
    },
    transports: [transport],
    formatter,
    env,
  });

  console.log("Custom Instance ID:", strogger.getInstanceId());

  // All logs from this logger will include the custom instance ID
  strogger.info("Log with custom instance ID", { requestId: "req-456" });
  strogger.warn("Warning with custom instance ID", { severity: "medium" });

  return strogger;
};

// Example 3: Multiple Strogger Instances
const demonstrateMultipleInstances = () => {
  console.log("\n=== Multiple Strogger Instances ===\n");

  const env = getEnvironment();
  const formatter = createJsonFormatter();
  const transport = createConsoleTransport({
    formatter,
    level: LogLevel.DEBUG,
  });

  // Create multiple strogger instances
  const strogger1 = createLogger({
    config: { serviceName: "multi-instance-1", stage: "dev" },
    transports: [transport],
    formatter,
    env,
  });

  const strogger2 = createLogger({
    config: { serviceName: "multi-instance-2", stage: "dev" },
    transports: [transport],
    formatter,
    env,
  });

  const strogger3 = createLogger({
    config: {
      serviceName: "multi-instance-3",
      stage: "dev",
      instanceId: "user-provided-id",
    },
    transports: [transport],
    formatter,
    env,
  });

  console.log("Strogger 1 Instance ID:", strogger1.getInstanceId());
  console.log("Strogger 2 Instance ID:", strogger2.getInstanceId());
  console.log("Strogger 3 Instance ID:", strogger3.getInstanceId());

  // Each strogger has a unique instance ID
  strogger1.info("Message from strogger 1", { source: "strogger1" });
  strogger2.info("Message from strogger 2", { source: "strogger2" });
  strogger3.info("Message from strogger 3", { source: "strogger3" });

  return { strogger1, strogger2, strogger3 };
};

// Example 4: Instance ID in Different Contexts
const demonstrateInstanceIdInContexts = () => {
  console.log("\n=== Instance ID in Different Contexts ===\n");

  const env = getEnvironment();
  const formatter = createJsonFormatter();
  const transport = createConsoleTransport({
    formatter,
    level: LogLevel.DEBUG,
  });

  const strogger = createLogger({
    config: { serviceName: "context-example", stage: "dev" },
    transports: [transport],
    formatter,
    env,
  });

  console.log("Strogger Instance ID:", strogger.getInstanceId());

  // Instance ID is automatically included in all log contexts
  strogger.logFunctionStart("processOrder", { orderId: "order-123" });
  strogger.logDatabaseOperation("SELECT", "users", { table: "users" });
  strogger.logApiRequest("POST", "/api/orders", 201, {
    endpoint: "/api/orders",
  });
  strogger.logFunctionEnd("processOrder", 150, { orderId: "order-123" });

  return strogger;
};

// Example 5: Manual Instance ID Generation
const demonstrateManualGeneration = () => {
  console.log("\n=== Manual Instance ID Generation ===\n");

  // Generate instance IDs manually
  const instanceId1 = generateLoggerInstanceId();
  const instanceId2 = generateLoggerInstanceId();

  console.log("Manually generated ID 1:", instanceId1);
  console.log("Manually generated ID 2:", instanceId2);

  const env = getEnvironment();
  const formatter = createJsonFormatter();
  const transport = createConsoleTransport({
    formatter,
    level: LogLevel.DEBUG,
  });

  // Use manually generated IDs
  const strogger1 = createLogger({
    config: {
      serviceName: "manual-id-1",
      stage: "dev",
      instanceId: instanceId1,
    },
    transports: [transport],
    formatter,
    env,
  });

  const strogger2 = createLogger({
    config: {
      serviceName: "manual-id-2",
      stage: "dev",
      instanceId: instanceId2,
    },
    transports: [transport],
    formatter,
    env,
  });

  strogger1.info("Using manually generated ID 1");
  strogger2.info("Using manually generated ID 2");

  return { strogger1, strogger2 };
};

// Export examples for testing
export {
  demonstrateAutomaticInstanceId,
  demonstrateCustomInstanceId,
  demonstrateMultipleInstances,
  demonstrateInstanceIdInContexts,
  demonstrateManualGeneration,
};
