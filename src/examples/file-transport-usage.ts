import {
  LogLevel,
  createFileTransport,
  createJsonFormatter,
  createLogger,
  getEnvironment,
} from "../index";

// File Transport Usage Examples: Demonstrates the production-ready file transport with various configurations.

// Example 1: Basic File Transport
const demonstrateBasicFileTransport = () => {
  console.log("=== Basic File Transport ===\n");

  const env = getEnvironment();
  const formatter = createJsonFormatter();

  const fileTransport = createFileTransport({
    level: LogLevel.INFO,
    filePath: "./logs/basic-app.log",
    maxFileSize: 5 * 1024 * 1024, // 5MB
    maxFiles: 3,
  });

  const strogger = createLogger({
    config: { serviceName: "basic-file-example", stage: env.stage },
    transports: [fileTransport],
    formatter,
    env,
  });

  strogger.info("Application started with basic file transport");
  strogger.warn("This is a warning message");
  strogger.error("This is an error message", { userId: "user-123" });

  return strogger;
};

// Example 2: File Transport with Compression
const demonstrateCompressedFileTransport = () => {
  console.log("\n=== File Transport with Compression ===\n");

  const env = getEnvironment();
  const formatter = createJsonFormatter();

  const compressedFileTransport = createFileTransport({
    level: LogLevel.DEBUG,
    filePath: "./logs/compressed-app.log",
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    compressOldFiles: true, // Enable compression
    rotationInterval: 12 * 60 * 60 * 1000, // 12 hours
  });

  const strogger = createLogger({
    config: { serviceName: "compressed-file-example", stage: env.stage },
    transports: [compressedFileTransport],
    formatter,
    env,
  });

  strogger.info("Application started with compressed file transport");
  strogger.debug("Debug message with compression enabled");
  strogger.warn("Warning message", { component: "file-transport" });

  return strogger;
};

// Example 3: File Transport with Symlink
const demonstrateFileTransportWithSymlink = () => {
  console.log("\n=== File Transport with Symlink ===\n");

  const env = getEnvironment();
  const formatter = createJsonFormatter();

  const symlinkFileTransport = createFileTransport({
    level: LogLevel.INFO,
    filePath: "./logs/symlink-app.log",
    maxFileSize: 8 * 1024 * 1024, // 8MB
    maxFiles: 4,
    createSymlink: true, // Create symlink to current log file
    symlinkName: "current.log",
  });

  const strogger = createLogger({
    config: { serviceName: "symlink-file-example", stage: env.stage },
    transports: [symlinkFileTransport],
    formatter,
    env,
  });

  strogger.info("Application started with symlink file transport");
  strogger.info("Current log file is always accessible via ./logs/current.log");

  return strogger;
};

// Example 4: Multiple File Transports
const demonstrateMultipleFileTransports = () => {
  console.log("\n=== Multiple File Transports ===\n");

  const env = getEnvironment();
  const formatter = createJsonFormatter();

  // Error-only file transport
  const errorFileTransport = createFileTransport({
    level: LogLevel.ERROR,
    filePath: "./logs/errors.log",
    maxFileSize: 2 * 1024 * 1024, // 2MB
    maxFiles: 10, // Keep more error logs
    compressOldFiles: true,
  });

  // Debug file transport
  const debugFileTransport = createFileTransport({
    level: LogLevel.DEBUG,
    filePath: "./logs/debug.log",
    maxFileSize: 20 * 1024 * 1024, // 20MB
    maxFiles: 2,
    rotationInterval: 6 * 60 * 60 * 1000, // 6 hours
  });

  const strogger = createLogger({
    config: { serviceName: "multi-file-example", stage: env.stage },
    transports: [errorFileTransport, debugFileTransport],
    formatter,
    env,
  });

  strogger.debug("Debug message - goes to debug.log");
  strogger.info("Info message - goes to both files");
  strogger.warn("Warning message - goes to both files");
  strogger.error(
    "Error message - goes to both files, but errors.log keeps more history",
  );

  return strogger;
};

// Example 5: File Transport with Custom Configuration
const demonstrateCustomFileTransport = () => {
  console.log("\n=== Custom File Transport Configuration ===\n");

  const env = getEnvironment();
  const formatter = createJsonFormatter();

  const customFileTransport = createFileTransport({
    level: LogLevel.INFO,
    filePath: "./logs/custom-app.log",
    maxFileSize: 15 * 1024 * 1024, // 15MB
    maxFiles: 7,
    compressOldFiles: true,
    rotationInterval: 24 * 60 * 60 * 1000, // 24 hours
    dateFormat: "YYYY-MM-DD",
    encoding: "utf8",
    createSymlink: true,
    symlinkName: "latest.log",
  });

  const strogger = createLogger({
    config: { serviceName: "custom-file-example", stage: env.stage },
    transports: [customFileTransport],
    formatter,
    env,
  });

  strogger.info("Application started with custom file transport configuration");
  strogger.info(
    "This transport uses custom settings for rotation and compression",
  );

  // Demonstrate transport methods
  console.log("Current file:", customFileTransport.getCurrentFile());
  console.log("Current size:", customFileTransport.getCurrentSize());
  console.log("Transport config:", customFileTransport.getConfig());
  console.log("Transport stats:", customFileTransport.getStats());

  return strogger;
};

// Example 6: Environment-Specific File Transport
const demonstrateEnvironmentSpecificFileTransport = () => {
  console.log("\n=== Environment-Specific File Transport ===\n");

  const env = getEnvironment();
  const formatter = createJsonFormatter();

  // Different configurations for different environments
  const fileTransportConfig = env.isProduction
    ? {
        level: LogLevel.INFO,
        filePath: "/var/log/production-app.log",
        maxFileSize: 50 * 1024 * 1024, // 50MB
        maxFiles: 10,
        compressOldFiles: true,
        createSymlink: true,
        symlinkName: "production-current.log",
      }
    : {
        level: LogLevel.DEBUG,
        filePath: "./logs/dev-app.log",
        maxFileSize: 5 * 1024 * 1024, // 5MB
        maxFiles: 3,
        compressOldFiles: false,
      };

  const fileTransport = createFileTransport(fileTransportConfig);

  const strogger = createLogger({
    config: { serviceName: "env-specific-file-example", stage: env.stage },
    transports: [fileTransport],
    formatter,
    env,
  });

  strogger.info(`Application started in ${env.stage} environment`);
  strogger.info(
    `Using ${env.isProduction ? "production" : "development"} file transport configuration`,
  );

  return strogger;
};

// Run all examples
export const runFileTransportExamples = async () => {
  console.log("🚀 Running File Transport Examples\n");

  try {
    demonstrateBasicFileTransport();
    demonstrateCompressedFileTransport();
    demonstrateFileTransportWithSymlink();
    demonstrateMultipleFileTransports();
    demonstrateCustomFileTransport();
    demonstrateEnvironmentSpecificFileTransport();

    console.log("\n✅ All file transport examples completed!");
    console.log("\n📁 Check the ./logs directory for generated log files");
  } catch (error) {
    console.error("❌ Error running examples:", error);
  }
};

// Export individual examples for testing
export {
  demonstrateBasicFileTransport,
  demonstrateCompressedFileTransport,
  demonstrateFileTransportWithSymlink,
  demonstrateMultipleFileTransports,
  demonstrateCustomFileTransport,
  demonstrateEnvironmentSpecificFileTransport,
};

// Run examples if this file is executed directly
if (require.main === module) {
  runFileTransportExamples().catch(console.error);
}
