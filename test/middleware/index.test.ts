import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRequestLogger,
  createTimingMiddleware,
  attachLogger,
} from "../../src/middleware";
import { logger } from "../../src/logger";
import type { Logger } from "../../src/types";

// Mock request/response objects
const createMockRequest = (overrides: Record<string, unknown> = {}) => ({
  method: "GET",
  url: "/api/users",
  path: "/api/users",
  originalUrl: "/api/users",
  headers: {},
  ...overrides,
});

const createMockResponse = () => {
  const listeners: Record<string, Array<() => void>> = {};
  return {
    statusCode: 200,
    on: (event: string, callback: () => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(callback);
    },
    once: (event: string, callback: () => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(callback);
    },
    emit: (event: string) => {
      listeners[event]?.forEach((cb) => cb());
    },
  };
};

describe("middleware", () => {
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

  describe("createRequestLogger", () => {
    it("should create middleware function", () => {
      currentLogger = logger({ serviceName: "test" });
      const middleware = createRequestLogger({ logger: currentLogger });
      expect(typeof middleware).toBe("function");
    });

    it("should log request start and end", async () => {
      currentLogger = logger({ serviceName: "test", pretty: false });
      const middleware = createRequestLogger({
        logger: currentLogger,
        startLevel: "info",
        endLevel: "info",
      });

      const req = createMockRequest();
      const res = createMockResponse();
      let nextCalled = false;

      middleware(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);

      // Flush to ensure start log is processed
      await currentLogger.flush();
      expect(infoSpy).toHaveBeenCalledTimes(1); // Start log

      // Simulate response finish
      res.emit("finish");

      // Wait for async operations and flush
      await new Promise((resolve) => setTimeout(resolve, 10));
      await currentLogger.flush();

      expect(infoSpy).toHaveBeenCalledTimes(2); // Start + end log
    });

    it("should skip logging when skip function returns true", async () => {
      currentLogger = logger({ serviceName: "test" });
      const middleware = createRequestLogger({
        logger: currentLogger,
        skip: (req) => req.path === "/health",
      });

      const req = createMockRequest({ path: "/health", url: "/health" });
      const res = createMockResponse();
      let nextCalled = false;

      middleware(req, res, () => {
        nextCalled = true;
      });

      await currentLogger.flush();

      expect(nextCalled).toBe(true);
      expect(infoSpy).not.toHaveBeenCalled();
      expect(debugSpy).not.toHaveBeenCalled();
    });

    it("should extract custom context", async () => {
      currentLogger = logger({ serviceName: "test", pretty: false });
      const middleware = createRequestLogger({
        logger: currentLogger,
        startLevel: "info",
        getContext: () => ({
          customField: "custom-value",
        }),
      });

      const req = createMockRequest();
      const res = createMockResponse();

      middleware(req, res, () => {});
      await currentLogger.flush();

      const loggedMessage = infoSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(loggedMessage);
      expect(parsed.customField).toBe("custom-value");
    });

    it("should include timing when enabled", async () => {
      currentLogger = logger({ serviceName: "test", pretty: false });
      const middleware = createRequestLogger({
        logger: currentLogger,
        timing: true,
        startLevel: "info",
        endLevel: "info",
      });

      const req = createMockRequest();
      const res = createMockResponse();

      middleware(req, res, () => {});
      await currentLogger.flush();

      // Add small delay to have measurable duration
      await new Promise((resolve) => setTimeout(resolve, 5));

      res.emit("finish");
      await new Promise((resolve) => setTimeout(resolve, 10));
      await currentLogger.flush();

      // Should have at least 2 info calls (start and end)
      expect(infoSpy.mock.calls.length).toBeGreaterThanOrEqual(2);

      // Check the end log (last call should have duration)
      const lastCallIndex = infoSpy.mock.calls.length - 1;
      const endLogMessage = infoSpy.mock.calls[lastCallIndex][0] as string;
      const parsed = JSON.parse(endLogMessage);
      expect(parsed.duration).toBeDefined();
      expect(typeof parsed.duration).toBe("number");
    });

    it("should include request ID from headers", async () => {
      currentLogger = logger({ serviceName: "test", pretty: false });
      const middleware = createRequestLogger({
        logger: currentLogger,
        startLevel: "info",
      });

      const req = createMockRequest({
        headers: { "x-request-id": "req-from-header" },
      });
      const res = createMockResponse();

      middleware(req, res, () => {});
      await currentLogger.flush();

      const loggedMessage = infoSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(loggedMessage);
      expect(parsed.requestId).toBe("req-from-header");
    });
  });

  describe("createTimingMiddleware", () => {
    it("should create middleware function", () => {
      currentLogger = logger({ serviceName: "test" });
      const middleware = createTimingMiddleware({ logger: currentLogger });
      expect(typeof middleware).toBe("function");
    });

    it("should warn for slow requests", async () => {
      currentLogger = logger({ serviceName: "test", pretty: false });
      const middleware = createTimingMiddleware({
        logger: currentLogger,
        warnThreshold: 1, // 1ms threshold to trigger warning
      });

      const req = createMockRequest();
      const res = createMockResponse();

      middleware(req, res, () => {});

      // Add delay to exceed threshold
      await new Promise((resolve) => setTimeout(resolve, 10));

      res.emit("finish");
      await new Promise((resolve) => setTimeout(resolve, 10));
      await currentLogger.flush();

      expect(warnSpy).toHaveBeenCalled();
      const loggedMessage = warnSpy.mock.calls[0][0] as string;
      expect(loggedMessage).toContain("Slow");
    });

    it("should not warn for fast requests", async () => {
      currentLogger = logger({ serviceName: "test" });
      const middleware = createTimingMiddleware({
        logger: currentLogger,
        warnThreshold: 10000, // High threshold
      });

      const req = createMockRequest();
      const res = createMockResponse();

      middleware(req, res, () => {});
      res.emit("finish");

      await new Promise((resolve) => setTimeout(resolve, 10));
      await currentLogger.flush();

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("should skip when skip function returns true", async () => {
      currentLogger = logger({ serviceName: "test" });
      const middleware = createTimingMiddleware({
        logger: currentLogger,
        warnThreshold: 1,
        skip: () => true,
      });

      const req = createMockRequest();
      const res = createMockResponse();
      let nextCalled = false;

      middleware(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
    });
  });

  describe("attachLogger", () => {
    it("should attach child logger to request", () => {
      currentLogger = logger({ serviceName: "test" });
      const middleware = attachLogger({ logger: currentLogger });

      const req = createMockRequest() as Record<string, unknown>;
      const res = createMockResponse();
      let nextCalled = false;

      middleware(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
      expect(req.log).toBeDefined();
      expect(typeof (req.log as Logger).info).toBe("function");
    });

    it("should use custom property name", () => {
      currentLogger = logger({ serviceName: "test" });
      const middleware = attachLogger({
        logger: currentLogger,
        property: "logger",
      });

      const req = createMockRequest() as Record<string, unknown>;
      const res = createMockResponse();

      middleware(req, res, () => {});

      expect(req.logger).toBeDefined();
      expect(req.log).toBeUndefined();
    });

    it("should include custom context in child logger", async () => {
      currentLogger = logger({ serviceName: "test", pretty: false });
      const middleware = attachLogger({
        logger: currentLogger,
        getContext: () => ({
          userId: "user-123",
        }),
      });

      const req = createMockRequest() as Record<string, unknown>;
      const res = createMockResponse();

      middleware(req, res, () => {});

      const reqLogger = req.log as Logger;
      reqLogger.info("Test message");
      await reqLogger.flush();

      const loggedMessage = infoSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(loggedMessage);
      expect(parsed.userId).toBe("user-123");
    });

    it("should include request ID from headers", async () => {
      currentLogger = logger({ serviceName: "test", pretty: false });
      const middleware = attachLogger({ logger: currentLogger });

      const req = createMockRequest({
        headers: { "x-request-id": "req-header-123" },
      }) as Record<string, unknown>;
      const res = createMockResponse();

      middleware(req, res, () => {});

      const reqLogger = req.log as Logger;
      reqLogger.info("Test message");
      await reqLogger.flush();

      const loggedMessage = infoSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(loggedMessage);
      expect(parsed.requestId).toBe("req-header-123");
    });
  });
});
