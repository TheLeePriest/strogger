import { beforeEach, describe, expect, it } from "vitest";
import { createPerformanceMonitor } from "../../src/utils/performance";

describe("createPerformanceMonitor", () => {
  let performanceMonitor: ReturnType<typeof createPerformanceMonitor>;

  beforeEach(() => {
    performanceMonitor = createPerformanceMonitor();
  });

  describe("startTimer", () => {
    it("should create a timer function", () => {
      const timer = performanceMonitor.startTimer("testFunction");
      expect(typeof timer).toBe("function");
    });

    it("should record metrics when timer is called", () => {
      const timer = performanceMonitor.startTimer("testFunction");
      const metrics = timer({ userId: "123" });

      expect(metrics.functionName).toBe("testFunction");
      expect(metrics.duration).toBeGreaterThan(0);
      expect(metrics.startTime).toBeGreaterThan(0);
      expect(metrics.endTime).toBeGreaterThan(0);
      expect(metrics.metadata).toEqual({ userId: "123" });
    });

    it("should record metrics without metadata", () => {
      const timer = performanceMonitor.startTimer("testFunction");
      const metrics = timer();

      expect(metrics.functionName).toBe("testFunction");
      expect(metrics.duration).toBeGreaterThan(0);
      expect(metrics.metadata).toBeUndefined();
    });
  });

  describe("timeAsync", () => {
    it("should time async functions correctly", async () => {
      const result = await performanceMonitor.timeAsync(
        "asyncFunction",
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return "async result";
        },
        { operation: "test" },
      );

      expect(result).toBe("async result");

      const metrics = performanceMonitor.getMetrics("asyncFunction");
      expect(metrics).toHaveLength(1);
      expect(metrics[0].functionName).toBe("asyncFunction");
      expect(metrics[0].duration).toBeGreaterThan(0);
      expect(metrics[0].metadata).toEqual({ operation: "test" });
    });

    it("should handle async function errors", async () => {
      const error = new Error("Async error");

      await expect(
        performanceMonitor.timeAsync("asyncErrorFunction", async () => {
          throw error;
        }),
      ).rejects.toThrow("Async error");

      const metrics = performanceMonitor.getMetrics("asyncErrorFunction");
      expect(metrics).toHaveLength(1);
      expect(metrics[0].functionName).toBe("asyncErrorFunction");
    });
  });

  describe("timeSync", () => {
    it("should time sync functions correctly", () => {
      const result = performanceMonitor.timeSync(
        "syncFunction",
        () => {
          // Simulate some work
          let sum = 0;
          for (let i = 0; i < 1000; i++) {
            sum += i;
          }
          return sum;
        },
        { operation: "test" },
      );

      expect(result).toBe(499500);

      const metrics = performanceMonitor.getMetrics("syncFunction");
      expect(metrics).toHaveLength(1);
      expect(metrics[0].functionName).toBe("syncFunction");
      expect(metrics[0].duration).toBeGreaterThan(0);
      expect(metrics[0].metadata).toEqual({ operation: "test" });
    });

    it("should handle sync function errors", () => {
      const error = new Error("Sync error");

      expect(() => {
        performanceMonitor.timeSync("syncErrorFunction", () => {
          throw error;
        });
      }).toThrow("Sync error");

      const metrics = performanceMonitor.getMetrics("syncErrorFunction");
      expect(metrics).toHaveLength(1);
      expect(metrics[0].functionName).toBe("syncErrorFunction");
    });
  });

  describe("getMetrics", () => {
    it("should return all metrics when no function name specified", () => {
      const timer1 = performanceMonitor.startTimer("function1");
      const timer2 = performanceMonitor.startTimer("function2");

      timer1();
      timer2();

      const allMetrics = performanceMonitor.getMetrics();
      expect(allMetrics.length).toBeGreaterThanOrEqual(2);
    });

    it("should return metrics for specific function", () => {
      const timer = performanceMonitor.startTimer("specificFunction");
      timer();
      timer();

      const metrics = performanceMonitor.getMetrics("specificFunction");
      expect(metrics).toHaveLength(2);
      expect(metrics[0].functionName).toBe("specificFunction");
      expect(metrics[1].functionName).toBe("specificFunction");
    });

    it("should return empty array for non-existent function", () => {
      const metrics = performanceMonitor.getMetrics("nonExistentFunction");
      expect(metrics).toEqual([]);
    });
  });

  describe("getAverageDuration", () => {
    it("should calculate average duration correctly", () => {
      const timer = performanceMonitor.startTimer("avgFunction");

      timer();
      timer();
      timer();

      const avgDuration = performanceMonitor.getAverageDuration("avgFunction");
      expect(avgDuration).toBeGreaterThan(0);
    });

    it("should return 0 for non-existent function", () => {
      const avgDuration = performanceMonitor.getAverageDuration(
        "nonExistentFunction",
      );
      expect(avgDuration).toBe(0);
    });
  });

  describe("getSlowestExecution", () => {
    it("should return slowest execution for specific function", () => {
      const timer = performanceMonitor.startTimer("slowFunction");

      timer();
      timer();

      const slowest = performanceMonitor.getSlowestExecution("slowFunction");
      expect(slowest).not.toBeNull();
      expect(slowest?.functionName).toBe("slowFunction");
    });

    it("should return slowest execution across all functions", () => {
      const timer1 = performanceMonitor.startTimer("function1");
      const timer2 = performanceMonitor.startTimer("function2");

      timer1();
      timer2();

      const slowest = performanceMonitor.getSlowestExecution();
      expect(slowest).not.toBeNull();
      expect(slowest?.functionName).toMatch(/function[12]/);
    });

    it("should return null when no metrics exist", () => {
      const slowest = performanceMonitor.getSlowestExecution();
      expect(slowest).toBeNull();
    });
  });

  describe("clearMetrics", () => {
    it("should clear metrics for specific function", () => {
      const timer = performanceMonitor.startTimer("clearFunction");
      timer();

      expect(performanceMonitor.getMetrics("clearFunction")).toHaveLength(1);

      performanceMonitor.clearMetrics("clearFunction");
      expect(performanceMonitor.getMetrics("clearFunction")).toHaveLength(0);
    });

    it("should clear all metrics when no function specified", () => {
      const timer1 = performanceMonitor.startTimer("function1");
      const timer2 = performanceMonitor.startTimer("function2");

      timer1();
      timer2();

      expect(performanceMonitor.getMetrics()).toHaveLength(2);

      performanceMonitor.clearMetrics();
      expect(performanceMonitor.getMetrics()).toHaveLength(0);
    });
  });

  describe("getMetricsSummary", () => {
    it("should return summary of all functions", () => {
      const timer1 = performanceMonitor.startTimer("function1");
      const timer2 = performanceMonitor.startTimer("function2");

      timer1();
      timer1();
      timer2();

      const summary = performanceMonitor.getMetricsSummary();

      expect(summary).toHaveProperty("function1");
      expect(summary).toHaveProperty("function2");
      expect(summary.function1.count).toBe(2);
      expect(summary.function2.count).toBe(1);
      expect(summary.function1.avgDuration).toBeGreaterThan(0);
      expect(summary.function1.maxDuration).toBeGreaterThan(0);
    });

    it("should return empty object when no metrics exist", () => {
      const summary = performanceMonitor.getMetricsSummary();
      expect(summary).toEqual({});
    });
  });

  describe("initialState", () => {
    it("should accept initial state", () => {
      const initialState = {
        metrics: new Map([
          [
            "existingFunction",
            [
              {
                functionName: "existingFunction",
                duration: 100,
                startTime: 1000,
                endTime: 1100,
                metadata: { test: true },
              },
            ],
          ],
        ]),
      };

      const monitor = createPerformanceMonitor(initialState);
      const metrics = monitor.getMetrics("existingFunction");

      expect(metrics).toHaveLength(1);
      expect(metrics[0].functionName).toBe("existingFunction");
      expect(metrics[0].duration).toBe(100);
    });
  });
});
