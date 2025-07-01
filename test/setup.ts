import { afterEach, beforeEach, vi } from "vitest";

// Mock console methods to avoid noise in tests
const originalConsole = { ...console };

beforeEach(() => {
  // Reset console mocks
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "debug").mockImplementation(() => {});
});

afterEach(() => {
  // Restore console methods
  vi.restoreAllMocks();
});

// Mock fetch for transport tests
global.fetch = vi.fn();

// Mock process.env
const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = originalEnv;
});

// Mock performance.now for consistent timing in tests
const originalPerformanceNow = performance.now;
beforeEach(() => {
  let time = 1000; // Start with a realistic timestamp
  performance.now = vi.fn(() => {
    time += 10; // Increment by 10ms each call
    return time;
  });
});

afterEach(() => {
  performance.now = originalPerformanceNow;
});
