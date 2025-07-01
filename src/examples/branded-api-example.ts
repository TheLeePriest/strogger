// Branded API Example: Demonstrates using Strogger's branded function names
import {
  LogLevel,
  createStrogger,
  createStroggerConsoleTransport,
  createStroggerDataDogTransport,
  createJsonFormatter,
  getEnvironment,
  createLogger,
} from "../index";

// Example 1: Basic Branded API Usage
export const demonstrateBrandedAPI = () => {
  const env = getEnvironment();
  const formatter = createJsonFormatter();
  const consoleTransport = createStroggerConsoleTransport({
    formatter,
    level: LogLevel.DEBUG,
  });
  const dataDogTransport = createStroggerDataDogTransport({
    level: LogLevel.INFO,
    serviceName: "branded-api-example",
    tags: ["env:dev", "team:backend"],
  });
  const strogger = createStrogger({
    config: {
      serviceName: "branded-api-demo",
      stage: env.stage,
    },
    transports: [consoleTransport, dataDogTransport],
    formatter,
    env,
  });
  console.log("=== Branded API Usage ===\n");
  strogger.info("Application started with branded API");
  strogger.debug("Debug message using branded functions");
  strogger.warn("Warning message with brand consistency");
  strogger.error("Error message", { userId: "user-123" });
  return strogger;
};

// Example 2: Branded vs Conventional Comparison
export const demonstrateAPIComparison = () => {
  console.log("\n=== Branded vs Conventional API ===\n");
  console.log("Both approaches work identically:");
  console.log("- createLogger() === createStrogger()");
  console.log("- createConsoleTransport() === createStroggerConsoleTransport()");
  console.log("- createDataDogTransport() === createStroggerDataDogTransport()");
};

// Example 3: Mixed Branded and Conventional
export const demonstrateMixedUsage = () => {
  const env = getEnvironment();
  const formatter = createJsonFormatter();
  const mixedStrogger = createLogger({
    config: { serviceName: "mixed-usage-demo" },
    transports: [
      createStroggerConsoleTransport({ formatter }),
      createStroggerDataDogTransport({ level: LogLevel.INFO }),
    ],
    formatter,
    env,
  });
  console.log("\n=== Mixed Branded and Conventional ===\n");
  mixedStrogger.info("Mixed approach - conventional createLogger with branded transports");
};

// Run all branded API examples
export const runBrandedAPIExamples = () => {
  console.log("🎨 Running Branded API Examples\n");
  try {
    demonstrateBrandedAPI();
    demonstrateAPIComparison();
    demonstrateMixedUsage();
    console.log("\n✅ All branded API examples completed!");
    console.log("\n💡 Benefits of Branded API:");
    console.log("  • Clear brand ownership");
    console.log("  • Consistent naming convention");
    console.log("  • Easy to identify Strogger functions");
    console.log("  • No breaking changes - conventional API still works");
  } catch (error) {
    console.error("❌ Error running branded API examples:", error);
  }
};

// Only run examples if this file is executed directly
if (require.main === module) {
  runBrandedAPIExamples();
} 