import { describe, expect, it } from "vitest";
import {
  type Formatter,
  type LogEntry,
  LogLevel,
  type LoggerConfig,
  type Transport,
  createConsoleTransport,
  createJsonFormatter,
  createLogger,
  createNewRelicTransport,
  createPerformanceMonitor,
  getEnvironment,
} from "../src/index";

describe("index exports", () => {
  it("should export all required functions", () => {
    expect(typeof createLogger).toBe("function");
    expect(typeof createConsoleTransport).toBe("function");
    expect(typeof createNewRelicTransport).toBe("function");
    expect(typeof createJsonFormatter).toBe("function");
    expect(typeof createPerformanceMonitor).toBe("function");
    expect(typeof getEnvironment).toBe("function");
  });

  it("should export LogLevel enum", () => {
    expect(LogLevel.DEBUG).toBe(0);
    expect(LogLevel.INFO).toBe(1);
    expect(LogLevel.WARN).toBe(2);
    expect(LogLevel.ERROR).toBe(3);
    expect(LogLevel.FATAL).toBe(4);
  });

  it("should export type definitions", () => {
    // These should not throw if types are properly exported
    const logEntry: LogEntry = {
      timestamp: "2024-01-15T10:30:00.000Z",
      level: LogLevel.INFO,
      message: "Test message",
    };

    const loggerConfig: LoggerConfig = {
      serviceName: "test-service",
    };

    const transport: Transport = {
      log: async () => {},
      setLevel: () => {},
      getLevel: () => LogLevel.INFO,
    };

    const formatter: Formatter = {
      format: () => "formatted",
    };

    expect(logEntry).toBeDefined();
    expect(loggerConfig).toBeDefined();
    expect(transport).toBeDefined();
    expect(formatter).toBeDefined();
  });
});

describe("integration tests", () => {
  it("should create a working logger with console transport", () => {
    const formatter = createJsonFormatter();
    const transport = createConsoleTransport({ formatter });
    const env = getEnvironment();

    const logger = createLogger({
      config: { serviceName: "test-service" },
      transports: [transport],
      formatter,
      env,
    });

    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
  });

  it("should create a working logger with New Relic transport", () => {
    const formatter = createJsonFormatter();
    const transport = createNewRelicTransport({
      apiKey: "test-key",
      accountId: "test-account",
    });
    const env = getEnvironment();

    const logger = createLogger({
      config: { serviceName: "test-service" },
      transports: [transport],
      formatter,
      env,
    });

    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
  });

  it("should create a working logger with multiple transports", () => {
    const formatter = createJsonFormatter();
    const consoleTransport = createConsoleTransport({ formatter });
    const newRelicTransport = createNewRelicTransport({
      apiKey: "test-key",
      accountId: "test-account",
    });
    const env = getEnvironment();

    const logger = createLogger({
      config: { serviceName: "test-service" },
      transports: [consoleTransport, newRelicTransport],
      formatter,
      env,
    });

    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
  });

  it("should create a performance monitor", () => {
    const monitor = createPerformanceMonitor();

    expect(monitor).toBeDefined();
    expect(typeof monitor.startTimer).toBe("function");
    expect(typeof monitor.timeAsync).toBe("function");
    expect(typeof monitor.timeSync).toBe("function");
    expect(typeof monitor.getMetrics).toBe("function");
  });

  it("should get environment configuration", () => {
    const env = getEnvironment();

    expect(env).toBeDefined();
    expect(typeof env.STAGE).toBe("string");
    expect(typeof env.isProduction).toBe("boolean");
    expect(typeof env.isDevelopment).toBe("boolean");
  });
});
