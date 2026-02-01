const {
  strogger,
  createLogger,
  createConsoleTransport,
  createJsonFormatter,
  LogLevel,
} = require("strogger");

console.log("🧪 Testing strogger package from NPM...\n");

// Test 1: Basic strogger instance
console.log("📊 Test 1: Basic strogger instance");
try {
  strogger.info("Hello from strogger!");
  strogger.debug("Debug message", { userId: "123", action: "test" });
  strogger.warn("Warning message");
  strogger.error("Error message", { error: "test error" });
  console.log("✅ Basic strogger instance works\n");
} catch (error) {
  console.error("❌ Basic strogger instance failed:", error.message);
}

// Test 2: Functional approach with dependency injection
console.log("🔄 Test 2: Functional approach with dependency injection");
try {
  const formatter = createJsonFormatter();
  const transport = createConsoleTransport({
    formatter,
    level: LogLevel.DEBUG,
  });

  const logger = createLogger({
    config: {
      serviceName: "test-service",
      stage: "test",
    },
    transports: [transport],
    formatter,
  });

  logger.info("Functional logger works!", { test: true });
  logger.debug("Debug from functional logger", { component: "test" });
  console.log("✅ Functional approach works\n");
} catch (error) {
  console.error("❌ Functional approach failed:", error.message);
}

// Test 3: Check package version
console.log("📦 Test 3: Package information");
try {
  const packageJson = require("strogger/package.json");
  console.log(`✅ Package version: ${packageJson.version}`);
  console.log(`✅ Package name: ${packageJson.name}`);
  console.log(`✅ Package description: ${packageJson.description}`);
} catch (error) {
  console.error("❌ Could not read package.json:", error.message);
}

// Test 4: Check TypeScript definitions are available
console.log("\n📝 Test 4: TypeScript definitions");
try {
  const fs = require("node:fs");
  const path = require("node:path");
  const nodeModulesPath = path.join(__dirname, "node_modules", "strogger");

  const hasTypes = fs.existsSync(
    path.join(nodeModulesPath, "dist", "index.d.ts"),
  );
  const hasMain = fs.existsSync(path.join(nodeModulesPath, "dist", "index.js"));

  console.log(
    `✅ TypeScript definitions: ${hasTypes ? "Available" : "Missing"}`,
  );
  console.log(`✅ Main JavaScript file: ${hasMain ? "Available" : "Missing"}`);
} catch (error) {
  console.error("❌ Could not check TypeScript definitions:", error.message);
}

// Test 5: Test convenience methods
console.log("\n🎯 Test 5: Convenience methods");
try {
  strogger.logFunctionStart("testFunction", { functionName: "testFunction" });
  strogger.logDatabaseOperation("SELECT", "users", { table: "users" });
  strogger.logApiRequest("GET", "/api/test", 200, { endpoint: "/api/test" });
  strogger.logFunctionEnd("testFunction", 150, {
    functionName: "testFunction",
  });
  console.log("✅ Convenience methods work\n");
} catch (error) {
  console.error("❌ Convenience methods failed:", error.message);
}

// Test 6: Test importing examples (should not throw errors)
console.log("\n📚 Test 6: Importing examples (should not throw)");
try {
  // These should not throw errors even without environment variables
  require("strogger/dist/examples/branded-api-example");
  require("strogger/dist/examples/third-party-integrations");
  require("strogger/dist/examples/functional-usage");
  console.log("✅ Example imports work without errors\n");
} catch (error) {
  console.error("❌ Example imports failed:", error.message);
}

// Test 7: Test structured logging output
console.log("\n📊 Test 7: Structured logging output");
try {
  const testLogger = createLogger({
    config: {
      serviceName: "structured-test",
      stage: "test",
    },
    transports: [
      createConsoleTransport({
        formatter: createJsonFormatter(),
        level: LogLevel.INFO,
      }),
    ],
    formatter: createJsonFormatter(),
  });

  testLogger.info("Structured log test", {
    testId: "123",
    feature: "structured-logging",
    timestamp: new Date().toISOString(),
  });
  console.log("✅ Structured logging works correctly\n");
} catch (error) {
  console.error("❌ Structured logging failed:", error.message);
}

console.log("🎉 All tests completed!");
