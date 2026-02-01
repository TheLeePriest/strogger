export interface PerformanceMetrics {
  functionName: string;
  duration: number;
  startTime: number;
  endTime: number;
  metadata?: Record<string, unknown>;
}

export interface PerformanceMonitorConfig {
  /** Maximum number of metrics to store per function. Oldest entries are evicted when exceeded. Default: 1000 */
  maxEntriesPerFunction?: number;
  /** Maximum age of metrics in milliseconds. Metrics older than this are evicted. Default: undefined (no TTL) */
  maxAge?: number;
}

export interface PerformanceMonitorState {
  metrics: Map<string, PerformanceMetrics[]>;
}

const DEFAULT_MAX_ENTRIES_PER_FUNCTION = 1000;

export const createPerformanceMonitor = (
  initialState?: PerformanceMonitorState,
  config: PerformanceMonitorConfig = {},
) => {
  const state: PerformanceMonitorState = initialState || { metrics: new Map() };
  const maxEntriesPerFunction =
    config.maxEntriesPerFunction ?? DEFAULT_MAX_ENTRIES_PER_FUNCTION;
  const maxAge = config.maxAge;

  /**
   * Evict old entries based on TTL if configured
   */
  const evictStaleEntries = (
    metrics: PerformanceMetrics[],
  ): PerformanceMetrics[] => {
    if (!maxAge) return metrics;
    const cutoff = performance.now() - maxAge;
    return metrics.filter((m) => m.endTime >= cutoff);
  };

  const recordMetric = (functionName: string, metric: PerformanceMetrics) => {
    if (!state.metrics.has(functionName)) {
      state.metrics.set(functionName, []);
    }
    let metrics = state.metrics.get(functionName);
    if (metrics) {
      // Evict stale entries first
      metrics = evictStaleEntries(metrics);

      // Evict oldest if at capacity
      while (metrics.length >= maxEntriesPerFunction) {
        metrics.shift();
      }

      metrics.push(metric);
      state.metrics.set(functionName, metrics);
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
      const metrics = state.metrics.get(functionName);
      if (!metrics) return [];
      // Evict stale entries on read
      const freshMetrics = evictStaleEntries(metrics);
      if (freshMetrics.length !== metrics.length) {
        state.metrics.set(functionName, freshMetrics);
      }
      return freshMetrics;
    }
    const allMetrics: PerformanceMetrics[] = [];
    for (const [name, metrics] of state.metrics.entries()) {
      // Evict stale entries on read
      const freshMetrics = evictStaleEntries(metrics);
      if (freshMetrics.length !== metrics.length) {
        state.metrics.set(name, freshMetrics);
      }
      allMetrics.push(...freshMetrics);
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

  const getConfig = (): PerformanceMonitorConfig => {
    const config: PerformanceMonitorConfig = {
      maxEntriesPerFunction,
    };
    if (maxAge !== undefined) {
      config.maxAge = maxAge;
    }
    return config;
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
    getConfig,
  };
};
