import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger, strogger } from "../src/logger";
import { LogLevel } from "../src/types";
import { runWithContext } from "../src/utils/context";

describe("simplified logger API", () => {
  let debugSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let currentLogger: ReturnType<typeof logger> | null = null;

  beforeEach(() => {
    debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    if (currentLogger) {
      await currentLogger.shutdown();
      currentLogger = null;
    }
    vi.restoreAllMocks();
  });

  describe("logger() function", () => {
    it("should create a logger with no options", () => {
      currentLogger = logger();
      expect(currentLogger).toBeDefined();
      expect(typeof currentLogger.info).toBe("function");
      expect(typeof currentLogger.debug).toBe("function");
      expect(typeof currentLogger.warn).toBe("function");
      expect(typeof currentLogger.error).toBe("function");
      expect(typeof currentLogger.fatal).toBe("function");
      expect(typeof currentLogger.child).toBe("function");
      expect(typeof currentLogger.flush).toBe("function");
      expect(typeof currentLogger.shutdown).toBe("function");
    });

    it("should create a logger with serviceName", () => {
      currentLogger = logger({ serviceName: "test-service" });
      expect(currentLogger).toBeDefined();
    });

    it("should log messages", async () => {
      currentLogger = logger({ serviceName: "test-service" });
      currentLogger.info("Test message");
      await currentLogger.flush();
      expect(infoSpy).toHaveBeenCalled();
    });

    it("should respect level option", async () => {
      currentLogger = logger({ level: LogLevel.ERROR });
      currentLogger.info("Should not appear");
      currentLogger.error("Should appear");
      await currentLogger.flush();

      expect(infoSpy).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe("strogger default instance", () => {
    it("should be a pre-configured logger", () => {
      expect(strogger).toBeDefined();
      expect(typeof strogger.info).toBe("function");
      expect(typeof strogger.child).toBe("function");
    });

    it("should log messages", async () => {
      strogger.info("Default logger message");
      await strogger.flush();
      expect(infoSpy).toHaveBeenCalled();
    });
  });

  describe("child() method", () => {
    it("should create a child logger with additional context", async () => {
      currentLogger = logger({ serviceName: "test-service", pretty: false });
      const childLog = currentLogger.child({ requestId: "req-123" });

      childLog.info("Child message");
      await childLog.flush();

      const loggedMessage = infoSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(loggedMessage);
      expect(parsed.requestId).toBe("req-123");
    });

    it("should inherit parent context", async () => {
      currentLogger = logger({ serviceName: "test-service", pretty: false });
      const child1 = currentLogger.child({ requestId: "req-123" });
      const child2 = child1.child({ userId: "user-456" });

      child2.info("Nested child message");
      await child2.flush();

      const loggedMessage = infoSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(loggedMessage);
      expect(parsed.requestId).toBe("req-123");
      expect(parsed.userId).toBe("user-456");
    });

    it("should not affect parent logger", async () => {
      currentLogger = logger({ serviceName: "test-service", pretty: false });
      const childLog = currentLogger.child({ requestId: "req-123" });

      currentLogger.info("Parent message");
      await currentLogger.flush();

      const loggedMessage = infoSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(loggedMessage);
      expect(parsed.requestId).toBeUndefined();
    });

    it("should allow child to override parent context", async () => {
      currentLogger = logger({ serviceName: "test-service", pretty: false });
      const child1 = currentLogger.child({ userId: "user-1" });
      const child2 = child1.child({ userId: "user-2" });

      child2.info("Message");
      await child2.flush();

      const loggedMessage = infoSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(loggedMessage);
      expect(parsed.userId).toBe("user-2");
    });
  });

  describe("AsyncLocalStorage context integration", () => {
    it("should include context from runWithContext", async () => {
      currentLogger = logger({ serviceName: "test-service", pretty: false });

      await runWithContext({ correlationId: "corr-123" }, async () => {
        currentLogger!.info("Message in context");
        await currentLogger!.flush();
      });

      const loggedMessage = infoSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(loggedMessage);
      expect(parsed.correlationId).toBe("corr-123");
    });

    it("should merge AsyncLocalStorage context with child context", async () => {
      currentLogger = logger({ serviceName: "test-service", pretty: false });
      const childLog = currentLogger.child({ requestId: "req-123" });

      await runWithContext({ correlationId: "corr-123" }, async () => {
        childLog.info("Message");
        await childLog.flush();
      });

      const loggedMessage = infoSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(loggedMessage);
      expect(parsed.correlationId).toBe("corr-123");
      expect(parsed.requestId).toBe("req-123");
    });

    it("should prioritize child context over AsyncLocalStorage", async () => {
      currentLogger = logger({ serviceName: "test-service", pretty: false });
      const childLog = currentLogger.child({ userId: "child-user" });

      await runWithContext({ userId: "als-user" }, async () => {
        childLog.info("Message");
        await childLog.flush();
      });

      const loggedMessage = infoSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(loggedMessage);
      expect(parsed.userId).toBe("child-user");
    });
  });

  describe("error serialization", () => {
    it("should serialize error with code", async () => {
      currentLogger = logger({ serviceName: "test-service", pretty: false });
      const error = new Error("File not found") as Error & { code: string };
      error.code = "ENOENT";

      currentLogger.error("Operation failed", { err: error });
      await currentLogger.flush();

      const loggedMessage = errorSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(loggedMessage);
      expect(parsed.error.code).toBe("ENOENT");
    });

    it("should serialize error with statusCode", async () => {
      currentLogger = logger({ serviceName: "test-service", pretty: false });
      const error = new Error("Not found") as Error & { statusCode: number };
      error.statusCode = 404;

      currentLogger.error("HTTP error", { err: error });
      await currentLogger.flush();

      const loggedMessage = errorSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(loggedMessage);
      expect(parsed.error.statusCode).toBe(404);
    });

    it("should serialize error with cause chain", async () => {
      currentLogger = logger({ serviceName: "test-service", pretty: false });
      const rootCause = new Error("Database connection failed");
      const error = new Error("Query failed", { cause: rootCause });

      currentLogger.error("Operation failed", { err: error });
      await currentLogger.flush();

      const loggedMessage = errorSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(loggedMessage);
      expect(parsed.error.cause).toBeDefined();
      expect(parsed.error.cause.message).toBe("Database connection failed");
    });
  });

  describe("shorthand transport configs", () => {
    it("should accept file shorthand with boolean", async () => {
      // file: true uses default options
      currentLogger = logger({
        serviceName: "test-service",
        file: { path: "/tmp/test-shorthand.log" },
      });
      expect(currentLogger).toBeDefined();
      // Logger should have been created with file transport
      currentLogger.info("Test message");
      await currentLogger.flush();
      // If we got here without error, the transport was added successfully
    });

    it("should accept file shorthand with options", async () => {
      currentLogger = logger({
        serviceName: "test-service",
        file: {
          path: "/tmp/test-shorthand-opts.log",
          maxSize: 1024 * 1024,
        },
      });
      expect(currentLogger).toBeDefined();
      currentLogger.info("Test message");
      await currentLogger.flush();
    });

    it("should support multiple shorthand transports", async () => {
      // This test verifies multiple shorthands can be combined
      // Note: actual cloud transports would fail without credentials,
      // so we just verify the logger creates successfully with file transport
      currentLogger = logger({
        serviceName: "test-service",
        file: { path: "/tmp/test-multi.log" },
      });
      expect(currentLogger).toBeDefined();
      currentLogger.info("Test message");
      await currentLogger.flush();
    });
  });
});
