import type { LogEntry, Transport } from "../types";

export interface BatchConfig {
  maxSize: number; // Maximum number of logs in a batch
  maxWaitTime: number; // Maximum time to wait before flushing (ms)
  maxBatchSize: number; // Maximum size of batch in bytes
}

export interface BatchState {
  logs: LogEntry[];
  currentSize: number;
  lastFlush: number;
  flushTimer?: ReturnType<typeof setTimeout> | undefined;
}

export interface BatchedTransport extends Transport {
  flush: () => Promise<void>;
  getStats: () => BatchStats;
}

export interface BatchStats {
  totalLogs: number;
  totalBatches: number;
  averageBatchSize: number;
  lastFlushTime: number;
  pendingLogs: number;
  [key: string]: unknown;
}

/**
 * Creates a batched transport wrapper around an existing transport
 */
export const createBatchedTransport = (
  transport: Transport,
  config: BatchConfig = {
    maxSize: 100,
    maxWaitTime: 5000,
    maxBatchSize: 1024 * 1024, // 1MB
  },
): BatchedTransport => {
  const state: BatchState = {
    logs: [],
    currentSize: 0,
    lastFlush: Date.now(),
  };

  const stats = {
    totalLogs: 0,
    totalBatches: 0,
    averageBatchSize: 0,
    lastFlushTime: 0,
    pendingLogs: 0,
  };

  const calculateBatchSize = (logs: LogEntry[]): number => {
    return logs.reduce((size, log) => {
      return size + JSON.stringify(log).length;
    }, 0);
  };

  const flush = async (): Promise<void> => {
    if (state.logs.length === 0) return;

    const logsToSend = [...state.logs];
    state.logs = [];
    state.currentSize = 0;
    state.lastFlush = Date.now();

    // Clear any pending timer
    if (state.flushTimer) {
      clearTimeout(state.flushTimer);
      state.flushTimer = undefined;
    }

    try {
      // Send logs in parallel to the transport
      await Promise.allSettled(logsToSend.map((log) => transport.log(log)));

      // Update stats
      stats.totalLogs += logsToSend.length;
      stats.totalBatches += 1;
      stats.averageBatchSize = stats.totalLogs / stats.totalBatches;
      stats.lastFlushTime = Date.now();
      stats.pendingLogs = state.logs.length;
    } catch (error) {
      console.error("Batch flush failed:", error);
      // Re-add logs to the batch for retry
      state.logs.unshift(...logsToSend);
      state.currentSize = calculateBatchSize(state.logs);
    }
  };

  const scheduleFlush = (): void => {
    if (state.flushTimer) return;

    state.flushTimer = setTimeout(() => {
      flush().catch(console.error);
    }, config.maxWaitTime);
  };

  const log = async (entry: LogEntry): Promise<void> => {
    const entrySize = JSON.stringify(entry).length;

    // Check if adding this entry would exceed batch limits
    if (
      state.logs.length >= config.maxSize ||
      state.currentSize + entrySize >= config.maxBatchSize
    ) {
      await flush();
    }

    state.logs.push(entry);
    state.currentSize += entrySize;
    stats.pendingLogs = state.logs.length;

    // Schedule flush if this is the first log
    if (state.logs.length === 1) {
      scheduleFlush();
    }
  };

  const setLevel = (level: number): void => {
    transport.setLevel(level);
  };

  const getLevel = (): number => {
    return transport.getLevel();
  };

  const getStats = (): BatchStats => {
    return { ...stats, pendingLogs: state.logs.length };
  };

  return {
    log,
    setLevel,
    getLevel,
    flush,
    getStats,
  };
};

/**
 * Creates a multi-transport batched logger
 */
export const createBatchedLogger = (
  transports: Transport[],
  config: BatchConfig = {
    maxSize: 50,
    maxWaitTime: 2000,
    maxBatchSize: 512 * 1024, // 512KB
  },
) => {
  const batchedTransports = transports.map((transport) =>
    createBatchedTransport(transport, config),
  );

  const log = async (entry: LogEntry): Promise<void> => {
    await Promise.allSettled(
      batchedTransports.map((transport) => transport.log(entry)),
    );
  };

  const setLevel = (level: number): void => {
    for (const transport of batchedTransports) {
      transport.setLevel(level);
    }
  };

  const getLevel = (): number => {
    // Return the minimum level across all transports
    return Math.min(...batchedTransports.map((t) => t.getLevel()));
  };

  const flush = async (): Promise<void> => {
    await Promise.allSettled(
      batchedTransports.map((transport) => transport.flush()),
    );
  };

  const getStats = () => {
    return batchedTransports.map((transport) => transport.getStats());
  };

  return {
    log,
    setLevel,
    getLevel,
    flush,
    getStats,
  };
};
