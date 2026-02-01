import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger, strogger, createLogger } from "../src/logger";
import { LogLevel } from "../src/types";
import { runWithContext } from "../src/utils/context";

describe("simplified logger API", () => {
  let debugSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("logger() function", () => {
    it("should create a logger with no options", () => {
      const log = logger();
      expect(log).toBeDefined();
      expect(typeof log.info).toBe("function");
      expect(typeof log.debug).toBe("function");
      expect(typeof log.warn).toBe("function");
      expect(typeof log.error).toBe("function");
      expect(typeof log.fatal).toBe("function");
      expect(typeof log.child).toBe("function");
    });

    it("should create a logger with serviceName", () => {
      const log = logger({ serviceName: "test-service" });
      expect(log).toBeDefined();
    });

    it("should log messages", async () => {
      const log = logger({ serviceName: "test-service" });
      await log.info("Test message");
      expect(infoSpy).toHaveBeenCalled();
    });

    it("should respect level option", async () => {
      const log = logger({ level: LogLevel.ERROR });
      await log.info("Should not appear");
      await log.error("Should appear");

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
      await strogger.info("Default logger message");
      expect(infoSpy).toHaveBeenCalled();
    });
  });

  describe("child() method", () => {
    it("should create a child logger with additional context", async () => {
      const log = logger({ serviceName: "test-service", pretty: false });
      const childLog = log.child({ requestId: "req-123" });

      await childLog.info("Child message");

      const loggedMessage = infoSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(loggedMessage);
      expect(parsed.requestId).toBe("req-123");
    });

    it("should inherit parent context", async () => {
      const log = logger({ serviceName: "test-service", pretty: false });
      const child1 = log.child({ requestId: "req-123" });
      const child2 = child1.child({ userId: "user-456" });

      await child2.info("Nested child message");

      const loggedMessage = infoSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(loggedMessage);
      expect(parsed.requestId).toBe("req-123");
      expect(parsed.userId).toBe("user-456");
    });

    it("should not affect parent logger", async () => {
      const log = logger({ serviceName: "test-service", pretty: false });
      const childLog = log.child({ requestId: "req-123" });

      await log.info("Parent message");

      const loggedMessage = infoSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(loggedMessage);
      expect(parsed.requestId).toBeUndefined();
    });

    it("should allow child to override parent context", async () => {
      const log = logger({ serviceName: "test-service", pretty: false });
      const child1 = log.child({ userId: "user-1" });
      const child2 = child1.child({ userId: "user-2" });

      await child2.info("Message");

      const loggedMessage = infoSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(loggedMessage);
      expect(parsed.userId).toBe("user-2");
    });
  });

  describe("AsyncLocalStorage context integration", () => {
    it("should include context from runWithContext", async () => {
      const log = logger({ serviceName: "test-service", pretty: false });

      await runWithContext({ correlationId: "corr-123" }, async () => {
        await log.info("Message in context");
      });

      const loggedMessage = infoSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(loggedMessage);
      expect(parsed.correlationId).toBe("corr-123");
    });

    it("should merge AsyncLocalStorage context with child context", async () => {
      const log = logger({ serviceName: "test-service", pretty: false });
      const childLog = log.child({ requestId: "req-123" });

      await runWithContext({ correlationId: "corr-123" }, async () => {
        await childLog.info("Message");
      });

      const loggedMessage = infoSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(loggedMessage);
      expect(parsed.correlationId).toBe("corr-123");
      expect(parsed.requestId).toBe("req-123");
    });

    it("should prioritize child context over AsyncLocalStorage", async () => {
      const log = logger({ serviceName: "test-service", pretty: false });
      const childLog = log.child({ userId: "child-user" });

      await runWithContext({ userId: "als-user" }, async () => {
        await childLog.info("Message");
      });

      const loggedMessage = infoSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(loggedMessage);
      expect(parsed.userId).toBe("child-user");
    });
  });

  describe("error serialization", () => {
    it("should serialize error with code", async () => {
      const log = logger({ serviceName: "test-service", pretty: false });
      const error = new Error("File not found") as Error & { code: string };
      error.code = "ENOENT";

      await log.error("Operation failed", {}, error);

      const loggedMessage = errorSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(loggedMessage);
      expect(parsed.error.code).toBe("ENOENT");
    });

    it("should serialize error with statusCode", async () => {
      const log = logger({ serviceName: "test-service", pretty: false });
      const error = new Error("Not found") as Error & { statusCode: number };
      error.statusCode = 404;

      await log.error("HTTP error", {}, error);

      const loggedMessage = errorSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(loggedMessage);
      expect(parsed.error.statusCode).toBe(404);
    });

    it("should serialize error with cause chain", async () => {
      const log = logger({ serviceName: "test-service", pretty: false });
      const rootCause = new Error("Database connection failed");
      const error = new Error("Query failed", { cause: rootCause });

      await log.error("Operation failed", {}, error);

      const loggedMessage = errorSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(loggedMessage);
      expect(parsed.error.cause).toBeDefined();
      expect(parsed.error.cause.message).toBe("Database connection failed");
    });
  });
});
