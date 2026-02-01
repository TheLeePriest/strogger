import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  runWithContext,
  runWithContextAsync,
  getContext,
  setContext,
  clearContextKey,
  generateRequestContext,
  hasAsyncLocalStorage,
} from "../../src/utils/context";

describe("context utilities", () => {
  describe("hasAsyncLocalStorage", () => {
    it("should return a boolean", () => {
      const result = hasAsyncLocalStorage();
      expect(typeof result).toBe("boolean");
    });

    it("should return true in Node.js environment", () => {
      // In Node.js test environment, AsyncLocalStorage should be available
      expect(hasAsyncLocalStorage()).toBe(true);
    });
  });

  describe("getContext", () => {
    it("should return empty object when no context is set", () => {
      const context = getContext();
      expect(context).toEqual({});
    });

    it("should return current context when inside runWithContext", () => {
      runWithContext({ requestId: "req-123" }, () => {
        const context = getContext();
        expect(context.requestId).toBe("req-123");
      });
    });
  });

  describe("runWithContext", () => {
    it("should make context available within callback", () => {
      runWithContext({ userId: "user-456" }, () => {
        expect(getContext().userId).toBe("user-456");
      });
    });

    it("should merge with existing context", () => {
      runWithContext({ requestId: "req-123" }, () => {
        runWithContext({ userId: "user-456" }, () => {
          const context = getContext();
          expect(context.requestId).toBe("req-123");
          expect(context.userId).toBe("user-456");
        });
      });
    });

    it("should isolate context between separate runs", () => {
      runWithContext({ requestId: "req-1" }, () => {
        expect(getContext().requestId).toBe("req-1");
      });

      runWithContext({ requestId: "req-2" }, () => {
        expect(getContext().requestId).toBe("req-2");
      });
    });

    it("should return the callback result", () => {
      const result = runWithContext({ requestId: "req-123" }, () => {
        return "result-value";
      });
      expect(result).toBe("result-value");
    });

    it("should restore context after callback completes", () => {
      runWithContext({ outer: "outer-value" }, () => {
        runWithContext({ inner: "inner-value" }, () => {
          expect(getContext().inner).toBe("inner-value");
        });
        // Inner context should be gone
        expect(getContext().inner).toBeUndefined();
        expect(getContext().outer).toBe("outer-value");
      });
    });
  });

  describe("runWithContextAsync", () => {
    it("should work with async functions", async () => {
      await runWithContextAsync({ requestId: "async-req" }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        expect(getContext().requestId).toBe("async-req");
      });
    });

    it("should propagate context through async operations", async () => {
      await runWithContextAsync({ requestId: "async-req" }, async () => {
        const result = await Promise.resolve().then(() => {
          return getContext().requestId;
        });
        expect(result).toBe("async-req");
      });
    });

    it("should return async callback result", async () => {
      const result = await runWithContextAsync({ requestId: "req" }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return "async-result";
      });
      expect(result).toBe("async-result");
    });
  });

  describe("setContext", () => {
    it("should merge values into current context", () => {
      runWithContext({ requestId: "req-123" }, () => {
        setContext({ userId: "user-456" });
        const context = getContext();
        expect(context.requestId).toBe("req-123");
        expect(context.userId).toBe("user-456");
      });
    });

    it("should overwrite existing values", () => {
      runWithContext({ requestId: "req-123" }, () => {
        setContext({ requestId: "req-456" });
        expect(getContext().requestId).toBe("req-456");
      });
    });

    it("should do nothing when called outside context", () => {
      // Should not throw
      setContext({ userId: "user-123" });
      expect(getContext()).toEqual({});
    });
  });

  describe("clearContextKey", () => {
    it("should remove a specific key from context", () => {
      runWithContext({ requestId: "req-123", userId: "user-456" }, () => {
        clearContextKey("userId");
        const context = getContext();
        expect(context.requestId).toBe("req-123");
        expect(context.userId).toBeUndefined();
      });
    });

    it("should do nothing for non-existent keys", () => {
      runWithContext({ requestId: "req-123" }, () => {
        clearContextKey("nonExistent" as keyof typeof getContext);
        expect(getContext().requestId).toBe("req-123");
      });
    });

    it("should do nothing when called outside context", () => {
      // Should not throw
      clearContextKey("requestId");
    });
  });

  describe("generateRequestContext", () => {
    it("should generate correlationId", () => {
      const context = generateRequestContext();
      expect(context.correlationId).toBeDefined();
      expect(typeof context.correlationId).toBe("string");
      expect(context.correlationId).toMatch(/^req_\d+_[a-z0-9]+$/);
    });

    it("should generate traceId", () => {
      const context = generateRequestContext();
      expect(context.traceId).toBeDefined();
      expect(typeof context.traceId).toBe("string");
    });

    it("should generate spanId", () => {
      const context = generateRequestContext();
      expect(context.spanId).toBeDefined();
      expect(typeof context.spanId).toBe("string");
    });

    it("should generate unique values on each call", () => {
      const context1 = generateRequestContext();
      const context2 = generateRequestContext();

      expect(context1.correlationId).not.toBe(context2.correlationId);
      expect(context1.traceId).not.toBe(context2.traceId);
      expect(context1.spanId).not.toBe(context2.spanId);
    });
  });
});
