import type { LoggerConfig } from "../types";

export interface RateLimiterState {
  tokens: number;
  lastRefill: number;
  maxTokens: number;
  refillRate: number; // tokens per second
}

export interface SamplingState {
  totalLogs: number;
  sampledLogs: number;
}

/**
 * Creates a rate limiter using token bucket algorithm
 */
export const createRateLimiter = (
  maxLogsPerSecond: number,
  burstSize: number,
) => {
  const state: RateLimiterState = {
    tokens: burstSize,
    lastRefill: Date.now(),
    maxTokens: burstSize,
    refillRate: maxLogsPerSecond,
  };

  const refillTokens = () => {
    const now = Date.now();
    const timePassed = (now - state.lastRefill) / 1000; // Convert to seconds
    const tokensToAdd = timePassed * state.refillRate;

    state.tokens = Math.min(state.maxTokens, state.tokens + tokensToAdd);
    state.lastRefill = now;
  };

  const tryConsume = (tokens = 1): boolean => {
    refillTokens();

    if (state.tokens >= tokens) {
      state.tokens -= tokens;
      return true;
    }

    return false;
  };

  return {
    tryConsume,
    getState: () => ({ ...state }),
  };
};

/**
 * Creates a sampling function that respects the sampling rate
 */
export const createSampler = (samplingRate: number) => {
  const state: SamplingState = {
    totalLogs: 0,
    sampledLogs: 0,
  };

  const shouldSample = (): boolean => {
    state.totalLogs++;

    if (samplingRate >= 1.0) {
      state.sampledLogs++;
      return true;
    }

    if (samplingRate <= 0.0) {
      return false;
    }

    const random = Math.random();
    if (random <= samplingRate) {
      state.sampledLogs++;
      return true;
    }

    return false;
  };

  const getStats = () => ({
    totalLogs: state.totalLogs,
    sampledLogs: state.sampledLogs,
    samplingRate: state.totalLogs > 0 ? state.sampledLogs / state.totalLogs : 0,
    configuredRate: samplingRate,
  });

  return {
    shouldSample,
    getStats,
  };
};

/**
 * Creates a combined sampling and rate limiting function
 */
export const createLogFilter = (config: LoggerConfig) => {
  const rateLimiter = config.rateLimit
    ? createRateLimiter(
        config.rateLimit.maxLogsPerSecond,
        config.rateLimit.burstSize,
      )
    : null;

  const sampler =
    config.samplingRate !== undefined
      ? createSampler(config.samplingRate)
      : null;

  const shouldLog = (): boolean => {
    // If no sampling or rate limiting is configured, always allow
    if (!rateLimiter && !sampler) {
      return true;
    }

    // Check rate limiting first
    if (rateLimiter && !rateLimiter.tryConsume()) {
      return false;
    }

    // Then check sampling
    if (sampler && !sampler.shouldSample()) {
      return false;
    }

    return true;
  };

  const getStats = () => ({
    rateLimit: rateLimiter?.getState(),
    sampling: sampler?.getStats(),
  });

  return {
    shouldLog,
    getStats,
  };
};
