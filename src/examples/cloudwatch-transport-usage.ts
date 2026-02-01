import {
  LogLevel,
  createCloudWatchTransport,
  createJsonFormatter,
  createLogger,
  getEnvironment,
} from "../index";

// CloudWatch Transport Usage Examples: Demonstrates the production-ready CloudWatch transport with various configurations.

// Example 1: Basic CloudWatch Transport
const demonstrateBasicCloudWatchTransport = () => {
  console.log("=== Basic CloudWatch Transport ===\n");

  const env = getEnvironment();
  const formatter = createJsonFormatter();

  const cloudWatchTransport = createCloudWatchTransport({
    level: LogLevel.INFO,
    logGroupName: "/aws/lambda/basic-example",
    region: "us-east-1",
    batchSize: 5,
    flushInterval: 3000,
  });

  const strogger = createLogger({
    config: { serviceName: "basic-cloudwatch-example", stage: env.stage },
    transports: [cloudWatchTransport],
    formatter,
    env,
  });

  strogger.info("Application started with basic CloudWatch transport");
  strogger.warn("This is a warning message");
  strogger.error("This is an error message", { userId: "user-123" });

  return strogger;
};

// Example 2: CloudWatch Transport with Stream Rotation
const demonstrateCloudWatchWithRotation = () => {
  console.log("\n=== CloudWatch Transport with Stream Rotation ===\n");

  const env = getEnvironment();
  const formatter = createJsonFormatter();

  const cloudWatchTransport = createCloudWatchTransport({
    level: LogLevel.DEBUG,
    logGroupName: "/aws/lambda/rotation-example",
    logStreamName: "rotation-stream",
    region: "us-east-1",
    maxStreamSize: 40 * 1024 * 1024, // 40MB (conservative)
    maxStreamAge: 20 * 60 * 60 * 1000, // 20 hours (conservative)
    batchSize: 10,
    flushInterval: 5000,
  });

  const strogger = createLogger({
    config: { serviceName: "rotation-cloudwatch-example", stage: env.stage },
    transports: [cloudWatchTransport],
    formatter,
    env,
  });

  strogger.info("Application started with CloudWatch stream rotation");
  strogger.debug("Debug message with rotation enabled");
  strogger.warn("Warning message", { component: "cloudwatch-transport" });

  return strogger;
};

// Example 3: Lambda-Specific CloudWatch Transport
const demonstrateLambdaCloudWatchTransport = () => {
  console.log("\n=== Lambda-Specific CloudWatch Transport ===\n");

  const env = getEnvironment();
  const formatter = createJsonFormatter();

  const lambdaCloudWatchTransport = createCloudWatchTransport({
    level: LogLevel.INFO,
    logGroupName: "/aws/lambda/my-lambda-function",
    logStreamName: `my-lambda-function-${Date.now()}`,
    region: "us-east-1",
    maxStreamSize: 40 * 1024 * 1024, // Conservative for Lambda
    maxStreamAge: 20 * 60 * 60 * 1000, // Conservative for Lambda
    batchSize: 5, // Smaller batches for Lambda
    flushInterval: 2000, // More frequent flushing
    timeout: 15000, // Shorter timeout for Lambda
  });

  const strogger = createLogger({
    config: { serviceName: "lambda-cloudwatch-example", stage: env.stage },
    transports: [lambdaCloudWatchTransport],
    formatter,
    env,
  });

  strogger.info("Lambda function started with CloudWatch transport");
  strogger.info("This configuration is optimized for AWS Lambda environments");

  return strogger;
};

// Example 4: Multiple CloudWatch Transports
const demonstrateMultipleCloudWatchTransports = () => {
  console.log("\n=== Multiple CloudWatch Transports ===\n");

  const env = getEnvironment();
  const formatter = createJsonFormatter();

  // Error-only CloudWatch transport
  const errorCloudWatchTransport = createCloudWatchTransport({
    level: LogLevel.ERROR,
    logGroupName: "/aws/lambda/errors",
    logStreamName: "error-stream",
    region: "us-east-1",
    maxStreamSize: 10 * 1024 * 1024, // Smaller for errors
    batchSize: 3, // Smaller batches for errors
  });

  // Debug CloudWatch transport
  const debugCloudWatchTransport = createCloudWatchTransport({
    level: LogLevel.DEBUG,
    logGroupName: "/aws/lambda/debug",
    logStreamName: "debug-stream",
    region: "us-east-1",
    maxStreamSize: 50 * 1024 * 1024, // Larger for debug
    batchSize: 15, // Larger batches for debug
  });

  const strogger = createLogger({
    config: { serviceName: "multi-cloudwatch-example", stage: env.stage },
    transports: [errorCloudWatchTransport, debugCloudWatchTransport],
    formatter,
    env,
  });

  strogger.debug("Debug message - goes to debug log group");
  strogger.info("Info message - goes to both log groups");
  strogger.warn("Warning message - goes to both log groups");
  strogger.error(
    "Error message - goes to both log groups, but errors log group is optimized for errors",
  );

  return strogger;
};

// Example 5: CloudWatch Transport with Custom Configuration
const demonstrateCustomCloudWatchTransport = () => {
  console.log("\n=== Custom CloudWatch Transport Configuration ===\n");

  const env = getEnvironment();
  const formatter = createJsonFormatter();

  const customCloudWatchTransport = createCloudWatchTransport({
    level: LogLevel.INFO,
    logGroupName: "/aws/lambda/custom-example",
    logStreamName: "custom-stream",
    region: "us-west-2",
    maxStreamSize: 45 * 1024 * 1024, // 45MB
    maxStreamAge: 23 * 60 * 60 * 1000, // 23 hours
    batchSize: 20,
    flushInterval: 10000, // 10 seconds
    timeout: 30000, // 30 seconds
  });

  const strogger = createLogger({
    config: { serviceName: "custom-cloudwatch-example", stage: env.stage },
    transports: [customCloudWatchTransport],
    formatter,
    env,
  });

  strogger.info(
    "Application started with custom CloudWatch transport configuration",
  );
  strogger.info(
    "This transport uses custom settings for batching and timeouts",
  );

  // Demonstrate transport methods
  console.log("Current stream:", customCloudWatchTransport.getCurrentStream());
  console.log(
    "Current stream size:",
    customCloudWatchTransport.getCurrentStreamSize(),
  );
  console.log("Transport config:", customCloudWatchTransport.getConfig());
  console.log("Transport stats:", customCloudWatchTransport.getStats());

  return strogger;
};

// Example 6: Environment-Specific CloudWatch Transport
const demonstrateEnvironmentSpecificCloudWatchTransport = () => {
  console.log("\n=== Environment-Specific CloudWatch Transport ===\n");

  const env = getEnvironment();
  const formatter = createJsonFormatter();

  // Different configurations for different environments
  const cloudWatchConfig = env.isProduction
    ? {
        level: LogLevel.INFO,
        logGroupName: "/aws/lambda/production-app",
        logStreamName: "production-stream",
        region: "us-east-1",
        maxStreamSize: 45 * 1024 * 1024, // 45MB
        maxStreamAge: 23 * 60 * 60 * 1000, // 23 hours
        batchSize: 15,
        flushInterval: 5000,
      }
    : {
        level: LogLevel.DEBUG,
        logGroupName: "/aws/lambda/dev-app",
        logStreamName: "dev-stream",
        region: "us-east-1",
        maxStreamSize: 20 * 1024 * 1024, // 20MB
        maxStreamAge: 12 * 60 * 60 * 1000, // 12 hours
        batchSize: 5,
        flushInterval: 2000,
      };

  const cloudWatchTransport = createCloudWatchTransport(cloudWatchConfig);

  const strogger = createLogger({
    config: {
      serviceName: "env-specific-cloudwatch-example",
      stage: env.stage,
    },
    transports: [cloudWatchTransport],
    formatter,
    env,
  });

  strogger.info(`Application started in ${env.stage} environment`);
  strogger.info(
    `Using ${env.isProduction ? "production" : "development"} CloudWatch configuration`,
  );

  return strogger;
};

// Example 7: CloudWatch Transport with Manual Stream Rotation
const demonstrateManualStreamRotation = () => {
  console.log("\n=== CloudWatch Transport with Manual Stream Rotation ===\n");

  const env = getEnvironment();
  const formatter = createJsonFormatter();

  const cloudWatchTransport = createCloudWatchTransport({
    level: LogLevel.INFO,
    logGroupName: "/aws/lambda/manual-rotation-example",
    logStreamName: "manual-rotation-stream",
    region: "us-east-1",
    batchSize: 5,
    flushInterval: 3000,
  });

  const strogger = createLogger({
    config: { serviceName: "manual-rotation-example", stage: env.stage },
    transports: [cloudWatchTransport],
    formatter,
    env,
  });

  strogger.info("Application started with manual stream rotation capability");
  strogger.info(
    "You can call cloudWatchTransport.rotateStream() to manually rotate the stream",
  );

  // Demonstrate manual rotation
  setTimeout(async () => {
    console.log("Manually rotating CloudWatch stream...");
    await cloudWatchTransport.rotateStream();
    strogger.info("Stream rotated manually");
  }, 2000);

  return strogger;
};

// Run all examples
export const runCloudWatchTransportExamples = async () => {
  console.log("🚀 Running CloudWatch Transport Examples\n");

  try {
    demonstrateBasicCloudWatchTransport();
    demonstrateCloudWatchWithRotation();
    demonstrateLambdaCloudWatchTransport();
    demonstrateMultipleCloudWatchTransports();
    demonstrateCustomCloudWatchTransport();
    demonstrateEnvironmentSpecificCloudWatchTransport();
    demonstrateManualStreamRotation();

    console.log("\n✅ All CloudWatch transport examples completed!");
    console.log(
      "\n☁️  Check your CloudWatch console for log groups and streams",
    );
  } catch (error) {
    console.error("❌ Error running examples:", error);
  }
};

// Export individual examples for testing
export {
  demonstrateBasicCloudWatchTransport,
  demonstrateCloudWatchWithRotation,
  demonstrateLambdaCloudWatchTransport,
  demonstrateMultipleCloudWatchTransports,
  demonstrateCustomCloudWatchTransport,
  demonstrateEnvironmentSpecificCloudWatchTransport,
  demonstrateManualStreamRotation,
};

// Run examples if this file is executed directly
if (require.main === module) {
  runCloudWatchTransportExamples().catch(console.error);
}
