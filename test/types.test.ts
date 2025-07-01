import { describe, expect, it } from "vitest";
import { LogLevel } from "../src/types";

describe("LogLevel", () => {
  it("should have correct numeric values", () => {
    expect(LogLevel.DEBUG).toBe(0);
    expect(LogLevel.INFO).toBe(1);
    expect(LogLevel.WARN).toBe(2);
    expect(LogLevel.ERROR).toBe(3);
    expect(LogLevel.FATAL).toBe(4);
  });

  it("should have correct ordering for log level comparisons", () => {
    expect(LogLevel.DEBUG < LogLevel.INFO).toBe(true);
    expect(LogLevel.INFO < LogLevel.WARN).toBe(true);
    expect(LogLevel.WARN < LogLevel.ERROR).toBe(true);
    expect(LogLevel.ERROR < LogLevel.FATAL).toBe(true);
  });

  it("should allow comparison operations", () => {
    expect(LogLevel.INFO >= LogLevel.DEBUG).toBe(true);
    expect(LogLevel.ERROR >= LogLevel.WARN).toBe(true);
    expect(LogLevel.FATAL >= LogLevel.ERROR).toBe(true);
    expect(LogLevel.DEBUG < LogLevel.FATAL).toBe(true);
  });
});
