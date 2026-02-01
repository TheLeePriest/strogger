// Structured Logging Demo: Demonstrates the core focus of structured JSON logging
import {
  LogLevel,
  createConsoleTransport,
  createJsonFormatter,
  createLogger,
  getEnvironment,
} from "../index";

// This example demonstrates why structured logging is the core focus of this library

const env = getEnvironment();
const formatter = createJsonFormatter();

// Create a logger with structured JSON output
const structuredLogger = createLogger({
  config: {
    serviceName: "structured-logging-demo",
    stage: env.stage,
    // Structured logging is enabled by default
    enableStructuredLogging: true,
  },
  transports: [createConsoleTransport({ formatter, level: LogLevel.DEBUG })],
  formatter,
  env,
});

// Example 1: Basic Structured Logging
const demonstrateBasicStructuredLogging = () => {
  console.log("=== Basic Structured Logging ===\n");

  // Every log is automatically structured JSON
  structuredLogger.info("User login successful", {
    userId: "user-123",
    email: "user@example.com",
    loginMethod: "password",
    ipAddress: "192.168.1.100",
  });

  structuredLogger.debug("Processing request", {
    requestId: "req-456",
    endpoint: "/api/users",
    method: "GET",
    userAgent: "Mozilla/5.0...",
  });

  structuredLogger.warn("High memory usage detected", {
    memoryUsage: "85%",
    threshold: "80%",
    serverId: "server-001",
    timestamp: new Date().toISOString(),
  });

  structuredLogger.error(
    "Database connection failed",
    {
      database: "primary",
      retryAttempts: 3,
      errorCode: "ECONNREFUSED",
    },
    new Error("Connection timeout after 30 seconds"),
  );
};

// Example 2: Structured Logging with Correlation
const demonstrateCorrelatedStructuredLogging = () => {
  console.log("\n=== Structured Logging with Correlation ===\n");

  const correlationId = "corr-789";
  const traceId = "trace-abc123";

  // All logs in this request flow share the same correlation data
  structuredLogger.info("Request started", {
    correlationId,
    traceId,
    requestId: "req-789",
    userId: "user-456",
    endpoint: "/api/orders",
    method: "POST",
  });

  structuredLogger.debug("Validating order data", {
    correlationId,
    traceId,
    orderId: "order-123",
    items: 3,
    totalAmount: 150.0,
  });

  structuredLogger.info("Order created successfully", {
    correlationId,
    traceId,
    orderId: "order-123",
    status: "confirmed",
    processingTime: 150,
  });
};

// Example 3: Structured Logging for Business Events
const demonstrateBusinessEventStructuredLogging = () => {
  console.log("\n=== Business Event Structured Logging ===\n");

  // Payment processing with structured data
  structuredLogger.info("Payment processing started", {
    paymentId: "pay-001",
    amount: 99.99,
    currency: "USD",
    paymentMethod: "credit_card",
    customerId: "cust-123",
    orderId: "order-456",
  });

  structuredLogger.info("Payment authorized", {
    paymentId: "pay-001",
    transactionId: "txn-789",
    authorizationCode: "AUTH123",
    processingTime: 250,
  });

  // User activity tracking
  structuredLogger.info("User action performed", {
    userId: "user-789",
    action: "product_view",
    productId: "prod-123",
    category: "electronics",
    sessionId: "sess-abc",
    timestamp: new Date().toISOString(),
  });
};

// Example 4: Structured Logging for Performance Monitoring
const demonstratePerformanceStructuredLogging = () => {
  console.log("\n=== Performance Monitoring Structured Logging ===\n");

  const startTime = Date.now();

  // Function execution with structured timing
  structuredLogger.logFunctionStart("processOrder", {
    orderId: "order-999",
    items: 5,
    customerTier: "premium",
  });

  // Simulate some work
  setTimeout(() => {
    const duration = Date.now() - startTime;

    structuredLogger.logFunctionEnd("processOrder", duration, {
      orderId: "order-999",
      success: true,
      itemsProcessed: 5,
    });

    // Performance metrics
    structuredLogger.info("Performance metric recorded", {
      metricName: "order_processing_time",
      value: duration,
      unit: "ms",
      threshold: 1000,
      status: duration < 1000 ? "good" : "slow",
    });
  }, 150);
};

// Example 5: Structured Logging for Error Analysis
const demonstrateErrorStructuredLogging = () => {
  console.log("\n=== Error Analysis Structured Logging ===\n");

  try {
    // Simulate an error
    throw new Error("Database query timeout");
  } catch (error) {
    structuredLogger.error(
      "Database operation failed",
      {
        operation: "SELECT",
        table: "users",
        query: "SELECT * FROM users WHERE email = ?",
        parameters: ["user@example.com"],
        timeout: 5000,
        retryAttempt: 2,
        database: "primary",
        connectionPool: "pool-1",
      },
      error as Error,
    );

    // Error context for debugging
    structuredLogger.debug("Error context", {
      stackTrace: (error as Error).stack,
      errorCode: "DB_TIMEOUT",
      severity: "high",
      impact: "user_login_blocked",
    });
  }
};

// Example 6: Structured Logging Schema Consistency
const demonstrateSchemaConsistency = () => {
  console.log("\n=== Schema Consistency in Structured Logging ===\n");

  // All logs follow the same schema structure
  const logEntries = [
    {
      level: "INFO",
      message: "API request processed",
      context: {
        requestId: "req-001",
        endpoint: "/api/users",
        method: "GET",
        statusCode: 200,
        responseTime: 45,
      },
    },
    {
      level: "ERROR",
      message: "Authentication failed",
      context: {
        requestId: "req-002",
        endpoint: "/api/login",
        method: "POST",
        statusCode: 401,
        reason: "invalid_credentials",
      },
    },
    {
      level: "DEBUG",
      message: "Cache hit",
      context: {
        requestId: "req-003",
        cacheKey: "user:123:profile",
        cacheHit: true,
        responseTime: 2,
      },
    },
  ];

  // Each log maintains consistent schema
  for (const entry of logEntries) {
    const loggerMethod =
      entry.level.toLowerCase() as keyof typeof structuredLogger;
    if (loggerMethod === "info") {
      structuredLogger.info(entry.message, entry.context);
    } else if (loggerMethod === "error") {
      structuredLogger.error(entry.message, entry.context);
    } else if (loggerMethod === "debug") {
      structuredLogger.debug(entry.message, entry.context);
    }
  }
};

// Run all structured logging demonstrations
export const runStructuredLoggingDemo = () => {
  console.log("🎯 Structured Logging Demo - Core Focus\n");
  console.log(
    "This demo shows why structured JSON logging is the core focus of this library.\n",
  );

  demonstrateBasicStructuredLogging();
  demonstrateCorrelatedStructuredLogging();
  demonstrateBusinessEventStructuredLogging();
  demonstratePerformanceStructuredLogging();
  demonstrateErrorStructuredLogging();
  demonstrateSchemaConsistency();

  console.log("\n✅ Structured logging demo completed!");
  console.log("\n📊 Key Benefits of Structured Logging:");
  console.log("  • Consistent JSON schema across all logs");
  console.log("  • Machine-readable format for automation");
  console.log("  • Easy correlation and tracing");
  console.log("  • Powerful search and filtering capabilities");
  console.log("  • Scalable for high-volume logging systems");
};

// Export for testing
export {
  demonstrateBasicStructuredLogging,
  demonstrateCorrelatedStructuredLogging,
  demonstrateBusinessEventStructuredLogging,
  demonstratePerformanceStructuredLogging,
  demonstrateErrorStructuredLogging,
  demonstrateSchemaConsistency,
};

// Run demo if this file is executed directly
if (require.main === module) {
  runStructuredLoggingDemo();
}
