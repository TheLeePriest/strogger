import { describe, expect, it } from "vitest";
import { createJsonFormatter } from "../../src/formatters/json-formatter";
import { LogLevel } from "../../src/types";

describe("createJsonFormatter", () => {
  const formatter = createJsonFormatter();

  it("should create a formatter with format method", () => {
    expect(formatter).toHaveProperty("format");
    expect(typeof formatter.format).toBe("function");
  });

  it("should format basic log entry correctly", () => {
    const entry = {
      timestamp: "2024-01-15T10:30:00.000Z",
      level: LogLevel.INFO,
      message: "Test message",
    };

    const formatted = formatter.format(entry);
    const parsed = JSON.parse(formatted);

    expect(parsed.timestamp).toBe("2024-01-15T10:30:00.000Z");
    expect(parsed.level).toBe("INFO");
    expect(parsed.message).toBe("Test message");
  });

  it("should format log entry with context", () => {
    const entry = {
      timestamp: "2024-01-15T10:30:00.000Z",
      level: LogLevel.INFO,
      message: "Test message",
      context: {
        requestId: "req-123",
        userId: "user-456",
      },
    };

    const formatted = formatter.format(entry);
    const parsed = JSON.parse(formatted);

    expect(parsed.timestamp).toBe("2024-01-15T10:30:00.000Z");
    expect(parsed.level).toBe("INFO");
    expect(parsed.message).toBe("Test message");
    expect(parsed.requestId).toBe("req-123");
    expect(parsed.userId).toBe("user-456");
  });

  it("should format log entry with error", () => {
    const error = new Error("Test error");
    error.stack = "Error: Test error\n    at test.js:1:1";

    const entry = {
      timestamp: "2024-01-15T10:30:00.000Z",
      level: LogLevel.ERROR,
      message: "Error occurred",
      error,
    };

    const formatted = formatter.format(entry);
    const parsed = JSON.parse(formatted);

    expect(parsed.timestamp).toBe("2024-01-15T10:30:00.000Z");
    expect(parsed.level).toBe("ERROR");
    expect(parsed.message).toBe("Error occurred");
    expect(parsed.error).toEqual({
      name: "Error",
      message: "Test error",
      stack: "Error: Test error\n    at test.js:1:1",
    });
  });

  it("should format log entry with metadata", () => {
    const entry = {
      timestamp: "2024-01-15T10:30:00.000Z",
      level: LogLevel.DEBUG,
      message: "Debug message",
      metadata: {
        operation: "database-query",
        duration: 150,
        table: "users",
      },
    };

    const formatted = formatter.format(entry);
    const parsed = JSON.parse(formatted);

    expect(parsed.timestamp).toBe("2024-01-15T10:30:00.000Z");
    expect(parsed.level).toBe("DEBUG");
    expect(parsed.message).toBe("Debug message");
    expect(parsed.metadata).toEqual({
      operation: "database-query",
      duration: 150,
      table: "users",
    });
  });

  it("should format complete log entry with all fields", () => {
    const error = new Error("Complete error");
    const entry = {
      timestamp: "2024-01-15T10:30:00.000Z",
      level: LogLevel.WARN,
      message: "Complete message",
      context: {
        requestId: "req-123",
        functionName: "processOrder",
      },
      error,
      metadata: {
        orderId: "order-456",
        amount: 99.99,
      },
    };

    const formatted = formatter.format(entry);
    const parsed = JSON.parse(formatted);

    expect(parsed.timestamp).toBe("2024-01-15T10:30:00.000Z");
    expect(parsed.level).toBe("WARN");
    expect(parsed.message).toBe("Complete message");
    expect(parsed.requestId).toBe("req-123");
    expect(parsed.functionName).toBe("processOrder");
    expect(parsed.error).toEqual({
      name: "Error",
      message: "Complete error",
      stack: error.stack,
    });
    expect(parsed.metadata).toEqual({
      orderId: "order-456",
      amount: 99.99,
    });
  });

  it("should handle all log levels correctly", () => {
    const levels = [
      { level: LogLevel.DEBUG, name: "DEBUG" },
      { level: LogLevel.INFO, name: "INFO" },
      { level: LogLevel.WARN, name: "WARN" },
      { level: LogLevel.ERROR, name: "ERROR" },
      { level: LogLevel.FATAL, name: "FATAL" },
    ];

    for (const { level, name } of levels) {
      const entry = {
        timestamp: "2024-01-15T10:30:00.000Z",
        level,
        message: `Test ${name} message`,
      };

      const formatted = formatter.format(entry);
      const parsed = JSON.parse(formatted);

      expect(parsed.level).toBe(name);
      expect(parsed.message).toBe(`Test ${name} message`);
    }
  });

  it("should handle unknown log level", () => {
    const entry = {
      timestamp: "2024-01-15T10:30:00.000Z",
      level: 999 as LogLevel, // Unknown level
      message: "Unknown level message",
    };

    const formatted = formatter.format(entry);
    const parsed = JSON.parse(formatted);

    expect(parsed.level).toBe("UNKNOWN");
    expect(parsed.message).toBe("Unknown level message");
  });

  it("should handle entry without optional fields", () => {
    const entry = {
      timestamp: "2024-01-15T10:30:00.000Z",
      level: LogLevel.INFO,
      message: "Simple message",
    };

    const formatted = formatter.format(entry);
    const parsed = JSON.parse(formatted);

    expect(parsed).toEqual({
      timestamp: "2024-01-15T10:30:00.000Z",
      level: "INFO",
      message: "Simple message",
    });
  });

  it("should handle null and undefined values in context", () => {
    const entry = {
      timestamp: "2024-01-15T10:30:00.000Z",
      level: LogLevel.INFO,
      message: "Message with null values",
      context: {
        nullValue: null,
        undefinedValue: undefined,
        stringValue: "test",
      },
    };

    const formatted = formatter.format(entry);
    const parsed = JSON.parse(formatted);

    expect(parsed.nullValue).toBeNull();
    expect(parsed.undefinedValue).toBeUndefined();
    expect(parsed.stringValue).toBe("test");
  });

  it("should produce valid JSON", () => {
    const entry = {
      timestamp: "2024-01-15T10:30:00.000Z",
      level: LogLevel.INFO,
      message: "Valid JSON test",
      context: {
        nested: {
          object: {
            with: "values",
          },
        },
      },
    };

    const formatted = formatter.format(entry);

    // Should not throw when parsing
    expect(() => JSON.parse(formatted)).not.toThrow();

    const parsed = JSON.parse(formatted);
    expect(parsed.nested.object.with).toBe("values");
  });
});
