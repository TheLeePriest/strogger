export interface PerformanceMetrics {
  functionName: string;
  duration: number;
  startTime: number;
  endTime: number;
  metadata?: Record<string, unknown>;
}

export interface PerformanceMonitorState {
  metrics: Map<string, PerformanceMetrics[]>;
}

export const createPerformanceMonitor = (
  initialState?: PerformanceMonitorState,
) => {
  const state: PerformanceMonitorState = initialState || { metrics: new Map() };

  const recordMetric = (functionName: string, metric: PerformanceMetrics) => {
    if (!state.metrics.has(functionName)) {
      state.metrics.set(functionName, []);
    }
    const metrics = state.metrics.get(functionName);
    if (metrics) {
      metrics.push(metric);
    }
  };

  const startTimer = (functionName: string) => {
    const startTime = performance.now();
    return (metadata?: Record<string, unknown>): PerformanceMetrics => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      const metric: PerformanceMetrics = {
        functionName,
        duration,
        startTime,
        endTime,
        ...(metadata && { metadata }),
      };
      recordMetric(functionName, metric);
      return metric;
    };
  };

  const timeAsync = async <T>(
    functionName: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>,
  ): Promise<T> => {
    const startTime = performance.now();
    try {
      const result = await fn();
      const endTime = performance.now();
      const duration = endTime - startTime;
      const metric: PerformanceMetrics = {
        functionName,
        duration,
        startTime,
        endTime,
        ...(metadata && { metadata }),
      };
      recordMetric(functionName, metric);
      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      const metric: PerformanceMetrics = {
        functionName,
        duration,
        startTime,
        endTime,
        ...(metadata && { metadata: { ...metadata, error: true } }),
      };
      recordMetric(functionName, metric);
      throw error;
    }
  };

  const timeSync = <T>(
    functionName: string,
    fn: () => T,
    metadata?: Record<string, unknown>,
  ): T => {
    const startTime = performance.now();
    try {
      const result = fn();
      const endTime = performance.now();
      const duration = endTime - startTime;
      const metric: PerformanceMetrics = {
        functionName,
        duration,
        startTime,
        endTime,
        ...(metadata && { metadata }),
      };
      recordMetric(functionName, metric);
      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      const metric: PerformanceMetrics = {
        functionName,
        duration,
        startTime,
        endTime,
        ...(metadata && { metadata: { ...metadata, error: true } }),
      };
      recordMetric(functionName, metric);
      throw error;
    }
  };

  const getMetrics = (functionName?: string): PerformanceMetrics[] => {
    if (functionName) {
      return state.metrics.get(functionName) || [];
    }
    const allMetrics: PerformanceMetrics[] = [];
    for (const metrics of state.metrics.values()) {
      allMetrics.push(...metrics);
    }
    return allMetrics;
  };

  const getAverageDuration = (functionName: string): number => {
    const metrics = getMetrics(functionName);
    if (metrics.length === 0) return 0;
    const totalDuration = metrics.reduce(
      (sum, metric) => sum + metric.duration,
      0,
    );
    return totalDuration / metrics.length;
  };

  const getSlowestExecution = (
    functionName?: string,
  ): PerformanceMetrics | null => {
    const metrics = getMetrics(functionName);
    if (metrics.length === 0) return null;
    return metrics.reduce((slowest, current) =>
      current.duration > slowest.duration ? current : slowest,
    );
  };

  const clearMetrics = (functionName?: string): void => {
    if (functionName) {
      state.metrics.delete(functionName);
    } else {
      state.metrics.clear();
    }
  };

  const getMetricsSummary = (): Record<
    string,
    { count: number; avgDuration: number; maxDuration: number }
  > => {
    const summary: Record<
      string,
      { count: number; avgDuration: number; maxDuration: number }
    > = {};
    for (const [functionName, metrics] of state.metrics.entries()) {
      const count = metrics.length;
      const avgDuration = getAverageDuration(functionName);
      const maxDuration = Math.max(...metrics.map((m) => m.duration));
      summary[functionName] = { count, avgDuration, maxDuration };
    }
    return summary;
  };

  return {
    state,
    startTimer,
    timeAsync,
    timeSync,
    getMetrics,
    getAverageDuration,
    getSlowestExecution,
    clearMetrics,
    getMetricsSummary,
  };
};
