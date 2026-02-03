import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createConsoleTransport,
  createJsonFormatter,
  getEnvironment,
} from "../src/index";
import { createLogger } from "../src/logger";
import { LogLevel } from "../src/types";

describe("createLogger", () => {
  let logger: ReturnType<typeof createLogger>;
  let debugSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let env: ReturnType<typeof getEnvironment>;

  beforeEach(() => {
    process.env.LOG_LEVEL = undefined;
    env = getEnvironment();
    debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  const getLoggedMessage = (spy: ReturnType<typeof vi.spyOn>) => {
    if (spy.mock.calls.length === 0) {
      throw new Error("No log message was produced");
    }
    return spy.mock.calls[0][0] as string;
  };

  afterEach(async () => {
    if (logger) {
      await logger.shutdown();
    }
    vi.restoreAllMocks();
    process.env.LOG_LEVEL = undefined;
  });

  describe("basic functionality", () => {
    beforeEach(() => {
      const formatter = createJsonFormatter();
      const transport = createConsoleTransport({
        formatter,
        level: LogLevel.DEBUG,
      });

      logger = createLogger({
        config: { serviceName: "test-service", level: LogLevel.DEBUG },
        transports: [transport],
        formatter,
        env,
      });
    });

    it("should create logger with required methods", () => {
      expect(logger).toHaveProperty("debug");
      expect(logger).toHaveProperty("info");
      expect(logger).toHaveProperty("warn");
      expect(logger).toHaveProperty("error");
      expect(logger).toHaveProperty("fatal");
      expect(logger).toHaveProperty("setLevel");
      expect(logger).toHaveProperty("getLevel");
      expect(logger).toHaveProperty("flush");
      expect(logger).toHaveProperty("shutdown");
      expect(typeof logger.debug).toBe("function");
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.fatal).toBe("function");
    });

    it("should log info messages", async () => {
      logger.info("Test info message");
      await logger.flush();

      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining("Test info message"),
      );
    });

    it("should log debug messages", async () => {
      logger.debug("Test debug message");
      await logger.flush();

      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining("Test debug message"),
      );
    });

    it("should log warn messages", async () => {
      logger.warn("Test warning message");
      await logger.flush();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Test warning message"),
      );
    });

    it("should log error messages", async () => {
      logger.error("Test error message");
      await logger.flush();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Test error message"),
      );
    });

    it("should log fatal messages", async () => {
      logger.fatal("Test fatal message");
      await logger.flush();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Test fatal message"),
      );
    });
  });

  describe("data parameter", () => {
    beforeEach(() => {
      const formatter = createJsonFormatter();
      const transport = createConsoleTransport({
        formatter,
        level: LogLevel.DEBUG,
      });

      logger = createLogger({
        config: { serviceName: "test-service", level: LogLevel.DEBUG },
        transports: [transport],
        formatter,
        env,
      });
    });

    it("should include data fields in log entries", async () => {
      logger.info("Message with data", {
        requestId: "req-123",
        userId: "user-456",
      });
      await logger.flush();

      const loggedMessage = getLoggedMessage(infoSpy);
      const parsed = JSON.parse(loggedMessage);

      expect(parsed.requestId).toBe("req-123");
      expect(parsed.userId).toBe("user-456");
    });

    it("should include extra fields in data", async () => {
      logger.info("Message with extra data", {
        requestId: "req-123",
        operation: "test",
        duration: 150,
      });
      await logger.flush();

      const loggedMessage = getLoggedMessage(infoSpy);
      const parsed = JSON.parse(loggedMessage);

      expect(parsed.requestId).toBe("req-123");
      expect(parsed.operation).toBe("test");
      expect(parsed.duration).toBe(150);
    });

    it("should handle error in data object", async () => {
      const error = new Error("Test error");

      logger.error("Error occurred", {
        requestId: "req-123",
        err: error,
      });
      await logger.flush();

      const loggedMessage = getLoggedMessage(errorSpy);
      const parsed = JSON.parse(loggedMessage);

      expect(parsed.error.name).toBe("Error");
      expect(parsed.error.message).toBe("Test error");
      expect(parsed.error.stack).toBe(error.stack);
      expect(parsed.requestId).toBe("req-123");
    });

    it("should handle error with additional data", async () => {
      const error = new Error("Test error");

      logger.error("Error occurred", {
        requestId: "req-123",
        err: error,
        severity: "high",
      });
      await logger.flush();

      const loggedMessage = getLoggedMessage(errorSpy);
      const parsed = JSON.parse(loggedMessage);

      expect(parsed.error.name).toBe("Error");
      expect(parsed.error.message).toBe("Test error");
      expect(parsed.requestId).toBe("req-123");
      expect(parsed.severity).toBe("high");
    });
  });

  describe("log level management", () => {
    beforeEach(() => {
      const formatter = createJsonFormatter();
      const transport = createConsoleTransport({
        formatter,
        level: LogLevel.DEBUG,
      });
      const config = { serviceName: "test-service", level: LogLevel.DEBUG };
      logger = createLogger({
        config,
        transports: [transport],
        formatter,
        env,
      });
    });

    it("should return current log level", () => {
      expect(logger.getLevel()).toBe(LogLevel.DEBUG);
    });

    it("should allow setting log level with enum", () => {
      expect(logger.getLevel()).toBe(LogLevel.DEBUG);
      logger.setLevel(LogLevel.ERROR);
      expect(logger.getLevel()).toBe(LogLevel.ERROR);
    });

    it("should allow setting log level with string", () => {
      logger.setLevel("warn");
      expect(logger.getLevel()).toBe(LogLevel.WARN);
    });

    it("should filter logs based on level", async () => {
      logger.setLevel(LogLevel.WARN);

      logger.debug("Debug message");
      logger.info("Info message");
      logger.warn("Warning message");
      await logger.flush();

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Warning message"),
      );
      expect(infoSpy).not.toHaveBeenCalled();
      expect(debugSpy).not.toHaveBeenCalled();
    });
  });

  describe("multiple transports", () => {
    let transport1: ReturnType<typeof createConsoleTransport>;
    let transport2: ReturnType<typeof createConsoleTransport>;

    beforeEach(() => {
      const formatter = createJsonFormatter();
      transport1 = createConsoleTransport({ formatter, level: LogLevel.INFO });
      transport2 = createConsoleTransport({ formatter, level: LogLevel.WARN });

      logger = createLogger({
        config: { serviceName: "test-service", level: LogLevel.DEBUG },
        transports: [transport1, transport2],
        formatter,
        env,
      });
    });

    it("should send logs to all transports", async () => {
      logger.warn("Test warning");
      await logger.flush();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Test warning"),
      );
    });

    it("should respect individual transport levels", async () => {
      logger.info("Test info");
      await logger.flush();

      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining("Test info"),
      );
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe("configuration", () => {
    it("should use service name from config", async () => {
      const formatter = createJsonFormatter();
      const transport = createConsoleTransport({
        formatter,
        level: LogLevel.DEBUG,
      });

      logger = createLogger({
        config: { serviceName: "custom-service", level: LogLevel.DEBUG },
        transports: [transport],
        formatter,
        env,
      });

      logger.info("Test message");
      await logger.flush();

      const loggedMessage = getLoggedMessage(infoSpy);
      const parsed = JSON.parse(loggedMessage);

      expect(parsed.serviceName).toBe("custom-service");
    });

    it("should use stage from config", async () => {
      const formatter = createJsonFormatter();
      const transport = createConsoleTransport({
        formatter,
        level: LogLevel.DEBUG,
      });

      logger = createLogger({
        config: {
          serviceName: "test-service",
          stage: "prod",
          level: LogLevel.DEBUG,
        },
        transports: [transport],
        formatter,
        env,
      });

      logger.info("Test message");
      await logger.flush();

      const loggedMessage = getLoggedMessage(infoSpy);
      const parsed = JSON.parse(loggedMessage);

      expect(parsed.stage).toBe("prod");
    });

    it("should include timestamp in logs", async () => {
      const formatter = createJsonFormatter();
      const transport = createConsoleTransport({
        formatter,
        level: LogLevel.DEBUG,
      });

      logger = createLogger({
        config: { serviceName: "test-service", level: LogLevel.DEBUG },
        transports: [transport],
        formatter,
        env,
      });

      logger.info("Test message");
      await logger.flush();

      const loggedMessage = getLoggedMessage(infoSpy);
      const parsed = JSON.parse(loggedMessage);

      expect(parsed.timestamp).toBeDefined();
      expect(new Date(parsed.timestamp)).toBeInstanceOf(Date);
    });

    it("should accept string log level", async () => {
      const formatter = createJsonFormatter();
      const transport = createConsoleTransport({
        formatter,
        level: LogLevel.DEBUG,
      });

      logger = createLogger({
        config: { serviceName: "test-service", level: "debug" },
        transports: [transport],
        formatter,
        env,
      });

      expect(logger.getLevel()).toBe(LogLevel.DEBUG);
    });
  });

  describe("error handling", () => {
    it("should handle transport errors gracefully", async () => {
      const formatter = createJsonFormatter();
      const failingTransport = {
        log: vi.fn().mockRejectedValue(new Error("Transport failed")),
        setLevel: vi.fn(),
        getLevel: vi.fn().mockReturnValue(LogLevel.INFO),
      };

      const workingTransport = createConsoleTransport({
        formatter,
        level: LogLevel.DEBUG,
      });

      logger = createLogger({
        config: { serviceName: "test-service", level: LogLevel.DEBUG },
        transports: [failingTransport, workingTransport],
        formatter,
        env,
      });

      // Should not throw an error
      logger.info("Test message");
      await logger.flush();

      // Should log transport error to console via the default error handler
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Transport error"),
        expect.any(Error),
      );

      // Should still log to working transport
      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining("Test message"),
      );
    });
  });

  describe("child loggers", () => {
    beforeEach(() => {
      const formatter = createJsonFormatter();
      const transport = createConsoleTransport({
        formatter,
        level: LogLevel.DEBUG,
      });

      logger = createLogger({
        config: { serviceName: "test-service", level: LogLevel.DEBUG },
        transports: [transport],
        formatter,
        env,
      });
    });

    it("should create child with additional context", async () => {
      const child = logger.child({ requestId: "req-123" });

      child.info("Child message");
      await child.flush();

      const loggedMessage = getLoggedMessage(infoSpy);
      const parsed = JSON.parse(loggedMessage);

      expect(parsed.requestId).toBe("req-123");
    });

    it("should merge child context with log data", async () => {
      const child = logger.child({ requestId: "req-123" });

      child.info("Child message", { userId: "user-456" });
      await child.flush();

      const loggedMessage = getLoggedMessage(infoSpy);
      const parsed = JSON.parse(loggedMessage);

      expect(parsed.requestId).toBe("req-123");
      expect(parsed.userId).toBe("user-456");
    });
  });
});
