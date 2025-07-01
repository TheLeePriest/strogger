import { beforeEach, describe, expect, it } from "vitest";
import { BaseTransport, shouldLog } from "../../src/transports/base-transport";
import { type LogEntry, LogLevel } from "../../src/types";

// Create a concrete implementation of BaseTransport for testing
class TestTransport extends BaseTransport {
  public loggedEntries: LogEntry[] = [];

  async log(entry: LogEntry): Promise<void> {
    if (this.shouldLog(entry.level)) {
      this.loggedEntries.push(entry);
    }
  }
}

describe("BaseTransport", () => {
  let transport: TestTransport;

  beforeEach(() => {
    transport = new TestTransport();
  });

  describe("setLevel", () => {
    it("should set the log level", () => {
      transport.setLevel(LogLevel.WARN);
      expect(transport.getLevel()).toBe(LogLevel.WARN);
    });

    it("should allow changing the level multiple times", () => {
      transport.setLevel(LogLevel.DEBUG);
      expect(transport.getLevel()).toBe(LogLevel.DEBUG);

      transport.setLevel(LogLevel.ERROR);
      expect(transport.getLevel()).toBe(LogLevel.ERROR);
    });
  });

  describe("getLevel", () => {
    it("should return INFO as default level", () => {
      expect(transport.getLevel()).toBe(LogLevel.INFO);
    });

    it("should return the set level", () => {
      transport.setLevel(LogLevel.DEBUG);
      expect(transport.getLevel()).toBe(LogLevel.DEBUG);
    });
  });

  describe("shouldLog", () => {
    it("should log entries at or above the set level", () => {
      transport.setLevel(LogLevel.WARN);

      expect(shouldLog(LogLevel.DEBUG, LogLevel.WARN)).toBe(false);
      expect(shouldLog(LogLevel.INFO, LogLevel.WARN)).toBe(false);
      expect(shouldLog(LogLevel.WARN, LogLevel.WARN)).toBe(true);
      expect(shouldLog(LogLevel.ERROR, LogLevel.WARN)).toBe(true);
      expect(shouldLog(LogLevel.FATAL, LogLevel.WARN)).toBe(true);
    });

    it("should log all entries when level is DEBUG", () => {
      transport.setLevel(LogLevel.DEBUG);

      expect(shouldLog(LogLevel.DEBUG, LogLevel.DEBUG)).toBe(true);
      expect(shouldLog(LogLevel.INFO, LogLevel.DEBUG)).toBe(true);
      expect(shouldLog(LogLevel.WARN, LogLevel.DEBUG)).toBe(true);
      expect(shouldLog(LogLevel.ERROR, LogLevel.DEBUG)).toBe(true);
      expect(shouldLog(LogLevel.FATAL, LogLevel.DEBUG)).toBe(true);
    });

    it("should only log FATAL when level is FATAL", () => {
      transport.setLevel(LogLevel.FATAL);

      expect(shouldLog(LogLevel.DEBUG, LogLevel.FATAL)).toBe(false);
      expect(shouldLog(LogLevel.INFO, LogLevel.FATAL)).toBe(false);
      expect(shouldLog(LogLevel.WARN, LogLevel.FATAL)).toBe(false);
      expect(shouldLog(LogLevel.ERROR, LogLevel.FATAL)).toBe(false);
      expect(shouldLog(LogLevel.FATAL, LogLevel.FATAL)).toBe(true);
    });
  });

  describe("log method filtering", () => {
    it("should only log entries that meet the level requirement", async () => {
      transport.setLevel(LogLevel.WARN);

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

      const errorEntry: LogEntry = {
        timestamp: "2024-01-15T10:30:00.000Z",
        level: LogLevel.ERROR,
        message: "Error message",
      };

      await transport.log(debugEntry);
      await transport.log(warnEntry);
      await transport.log(errorEntry);

      expect(transport.loggedEntries).toHaveLength(2);
      expect(transport.loggedEntries[0]).toBe(warnEntry);
      expect(transport.loggedEntries[1]).toBe(errorEntry);
    });

    it("should log all entries when level is DEBUG", async () => {
      transport.setLevel(LogLevel.DEBUG);

      const entries: LogEntry[] = [
        {
          timestamp: "2024-01-15T10:30:00.000Z",
          level: LogLevel.DEBUG,
          message: "Debug message",
        },
        {
          timestamp: "2024-01-15T10:30:00.000Z",
          level: LogLevel.INFO,
          message: "Info message",
        },
        {
          timestamp: "2024-01-15T10:30:00.000Z",
          level: LogLevel.WARN,
          message: "Warning message",
        },
      ];

      for (const entry of entries) {
        await transport.log(entry);
      }

      expect(transport.loggedEntries).toHaveLength(3);
    });
  });
});

describe("shouldLog utility function", () => {
  it("should return true when entry level is at or above minimum level", () => {
    expect(shouldLog(LogLevel.DEBUG, LogLevel.DEBUG)).toBe(true);
    expect(shouldLog(LogLevel.INFO, LogLevel.DEBUG)).toBe(true);
    expect(shouldLog(LogLevel.WARN, LogLevel.DEBUG)).toBe(true);
    expect(shouldLog(LogLevel.ERROR, LogLevel.DEBUG)).toBe(true);
    expect(shouldLog(LogLevel.FATAL, LogLevel.DEBUG)).toBe(true);
  });

  it("should return false when entry level is below minimum level", () => {
    expect(shouldLog(LogLevel.DEBUG, LogLevel.INFO)).toBe(false);
    expect(shouldLog(LogLevel.INFO, LogLevel.WARN)).toBe(false);
    expect(shouldLog(LogLevel.WARN, LogLevel.ERROR)).toBe(false);
    expect(shouldLog(LogLevel.ERROR, LogLevel.FATAL)).toBe(false);
  });

  it("should handle edge cases", () => {
    expect(shouldLog(LogLevel.FATAL, LogLevel.FATAL)).toBe(true);
    expect(shouldLog(LogLevel.DEBUG, LogLevel.FATAL)).toBe(false);
  });

  it("should work with all log level combinations", () => {
    const levels = [
      LogLevel.DEBUG,
      LogLevel.INFO,
      LogLevel.WARN,
      LogLevel.ERROR,
      LogLevel.FATAL,
    ];

    for (const entryLevel of levels) {
      for (const minLevel of levels) {
        const result = shouldLog(entryLevel, minLevel);
        expect(typeof result).toBe("boolean");
        expect(result).toBe(entryLevel >= minLevel);
      }
    }
  });
});
