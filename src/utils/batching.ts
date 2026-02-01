import type { LogEntry, Transport } from "../types";

export interface BatchConfig {
  maxSize: number; // Maximum number of logs in a batch
  maxWaitTime: number; // Maximum time to wait before flushing (ms)
  maxBatchSize: number; // Maximum size of batch in bytes
  maxRetries?: number; // Maximum number of retries for failed batches (default: 3)
  onFlushError?: (error: unknown, failedLogs: LogEntry[]) => void; // Callback for flush errors
}

export interface BatchState {
  logs: LogEntry[];
  retryQueue: LogEntry[]; // Separate queue for failed logs to maintain order
  currentSize: number;
  lastFlush: number;
  flushTimer?: ReturnType<typeof setTimeout> | undefined;
  retryCount: number;
}

export interface BatchedTransport extends Transport {
  flush: () => Promise<void>;
  getStats: () => BatchStats;
  close: () => Promise<void>;
}

export interface BatchStats {
  totalLogs: number;
  totalBatches: number;
  averageBatchSize: number;
  lastFlushTime: number;
  pendingLogs: number;
  retryQueueSize: number;
  failedBatches: number;
  [key: string]: unknown;
}

const DEFAULT_MAX_RETRIES = 3;

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
  const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
  const onFlushError = config.onFlushError;

  const state: BatchState = {
    logs: [],
    retryQueue: [],
    currentSize: 0,
    lastFlush: Date.now(),
    retryCount: 0,
  };

  const stats = {
    totalLogs: 0,
    totalBatches: 0,
    averageBatchSize: 0,
    lastFlushTime: 0,
    pendingLogs: 0,
    retryQueueSize: 0,
    failedBatches: 0,
  };

  const flush = async (): Promise<void> => {
    // First, process retry queue (older logs first to maintain order)
    if (state.retryQueue.length > 0 && state.retryCount < maxRetries) {
      const retryLogs = [...state.retryQueue];
      state.retryQueue = [];

      try {
        await Promise.allSettled(retryLogs.map((log) => transport.log(log)));
        stats.totalLogs += retryLogs.length;
        state.retryCount = 0; // Reset retry count on success
      } catch (error) {
        state.retryCount++;
        if (state.retryCount < maxRetries) {
          // Put back in retry queue for next attempt
          state.retryQueue = retryLogs;
        } else {
          // Max retries exceeded, drop the logs and notify
          stats.failedBatches++;
          console.error(
            `Batch flush failed after ${maxRetries} retries, dropping ${retryLogs.length} logs:`,
            error,
          );
          if (onFlushError) {
            onFlushError(error, retryLogs);
          }
          state.retryCount = 0;
        }
      }
    }

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
      stats.retryQueueSize = state.retryQueue.length;
    } catch (error) {
      console.error("Batch flush failed:", error);
      // Add to retry queue (maintains order - new logs come after retry queue)
      state.retryQueue.push(...logsToSend);
      stats.retryQueueSize = state.retryQueue.length;
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
    return {
      ...stats,
      pendingLogs: state.logs.length,
      retryQueueSize: state.retryQueue.length,
    };
  };

  const close = async (): Promise<void> => {
    // Clear timer
    if (state.flushTimer) {
      clearTimeout(state.flushTimer);
      state.flushTimer = undefined;
    }
    // Final flush attempt
    await flush();
  };

  return {
    log,
    setLevel,
    getLevel,
    flush,
    getStats,
    close,
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

  const close = async (): Promise<void> => {
    await Promise.allSettled(
      batchedTransports.map((transport) => transport.close()),
    );
  };

  return {
    log,
    setLevel,
    getLevel,
    flush,
    getStats,
    close,
  };
};
