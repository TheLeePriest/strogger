import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createConsoleTransport,
  createJsonFormatter,
  getEnvironment,
} from "../src/index";
import { createLogger } from "../src/logger";
import { LogEntry, LogLevel } from "../src/types";

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

  afterEach(() => {
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
      expect(typeof logger.debug).toBe("function");
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.fatal).toBe("function");
    });

    it("should log info messages", async () => {
      await logger.info("Test info message");

      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining("Test info message"),
      );
    });

    it("should log debug messages", async () => {
      await logger.debug("Test debug message");

      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining("Test debug message"),
      );
    });

    it("should log warn messages", async () => {
      await logger.warn("Test warning message");

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Test warning message"),
      );
    });

    it("should log error messages", async () => {
      await logger.error("Test error message");

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Test error message"),
      );
    });

    it("should log fatal messages", async () => {
      await logger.fatal("Test fatal message");

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Test fatal message"),
      );
    });
  });

  describe("context and metadata", () => {
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

    it("should include context in log entries", async () => {
      const context = {
        requestId: "req-123",
        userId: "user-456",
      };

      await logger.info("Message with context", context);

      const loggedMessage = getLoggedMessage(infoSpy);
      const parsed = JSON.parse(loggedMessage);

      expect(parsed.requestId).toBe("req-123");
      expect(parsed.userId).toBe("user-456");
    });

    it("should include metadata in log entries", async () => {
      const context = { requestId: "req-123" };
      const metadata = {
        operation: "test",
        duration: 150,
      };

      await logger.info("Message with metadata", context, metadata);

      const loggedMessage = getLoggedMessage(infoSpy);
      const parsed = JSON.parse(loggedMessage);

      expect(parsed.requestId).toBe("req-123");
      expect(parsed.metadata.operation).toBe("test");
      expect(parsed.metadata.duration).toBe(150);
    });

    it("should handle error objects", async () => {
      const error = new Error("Test error");
      const context = { requestId: "req-123" };

      await logger.error("Error occurred", context, error);

      const loggedMessage = getLoggedMessage(errorSpy);
      const parsed = JSON.parse(loggedMessage);

      expect(parsed.error.name).toBe("Error");
      expect(parsed.error.message).toBe("Test error");
      expect(parsed.error.stack).toBe(error.stack);
    });

    it("should handle error with metadata", async () => {
      const error = new Error("Test error");
      const context = { requestId: "req-123" };
      const metadata = { severity: "high" };

      await logger.error("Error occurred", context, error, metadata);

      const loggedMessage = getLoggedMessage(errorSpy);
      const parsed = JSON.parse(loggedMessage);

      expect(parsed.error.name).toBe("Error");
      expect(parsed.error.message).toBe("Test error");
      expect(parsed.metadata.severity).toBe("high");
    });
  });

  describe("convenience methods", () => {
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

    it("should log function start", async () => {
      const context = { requestId: "req-123" };

      await logger.logFunctionStart("testFunction", context);

      const loggedMessage = getLoggedMessage(infoSpy);
      const parsed = JSON.parse(loggedMessage);

      expect(parsed.message).toBe("Function testFunction started");
      expect(parsed.functionName).toBe("testFunction");
      expect(parsed.requestId).toBe("req-123");
    });

    it("should log function end", async () => {
      const context = { requestId: "req-123" };

      await logger.logFunctionEnd("testFunction", 150, context);

      const loggedMessage = getLoggedMessage(infoSpy);
      const parsed = JSON.parse(loggedMessage);

      expect(parsed.message).toBe("Function testFunction completed in 150ms");
      expect(parsed.functionName).toBe("testFunction");
      expect(parsed.duration).toBe(150);
      expect(parsed.requestId).toBe("req-123");
    });

    it("should log database operations", async () => {
      const context = { requestId: "req-123" };

      await logger.logDatabaseOperation("SELECT", "users", context);

      const loggedMessage = getLoggedMessage(debugSpy);
      const parsed = JSON.parse(loggedMessage);

      expect(parsed.message).toBe("Database operation: SELECT on table users");
      expect(parsed.operation).toBe("SELECT");
      expect(parsed.table).toBe("users");
      expect(parsed.requestId).toBe("req-123");
    });

    it("should log API requests", async () => {
      const context = { requestId: "req-123" };

      await logger.logApiRequest("POST", "/api/users", 201, context);

      const loggedMessage = getLoggedMessage(infoSpy);
      const parsed = JSON.parse(loggedMessage);

      expect(parsed.message).toBe("API POST /api/users - 201");
      expect(parsed.method).toBe("POST");
      expect(parsed.path).toBe("/api/users");
      expect(parsed.statusCode).toBe(201);
      expect(parsed.requestId).toBe("req-123");
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

    it("should allow setting log level", () => {
      expect(logger.getLevel()).toBe(LogLevel.DEBUG);
      logger.setLevel(LogLevel.DEBUG);
      expect(logger.getLevel()).toBe(LogLevel.DEBUG);
      logger.setLevel(LogLevel.ERROR);
      expect(logger.getLevel()).toBe(LogLevel.ERROR);
    });

    it("should filter logs based on level", async () => {
      logger.setLevel(LogLevel.WARN);

      await logger.debug("Debug message");
      await logger.info("Info message");
      await logger.warn("Warning message");

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
      await logger.warn("Test warning");

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Test warning"),
      );
    });

    it("should respect individual transport levels", async () => {
      await logger.info("Test info");

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

      await logger.info("Test message");

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

      await logger.info("Test message");

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

      await logger.info("Test message");

      const loggedMessage = getLoggedMessage(infoSpy);
      const parsed = JSON.parse(loggedMessage);

      expect(parsed.timestamp).toBeDefined();
      expect(new Date(parsed.timestamp)).toBeInstanceOf(Date);
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
      await logger.info("Test message");

      // Should log transport error to console (Error object)
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Transport failed"),
        }),
      );

      // Should still log to working transport
      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining("Test message"),
      );
    });
  });
});
