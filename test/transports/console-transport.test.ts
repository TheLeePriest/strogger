import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createConsoleTransport } from "../../src/transports/console-transport";
import { type LogEntry, LogLevel } from "../../src/types";

describe("createConsoleTransport", () => {
  let transport: ReturnType<typeof createConsoleTransport>;
  let consoleSpy: {
    debug: ReturnType<typeof vi.spyOn>;
    info: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
      info: vi.spyOn(console, "info").mockImplementation(() => {}),
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("default options", () => {
    beforeEach(() => {
      transport = createConsoleTransport();
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

    it("should log INFO level entries", () => {
      const entry: LogEntry = {
        timestamp: "2024-01-15T10:30:00.000Z",
        level: LogLevel.INFO,
        message: "Test info message",
      };

      transport.log(entry);

      expect(consoleSpy.info).toHaveBeenCalledWith(JSON.stringify(entry));
    });

    it("should not log DEBUG level entries by default", () => {
      const entry: LogEntry = {
        timestamp: "2024-01-15T10:30:00.000Z",
        level: LogLevel.DEBUG,
        message: "Test debug message",
      };

      transport.log(entry);

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.info).not.toHaveBeenCalled();
      expect(consoleSpy.warn).not.toHaveBeenCalled();
      expect(consoleSpy.error).not.toHaveBeenCalled();
    });
  });

  describe("custom formatter", () => {
    it("should use custom formatter when provided", () => {
      const customFormatter = {
        format: vi.fn((entry: LogEntry) => `CUSTOM: ${entry.message}`),
      };

      transport = createConsoleTransport({ formatter: customFormatter });

      const entry: LogEntry = {
        timestamp: "2024-01-15T10:30:00.000Z",
        level: LogLevel.INFO,
        message: "Test message",
      };

      transport.log(entry);

      expect(customFormatter.format).toHaveBeenCalledWith(entry);
      expect(consoleSpy.info).toHaveBeenCalledWith("CUSTOM: Test message");
    });
  });

  describe("log level filtering", () => {
    it("should respect custom log level", () => {
      transport = createConsoleTransport({ level: LogLevel.WARN });

      const debugEntry: LogEntry = {
        timestamp: "2024-01-15T10:30:00.000Z",
        level: LogLevel.DEBUG,
        message: "Debug message",
      };

      const warnEntry: LogEntry = {
        timestamp: "2024-01-15T10:30:00.000Z",
        level: LogLevel.WARN,
        message: "Warning message",
      };

      transport.log(debugEntry);
      transport.log(warnEntry);

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalledWith(JSON.stringify(warnEntry));
    });

    it("should allow changing log level after creation", () => {
      transport = createConsoleTransport({ level: LogLevel.ERROR });
      transport.setLevel(LogLevel.DEBUG);

      const entry: LogEntry = {
        timestamp: "2024-01-15T10:30:00.000Z",
        level: LogLevel.DEBUG,
        message: "Debug message",
      };

      transport.log(entry);

      expect(consoleSpy.debug).toHaveBeenCalledWith(JSON.stringify(entry));
    });
  });

  describe("console method selection", () => {
    beforeEach(() => {
      transport = createConsoleTransport({ level: LogLevel.DEBUG });
    });

    it("should use console.debug for DEBUG level", () => {
      const entry: LogEntry = {
        timestamp: "2024-01-15T10:30:00.000Z",
        level: LogLevel.DEBUG,
        message: "Debug message",
      };

      transport.log(entry);

      expect(consoleSpy.debug).toHaveBeenCalledWith(JSON.stringify(entry));
    });

    it("should use console.info for INFO level", () => {
      const entry: LogEntry = {
        timestamp: "2024-01-15T10:30:00.000Z",
        level: LogLevel.INFO,
        message: "Info message",
      };

      transport.log(entry);

      expect(consoleSpy.info).toHaveBeenCalledWith(JSON.stringify(entry));
    });

    it("should use console.warn for WARN level", () => {
      const entry: LogEntry = {
        timestamp: "2024-01-15T10:30:00.000Z",
        level: LogLevel.WARN,
        message: "Warning message",
      };

      transport.log(entry);

      expect(consoleSpy.warn).toHaveBeenCalledWith(JSON.stringify(entry));
    });

    it("should use console.error for ERROR level", () => {
      const entry: LogEntry = {
        timestamp: "2024-01-15T10:30:00.000Z",
        level: LogLevel.ERROR,
        message: "Error message",
      };

      transport.log(entry);

      expect(consoleSpy.error).toHaveBeenCalledWith(JSON.stringify(entry));
    });

    it("should use console.error for FATAL level", () => {
      const entry: LogEntry = {
        timestamp: "2024-01-15T10:30:00.000Z",
        level: LogLevel.FATAL,
        message: "Fatal message",
      };

      transport.log(entry);

      expect(consoleSpy.error).toHaveBeenCalledWith(JSON.stringify(entry));
    });
  });

  describe("entry formatting", () => {
    beforeEach(() => {
      transport = createConsoleTransport({ level: LogLevel.DEBUG });
    });

    it("should format entry with all fields", () => {
      const error = new Error("Test error");
      const entry: LogEntry = {
        timestamp: "2024-01-15T10:30:00.000Z",
        level: LogLevel.INFO,
        message: "Test message",
        context: {
          requestId: "req-123",
          userId: "user-456",
        },
        error,
        metadata: {
          operation: "test",
          duration: 150,
        },
      };

      transport.log(entry);

      const expectedOutput = JSON.stringify(entry);
      expect(consoleSpy.info).toHaveBeenCalledWith(expectedOutput);
    });

    it("should handle entry without optional fields", () => {
      const entry: LogEntry = {
        timestamp: "2024-01-15T10:30:00.000Z",
        level: LogLevel.INFO,
        message: "Simple message",
      };

      transport.log(entry);

      const expectedOutput = JSON.stringify(entry);
      expect(consoleSpy.info).toHaveBeenCalledWith(expectedOutput);
    });
  });

  describe("level management", () => {
    beforeEach(() => {
      transport = createConsoleTransport();
    });

    it("should return current level", () => {
      expect(transport.getLevel()).toBe(LogLevel.INFO);

      transport.setLevel(LogLevel.DEBUG);
      expect(transport.getLevel()).toBe(LogLevel.DEBUG);

      transport.setLevel(LogLevel.ERROR);
      expect(transport.getLevel()).toBe(LogLevel.ERROR);
    });

    it("should filter entries based on current level", () => {
      transport.setLevel(LogLevel.WARN);

      const debugEntry: LogEntry = {
        timestamp: "2024-01-15T10:30:00.000Z",
        level: LogLevel.DEBUG,
        message: "Debug message",
      };

      const infoEntry: LogEntry = {
        timestamp: "2024-01-15T10:30:00.000Z",
        level: LogLevel.INFO,
        message: "Info message",
      };

      const warnEntry: LogEntry = {
        timestamp: "2024-01-15T10:30:00.000Z",
        level: LogLevel.WARN,
        message: "Warning message",
      };

      transport.log(debugEntry);
      transport.log(infoEntry);
      transport.log(warnEntry);

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.info).not.toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalledWith(JSON.stringify(warnEntry));
    });
  });
});
