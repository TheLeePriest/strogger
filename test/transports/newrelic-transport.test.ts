import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNewRelicTransport } from "../../src/transports/newrelic-transport";
import { type LogEntry, LogLevel } from "../../src/types";

// Mock fetch globally
global.fetch = vi.fn();

describe("createNewRelicTransport", () => {
  let transport: ReturnType<typeof createNewRelicTransport>;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Set up environment variables
    process.env.NEW_RELIC_LICENSE_KEY = "test-license-key";
    process.env.NEW_RELIC_ACCOUNT_ID = "test-account-id";
  });

  afterEach(() => {
    vi.clearAllMocks();
    process.env.NEW_RELIC_LICENSE_KEY = undefined;
    process.env.NEW_RELIC_ACCOUNT_ID = undefined;
  });

  describe("default options", () => {
    beforeEach(() => {
      transport = createNewRelicTransport();
    });

    it("should create transport with default options", () => {
      expect(transport).toHaveProperty("log");
      expect(transport).toHaveProperty("setLevel");
      expect(transport).toHaveProperty("getLevel");
      expect(typeof transport.log).toBe("function");
      expect(typeof transport.setLevel).toBe("function");
      expect(typeof transport.getLevel).toBe("function");
    });

    it("should have INFO as default level", () => {
      expect(transport.getLevel()).toBe(LogLevel.INFO);
    });
  });

  describe("API calls", () => {
    beforeEach(() => {
      transport = createNewRelicTransport();
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });
    });

    it("should make API call to New Relic with correct format", async () => {
      const entry: LogEntry = {
        timestamp: "2024-01-15T10:30:00.000Z",
        level: LogLevel.INFO,
        message: "Test message",
        context: {
          requestId: "req-123",
          userId: "user-456",
        },
        metadata: {
          operation: "test",
          duration: 150,
        },
      };

      await transport.log(entry);
      await transport.flush(); // Force flush to send the batch

      expect(mockFetch).toHaveBeenCalledWith(
        "https://log-api.us.newrelic.com/log/v1",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Api-Key": "test-license-key",
            "X-License-Key": "test-license-key",
          },
        }),
      );
    });

    it("should handle entry without context and metadata", async () => {
      const entry: LogEntry = {
        timestamp: "2024-01-15T10:30:00.000Z",
        level: LogLevel.INFO,
        message: "Simple message",
      };

      await transport.log(entry);
      await transport.flush(); // Force flush to send the batch

      expect(mockFetch).toHaveBeenCalledWith(
        "https://log-api.us.newrelic.com/log/v1",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Api-Key": "test-license-key",
            "X-License-Key": "test-license-key",
          },
        }),
      );
    });

    it("should handle entry with error", async () => {
      const error = new Error("Test error");
      const entry: LogEntry = {
        timestamp: "2024-01-15T10:30:00.000Z",
        level: LogLevel.ERROR,
        message: "Error occurred",
        error,
        context: {
          requestId: "req-123",
        },
      };

      await transport.log(entry);
      await transport.flush(); // Force flush to send the batch

      expect(mockFetch).toHaveBeenCalledWith(
        "https://log-api.us.newrelic.com/log/v1",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Api-Key": "test-license-key",
            "X-License-Key": "test-license-key",
          },
          body: expect.stringContaining("Error occurred"),
        }),
      );
    });
  });

  describe("log level filtering", () => {
    it("should not log entries below the set level", async () => {
      transport = createNewRelicTransport({ level: LogLevel.WARN });

      const debugEntry: LogEntry = {
        timestamp: "2024-01-15T10:30:00.000Z",
        level: LogLevel.DEBUG,
        message: "Debug message",
      };

      await transport.log(debugEntry);
      await transport.flush();

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should log entries at or above the set level", async () => {
      transport = createNewRelicTransport({ level: LogLevel.WARN });

      const warnEntry: LogEntry = {
        timestamp: "2024-01-15T10:30:00.000Z",
        level: LogLevel.WARN,
        message: "Warning message",
      };

      const errorEntry: LogEntry = {
        timestamp: "2024-01-15T10:30:00.000Z",
        level: LogLevel.ERROR,
        message: "Error message",
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      await transport.log(warnEntry);
      await transport.log(errorEntry);
      await transport.flush();

      expect(mockFetch).toHaveBeenCalledTimes(1); // Both entries sent in one batch
    });

    it("should allow changing log level after creation", async () => {
      transport = createNewRelicTransport({ level: LogLevel.ERROR });
      transport.setLevel(LogLevel.DEBUG);

      const debugEntry: LogEntry = {
        timestamp: "2024-01-15T10:30:00.000Z",
        level: LogLevel.DEBUG,
        message: "Debug message",
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      await transport.log(debugEntry);
      await transport.flush();

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      transport = createNewRelicTransport();
    });

    it("should handle API errors gracefully", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mockFetch.mockRejectedValue(new Error("Network error"));

      const entry: LogEntry = {
        timestamp: "2024-01-15T10:30:00.000Z",
        level: LogLevel.INFO,
        message: "Test message",
      };

      await transport.log(entry);
      await transport.flush();

      expect(consoleSpy).toHaveBeenCalledWith(
        "[LOGGER ERROR] Unexpected error in New Relic: Network error",
      );

      consoleSpy.mockRestore();
    });

    it("should handle HTTP error responses", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Set up environment variables for the transport
      process.env.NEW_RELIC_LICENSE_KEY = "test-key";
      process.env.NEW_RELIC_ACCOUNT_ID = "test-account";

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: async () => "Unauthorized access",
      });

      const entry: LogEntry = {
        timestamp: "2024-01-15T10:30:00.000Z",
        level: LogLevel.INFO,
        message: "Test message",
      };

      await transport.log(entry);
      await transport.flush();

      expect(consoleSpy).toHaveBeenCalledWith(
        "[LOGGER ERROR] Failed to send logs to New Relic API (New Relic)",
      );

      consoleSpy.mockRestore();
    });

    it("should continue logging even after API errors", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // First call fails
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      const entry1: LogEntry = {
        timestamp: "2024-01-15T10:30:00.000Z",
        level: LogLevel.INFO,
        message: "First message",
      };

      const entry2: LogEntry = {
        timestamp: "2024-01-15T10:30:00.000Z",
        level: LogLevel.INFO,
        message: "Second message",
      };

      await transport.log(entry1);
      await transport.log(entry2);
      await transport.flush();

      expect(mockFetch).toHaveBeenCalledTimes(1); // Both entries sent in one batch
      expect(consoleSpy).toHaveBeenCalledTimes(1);

      consoleSpy.mockRestore();
    });
  });

  describe("custom options", () => {
    it("should use custom API key when provided", async () => {
      transport = createNewRelicTransport({
        apiKey: "custom-api-key",
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      const entry: LogEntry = {
        timestamp: "2024-01-15T10:30:00.000Z",
        level: LogLevel.INFO,
        message: "Test message",
      };

      await transport.log(entry);
      await transport.flush();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://log-api.us.newrelic.com/log/v1",
        expect.objectContaining({
          headers: {
            "Content-Type": "application/json",
            "Api-Key": "custom-api-key",
            "X-License-Key": "custom-api-key",
          },
        }),
      );
    });

    it("should use custom account ID when provided", async () => {
      transport = createNewRelicTransport({
        accountId: "custom-account-id",
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      const entry: LogEntry = {
        timestamp: "2024-01-15T10:30:00.000Z",
        level: LogLevel.INFO,
        message: "Test message",
      };

      await transport.log(entry);
      await transport.flush();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://log-api.us.newrelic.com/log/v1",
        expect.objectContaining({
          headers: {
            "Content-Type": "application/json",
            "Api-Key": "test-license-key",
            "X-License-Key": "test-license-key",
          },
        }),
      );
    });

    it("should use custom service name when provided", async () => {
      transport = createNewRelicTransport({
        serviceName: "custom-service",
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      const entry: LogEntry = {
        timestamp: "2024-01-15T10:30:00.000Z",
        level: LogLevel.INFO,
        message: "Test message",
      };

      await transport.log(entry);
      await transport.flush();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://log-api.us.newrelic.com/log/v1",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Api-Key": "test-license-key",
            "X-License-Key": "test-license-key",
          },
        }),
      );
    });
  });

  describe("level management", () => {
    beforeEach(() => {
      transport = createNewRelicTransport();
    });

    it("should return current level", () => {
      expect(transport.getLevel()).toBe(LogLevel.INFO);

      transport.setLevel(LogLevel.DEBUG);
      expect(transport.getLevel()).toBe(LogLevel.DEBUG);

      transport.setLevel(LogLevel.ERROR);
      expect(transport.getLevel()).toBe(LogLevel.ERROR);
    });
  });
});
