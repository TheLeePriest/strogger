/**
 * Strogger Throughput Benchmark
 *
 * Measures logging performance under various conditions.
 *
 * Run with: npx tsx benchmarks/throughput.ts
 */

import {
  logger,
  createLogger,
  createConsoleTransport,
  createJsonFormatter,
  LogLevel,
} from "../src/index";

interface BenchmarkResult {
  name: string;
  opsPerSecond: number;
  avgMs: number;
  totalMs: number;
  iterations: number;
}

const formatNumber = (num: number): string => {
  return num.toLocaleString("en-US", { maximumFractionDigits: 2 });
};

const runBenchmark = async (
  name: string,
  iterations: number,
  fn: () => void,
): Promise<BenchmarkResult> => {
  // Warmup
  for (let i = 0; i < 100; i++) {
    fn();
  }

  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    fn();
  }

  const totalMs = performance.now() - start;
  const avgMs = totalMs / iterations;
  const opsPerSecond = (iterations / totalMs) * 1000;

  return {
    name,
    opsPerSecond,
    avgMs,
    totalMs,
    iterations,
  };
};

const printResult = (result: BenchmarkResult): void => {
  console.log(`\n${result.name}`);
  console.log(`  Ops/sec:    ${formatNumber(result.opsPerSecond)}`);
  console.log(`  Avg time:   ${formatNumber(result.avgMs * 1000)} µs`);
  console.log(`  Total time: ${formatNumber(result.totalMs)} ms`);
  console.log(`  Iterations: ${formatNumber(result.iterations)}`);
};

// Null transport that doesn't output anything
const createNullTransport = () => ({
  log: async () => {},
  flush: async () => {},
  setLevel: () => {},
  getLevel: () => LogLevel.DEBUG,
});

const main = async (): Promise<void> => {
  console.log("=".repeat(60));
  console.log("Strogger Throughput Benchmark");
  console.log("=".repeat(60));

  const iterations = 100_000;

  // Test 1: Simple message logging
  const simpleLog = createLogger({
    config: { serviceName: "benchmark", level: LogLevel.DEBUG },
    transports: [createNullTransport()],
  });

  const result1 = await runBenchmark("Simple message logging", iterations, () => {
    simpleLog.info("Simple log message");
  });
  await simpleLog.flush();
  printResult(result1);

  // Test 2: Logging with data object
  const result2 = await runBenchmark("Logging with data object", iterations, () => {
    simpleLog.info("Log message with data", {
      requestId: "req-123",
      userId: "user-456",
      operation: "test",
    });
  });
  await simpleLog.flush();
  printResult(result2);

  // Test 3: Logging with error
  const testError = new Error("Test error");
  const result3 = await runBenchmark("Logging with error", iterations / 10, () => {
    simpleLog.error("Error occurred", { requestId: "req-123", err: testError });
  });
  await simpleLog.flush();
  printResult(result3);

  // Test 4: Child logger creation
  const childIterations = iterations / 10;
  const result4 = await runBenchmark("Child logger creation", childIterations, () => {
    simpleLog.child({ requestId: "req-123" });
  });
  printResult(result4);

  // Test 5: Child logger logging
  const childLog = simpleLog.child({ requestId: "req-123", userId: "user-456" });
  const result5 = await runBenchmark("Child logger logging", iterations, () => {
    childLog.info("Child log message");
  });
  await childLog.flush();
  printResult(result5);

  // Test 6: Filtered logs (below threshold)
  simpleLog.setLevel(LogLevel.ERROR);
  const result6 = await runBenchmark("Filtered logs (no-op)", iterations, () => {
    simpleLog.debug("This should not be logged");
  });
  printResult(result6);

  // Test 7: Console transport (formatted)
  // Create a logger that outputs to console but we suppress it
  const originalConsoleInfo = console.info;
  console.info = () => {};

  const consoleLog = createLogger({
    config: { serviceName: "benchmark", level: LogLevel.DEBUG },
    transports: [
      createConsoleTransport({
        formatter: createJsonFormatter(),
        level: LogLevel.DEBUG,
      }),
    ],
  });

  const consoleIterations = 10_000;
  const result7 = await runBenchmark(
    "Console transport (JSON)",
    consoleIterations,
    () => {
      consoleLog.info("Log message", { requestId: "req-123" });
    },
  );
  await consoleLog.flush();
  console.info = originalConsoleInfo;
  printResult(result7);

  // Cleanup
  await simpleLog.shutdown();
  await consoleLog.shutdown();

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("Summary");
  console.log("=".repeat(60));
  console.log(`\nSimple logging:     ${formatNumber(result1.opsPerSecond)} ops/sec`);
  console.log(`With data:          ${formatNumber(result2.opsPerSecond)} ops/sec`);
  console.log(`With error:         ${formatNumber(result3.opsPerSecond)} ops/sec`);
  console.log(`Child creation:     ${formatNumber(result4.opsPerSecond)} ops/sec`);
  console.log(`Child logging:      ${formatNumber(result5.opsPerSecond)} ops/sec`);
  console.log(`Filtered (no-op):   ${formatNumber(result6.opsPerSecond)} ops/sec`);
  console.log(`Console output:     ${formatNumber(result7.opsPerSecond)} ops/sec`);
};

main().catch(console.error);
